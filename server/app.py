"""Single-process CRASDI API. Put behind HTTPS; only the website proxy holds API_KEY."""
import asyncio, hashlib, hmac, json, os, re, secrets, smtplib, sqlite3, ssl, sys, time
from contextlib import asynccontextmanager, contextmanager
from email.message import EmailMessage
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx
from server.state_store import blob_connect, StateStoreError

DB = os.getenv('DATABASE_PATH', '/data/playground.sqlite3')
API_KEY = os.getenv('CRASDI_API_KEY', '')
SECRET = os.getenv('AUTH_SECRET', '')
DAILY = int(os.getenv('DAILY_RUN_LIMIT', '20'))
GLOBAL_DAILY = int(os.getenv('GLOBAL_RUN_LIMIT', '100'))
COOKIE = '__Host-playground'
SESSION_SECONDS = 7 * 86400
semaphore = asyncio.Semaphore(1)
active_accounts = set()


@contextmanager
def connect():
    if os.getenv('STATE_BACKEND', 'sqlite') == 'azure_blob':
        with blob_connect() as db:
            yield db
        return
    db = sqlite3.connect(DB, timeout=5)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app):
    if len(API_KEY) < 32 or len(SECRET) < 32 or API_KEY == SECRET:
        raise RuntimeError('Set distinct CRASDI_API_KEY and AUTH_SECRET values of at least 32 characters.')
    backend = os.getenv('STATE_BACKEND', 'sqlite')
    if backend not in ('sqlite', 'azure_blob'):
        raise RuntimeError('Unknown STATE_BACKEND.')
    if os.getenv('CONTAINER_APP_NAME') and backend != 'azure_blob':
        raise RuntimeError('Azure Container Apps requires durable azure_blob state.')
    if os.getenv('EMAIL_PROVIDER', 'gmail') not in ('gmail', 'resend'):
        raise RuntimeError('Unknown EMAIL_PROVIDER.')
    if backend == 'sqlite':
        Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS codes (account TEXT PRIMARY KEY, digest TEXT, expires INTEGER, attempts INTEGER);
        CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, account TEXT, email TEXT, expires INTEGER);
        CREATE TABLE IF NOT EXISTS counters (name TEXT, bucket INTEGER, count INTEGER, expires INTEGER, PRIMARY KEY(name,bucket));
        ''')
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def digest(text):
    return hmac.new(SECRET.encode(), text.encode(), hashlib.sha256).hexdigest()


def mail_ready():
    if os.getenv('EMAIL_PROVIDER', 'gmail') == 'resend':
        return bool(os.getenv('RESEND_API_KEY') and os.getenv('EMAIL_FROM'))
    return bool(os.getenv('SMTP_USER') and os.getenv('SMTP_PASSWORD'))


@app.middleware('http')
async def protect(request, call_next):
    if request.method == 'GET' and request.url.path == '/healthz':
        return JSONResponse({'ok': True}, headers={'Cache-Control': 'no-store'})
    if not API_KEY or not hmac.compare_digest(request.headers.get('x-api-key', ''), API_KEY):
        return JSONResponse({'detail': 'Unauthorized.'}, status_code=401)
    try:
        response = await call_next(request)
    except (sqlite3.Error, StateStoreError):
        response = JSONResponse({'detail': 'Service temporarily unavailable. Please try later.'}, status_code=503)
    response.headers['Cache-Control'] = 'no-store'
    return response


async def body(request, limit=4096):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > limit:
            raise HTTPException(413, 'Request is too large.')
    try:
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, UnicodeError):
        raise HTTPException(400, 'Invalid JSON request.')


def email_account(value):
    if not isinstance(value, str) or len(value) > 254:
        raise HTTPException(400, 'Enter a valid email address.')
    email = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+", email):
        raise HTTPException(400, 'Enter a valid email address.')
    local, domain = email.rsplit('@', 1)
    if domain in ('gmail.com', 'googlemail.com'):
        local, domain = local.split('+', 1)[0].replace('.', ''), 'gmail.com'
    return email, digest('account:' + local + '@' + domain)


def ip_key(request):
    # Accepted only through the authenticated website proxy, never from browser JSON.
    return digest('ip:' + request.headers.get('x-playground-client-ip', 'unknown'))


def reserve(limits):
    """Check and increment all budgets in one SQLite write transaction."""
    now = int(time.time())
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM counters WHERE expires < ?', (now,))
        db.execute('DELETE FROM codes WHERE expires < ?', (now,))
        db.execute('DELETE FROM sessions WHERE expires < ?', (now,))
        for name, seconds, cap in limits:
            bucket = now // seconds
            row = db.execute('SELECT count FROM counters WHERE name=? AND bucket=?', (name, bucket)).fetchone()
            if row and row['count'] >= cap:
                raise HTTPException(429, 'Usage limit reached. Please try later.', headers={'Retry-After': str(seconds - now % seconds)})
        for name, seconds, cap in limits:
            bucket = now // seconds
            db.execute('INSERT INTO counters VALUES (?,?,1,?) ON CONFLICT(name,bucket) DO UPDATE SET count=count+1', (name, bucket, (bucket + 1) * seconds))


def remaining(account):
    with connect() as db:
        row = db.execute('SELECT count FROM counters WHERE name=? AND bucket=?', ('job-day:' + account, int(time.time()) // 86400)).fetchone()
    return max(0, DAILY - (row['count'] if row else 0))


def session(request):
    token = request.cookies.get(COOKIE, '')
    if not token:
        return None
    with connect() as db:
        return db.execute('SELECT * FROM sessions WHERE digest=? AND expires>?', (digest('session:' + token), int(time.time()))).fetchone()


@app.get('/session')
async def get_session(request: Request):
    user = session(request)
    return {'available': mail_ready(), 'verified': bool(user), 'email': user['email'] if user else None, 'remaining': remaining(user['account']) if user else DAILY, 'dailyLimit': DAILY}


def send_code(email, code):
    text = f'Your verification code is {code}.\n\nIt expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.\n\nHaolin’s Research Playground'
    if os.getenv('EMAIL_PROVIDER', 'gmail') == 'resend':
        response = httpx.post('https://api.resend.com/emails', headers={
            'Authorization': 'Bearer ' + os.environ['RESEND_API_KEY'],
        }, json={
            'from': os.environ['EMAIL_FROM'], 'to': [email],
            'reply_to': os.getenv('REPLY_TO', 'hwang972@gatech.edu'),
            'subject': 'Your playground verification code', 'text': text,
        }, timeout=15, follow_redirects=False)
        response.raise_for_status()
        if not response.json().get('id'):
            raise RuntimeError('Email provider did not confirm acceptance.')
        return
    message = EmailMessage()
    message['From'] = "Haolin's Research Playground <" + os.environ['SMTP_USER'] + '>'
    message['To'] = email
    message['Reply-To'] = os.getenv('REPLY_TO', 'hwang972@gatech.edu')
    message['Subject'] = 'Your playground verification code'
    message.set_content(f'Your verification code is {code}.\n\nIt expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.\n\nHaolin’s Research Playground')
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=15) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(message)


@app.post('/auth/code')
async def request_code(request: Request):
    if not mail_ready():
        raise HTTPException(503, 'Email verification is not available yet. Explore the examples in the meantime.')
    email, account = email_account((await body(request)).get('email'))
    reserve([('mail-minute:' + account, 60, 1), ('mail-hour:' + account, 3600, 5), ('mail-ip:' + ip_key(request), 3600, 10), ('mail-global', 86400, 100)])
    code = f'{secrets.randbelow(1000000):06d}'
    hashed = digest('code:' + account + ':' + code)
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO codes VALUES (?,?,?,0)', (account, hashed, int(time.time()) + 600))
    try:
        await asyncio.to_thread(send_code, email, code)
    except Exception:
        with connect() as db:
            db.execute('DELETE FROM codes WHERE account=? AND digest=?', (account, hashed))
        raise HTTPException(503, 'Could not send the code. Please try again later.')
    return {'message': 'Code sent. Check your inbox and spam folder.'}


@app.post('/auth/verify')
async def verify(request: Request):
    data = await body(request)
    email, account = email_account(data.get('email'))
    code = data.get('code', '')
    reserve([('verify-ip:' + ip_key(request), 3600, 30)])
    valid = False
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM codes WHERE account=?', (account,)).fetchone()
        if row and row['expires'] > now and row['attempts'] < 5:
            db.execute('UPDATE codes SET attempts=attempts+1 WHERE account=?', (account,))
            valid = isinstance(code, str) and bool(re.fullmatch(r'\d{6}', code)) and hmac.compare_digest(row['digest'], digest('code:' + account + ':' + code))
            if valid:
                db.execute('DELETE FROM codes WHERE account=?', (account,))
                db.execute('DELETE FROM sessions WHERE account=?', (account,))
                db.execute('INSERT INTO sessions VALUES (?,?,?,?)', (digest('session:' + token), account, email, now + SESSION_SECONDS))
    if not valid:
        raise HTTPException(400, 'Invalid or expired code. Request a new code if needed.')
    response = JSONResponse({'verified': True, 'email': email, 'remaining': remaining(account), 'dailyLimit': DAILY, 'available': mail_ready()})
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, secure=True, httponly=True, samesite='strict', path='/')
    return response


@app.post('/auth/logout')
async def logout(request: Request):
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE digest=?', (digest('session:' + request.cookies.get(COOKIE, '')),))
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE, path='/', secure=True, httponly=True, samesite='strict')
    return response


async def compute(payload):
    env = {k: v for k, v in os.environ.items() if k in ('PATH', 'PYTHONPATH', 'LANG')}
    env.update(OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1', MPLCONFIGDIR='/tmp/matplotlib')
    proc = await asyncio.create_subprocess_exec(sys.executable, str(Path(__file__).with_name('compute.py')), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, env=env)
    try:
        output, _ = await asyncio.wait_for(proc.communicate(json.dumps(payload).encode()), timeout=30)
        if proc.returncode:
            raise HTTPException(422, 'Could not compare these maps. Check their format, dimensions and complexity.')
        return json.loads(output)
    except asyncio.TimeoutError:
        raise HTTPException(408, 'Comparison reached the 30-second limit. Try a smaller crop.')
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()


@app.post('/compare')
async def compare(request: Request):
    user = session(request)
    if not user:
        raise HTTPException(401, 'Verify your email before running a comparison.')
    data = await body(request, 6 * 1024 * 1024)
    # Admission and account lock happen before the next await, in one event loop.
    account = user['account']
    if account in active_accounts:
        raise HTTPException(429, 'You already have a comparison running or waiting.')
    if len(active_accounts) >= 4:
        raise HTTPException(503, 'The playground is busy. Please try again shortly.', headers={'Retry-After': '30'})
    p = data.get('params', {})
    if not isinstance(p, dict) or p.get('mode') not in ('default','geom','att') or type(p.get('invert')) is not bool:
        raise HTTPException(400, 'Invalid comparison settings.')
    for key, low, high in [('pixel_size', .01, 100), ('epsilon', 1, 10), ('threshold', 0, 254)]:
        value = p.get(key)
        if type(value) not in (int, float) or not low <= value <= high or (key == 'threshold' and value != int(value)):
            raise HTTPException(400, 'Invalid comparison settings.')
    for key in ('gt', 'test'):
        item = data.get(key)
        if not isinstance(item, dict) or item.get('kind') not in ('png', 'vector') or len(json.dumps(item.get('value')).encode()) > (2800000 if item.get('kind') == 'png' else 2 * 1024 * 1024):
            raise HTTPException(400, 'Invalid map or file exceeds 2 MB.')
    reserve([('job-minute:' + account, 60, 3), ('job-day:' + account, 86400, DAILY), ('job-ip-minute:' + ip_key(request), 60, 10), ('job-ip-day:' + ip_key(request), 86400, 60), ('job-global', 86400, GLOBAL_DAILY)])
    active_accounts.add(account)
    try:
        async with semaphore:
            result = await compute(data)
        return {'result': result, 'remaining': remaining(account)}
    finally:
        active_accounts.discard(account)
