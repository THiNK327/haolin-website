"""Run with: python -m unittest server.test_api -v (no real email sent)."""
import asyncio, json, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import httpx

os.environ.setdefault('CRASDI_API_KEY', 'test-gateway-' + 'a' * 40)
os.environ.setdefault('AUTH_SECRET', 'test-auth-' + 'b' * 40)
os.environ.setdefault('SMTP_USER', 'test@example.com')
os.environ.setdefault('SMTP_PASSWORD', 'test-only')
from server import app as api

class APITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        api.DB = str(Path(self.tmp.name) / 'db.sqlite')
        api.semaphore = asyncio.Semaphore(1)
        api.active_accounts.clear()
        self.life = api.lifespan(api.app)
        await self.life.__aenter__()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url='https://test', headers={'x-api-key': api.API_KEY, 'x-playground-client-ip': '192.0.2.1'})
        self.sent = []
        self.mail = patch.object(api, 'send_code', lambda e,c:self.sent.append((e,c)))
        self.mail.start()

    async def asyncTearDown(self):
        self.mail.stop()
        await self.client.aclose()
        await self.life.__aexit__(None,None,None)
        self.tmp.cleanup()

    async def login(self, email='visitor@example.com'):
        r=await self.client.post('/auth/code',json={'email':email})
        self.assertEqual(r.status_code,200,r.text)
        code=self.sent[-1][1]
        r=await self.client.post('/auth/verify',json={'email':email,'code':code})
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn('HttpOnly',r.headers['set-cookie'])
        self.assertIn('Secure',r.headers['set-cookie'])
        return code

    def payload(self):
        example=json.loads((Path(__file__).resolve().parents[1]/'data/examples.json').read_text())['cases'][0]
        return {'gt':{'kind':'vector','value':example['gt']},'test':{'kind':'vector','value':example['test']},'params':{'mode':'default','pixel_size':4,'epsilon':5,'threshold':127,'invert':False}}

    async def test_auth_and_replay_logout(self):
        r=await self.client.get('/session',headers={'x-api-key':'wrong'})
        self.assertEqual(r.status_code,401)
        self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,401)
        code=await self.login()
        self.assertEqual((await self.client.post('/auth/verify',json={'email':'visitor@example.com','code':code})).status_code,400)
        self.assertTrue((await self.client.get('/session')).json()['verified'])
        await self.client.post('/auth/logout')
        self.assertFalse((await self.client.get('/session')).json()['verified'])

    async def test_expiry_guess_limit_and_resend(self):
        await self.client.post('/auth/code',json={'email':'visitor@example.com'})
        real=self.sent[-1][1]
        self.assertEqual((await self.client.post('/auth/code',json={'email':'visitor@example.com'})).status_code,429)
        for _ in range(5):
            self.assertEqual((await self.client.post('/auth/verify',json={'email':'visitor@example.com','code':'x'})).status_code,400)
        self.assertEqual((await self.client.post('/auth/verify',json={'email':'visitor@example.com','code':real})).status_code,400)
        with api.connect() as db: db.execute('UPDATE codes SET attempts=0,expires=0')
        self.assertEqual((await self.client.post('/auth/verify',json={'email':'visitor@example.com','code':real})).status_code,400)

    async def test_email_alias_budget_and_mail_failure(self):
        self.assertEqual(api.email_account('my.name+tag@gmail.com')[1],api.email_account('myname@googlemail.com')[1])
        with patch.object(api,'send_code',side_effect=RuntimeError('private SMTP detail')):
            r=await self.client.post('/auth/code',json={'email':'visitor@example.com'})
        self.assertEqual(r.status_code,503)
        self.assertNotIn('private SMTP',r.text)
        with api.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM codes').fetchone()[0],0)

    async def test_real_comparison_and_quota(self):
        await self.login()
        r=await self.client.post('/compare',json=self.payload())
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['result']['scores']['CRASDI'],0.1343)
        self.assertEqual(r.json()['remaining'],19)
        with patch.object(api,'compute',return_value={'scores':{}}):
            for _ in range(2):self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,200)
            self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,429)
        with api.connect() as db:
            db.execute("UPDATE counters SET count=20 WHERE name LIKE 'job-day:%'")
            db.execute("DELETE FROM counters WHERE name LIKE 'job-minute:%'")
        self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,429)

    async def test_queue_and_atomic_budget(self):
        await self.login()
        api.active_accounts.update(['a','b','c','d'])
        self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,503)
        self.assertEqual((await self.client.get('/session')).json()['remaining'],20)
        api.active_accounts.clear()
        with patch.object(api,'GLOBAL_DAILY',1),patch.object(api,'compute',return_value={}):
            self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,200)
            self.assertEqual((await self.client.post('/compare',json=self.payload())).status_code,429)
        self.assertEqual((await self.client.get('/session')).json()['remaining'],19)

    async def test_actual_concurrency_and_queue(self):
        clients=[]
        for i in range(5):
            email=f'queue{i}@example.com'
            token=f'token-{i}'
            _,account=api.email_account(email)
            with api.connect() as db:
                db.execute('INSERT INTO sessions VALUES (?,?,?,?)',(api.digest('session:'+token),account,email,int(api.time.time())+60))
            clients.append(httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app),base_url='https://test',headers={'x-api-key':api.API_KEY,'x-playground-client-ip':'192.0.2.1','cookie':api.COOKIE+'='+token}))
        gate=asyncio.Event();entered=asyncio.Event();running=0;maximum=0
        async def slow(payload):
            nonlocal running,maximum
            running+=1;maximum=max(maximum,running);entered.set()
            await gate.wait()
            running-=1
            return {}
        tasks=[]
        try:
            with patch.object(api,'compute',side_effect=slow):
                for i in range(4):
                    tasks.append(asyncio.create_task(clients[i].post('/compare',json=self.payload())))
                    for _ in range(100):
                        if len(api.active_accounts)==i+1:break
                        await asyncio.sleep(.01)
                await asyncio.wait_for(entered.wait(),1)
                self.assertEqual(len(api.active_accounts),4)
                self.assertEqual((await clients[4].post('/compare',json=self.payload())).status_code,503)
                self.assertEqual((await clients[0].post('/compare',json=self.payload())).status_code,429)
                gate.set()
                self.assertTrue(all(r.status_code==200 for r in await asyncio.gather(*tasks)))
                self.assertEqual(maximum,1)
                self.assertFalse(api.active_accounts)
        finally:
            gate.set()
            await asyncio.gather(*tasks,return_exceptions=True)
            for client in clients:await client.aclose()

    async def test_body_and_input_validation(self):
        await self.login()
        self.assertEqual((await self.client.post('/auth/code',content='x'*5000)).status_code,413)
        p=self.payload();p['params']['threshold']=1.5
        self.assertEqual((await self.client.post('/compare',json=p)).status_code,400)
        p=self.payload();p['gt']['value']['properties']['image']['height_px']=999
        self.assertEqual((await self.client.post('/compare',json=p)).status_code,422)
        with patch.dict(os.environ,{'SMTP_PASSWORD':''}):
            self.assertFalse((await self.client.get('/session')).json()['available'])
            self.assertEqual((await self.client.post('/auth/code',json={'email':'visitor@example.com'})).status_code,503)

if __name__=='__main__':unittest.main()
