"""Fixed compute subprocess. No email credentials or uploaded files written to disk."""
import contextlib, io, os, resource, sys
from pathlib import Path
resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024**2, 1536 * 1024**2))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'public'))
import matplotlib
matplotlib.use('Agg')
from crasdi.web_runner import run_request
payload = sys.stdin.read(6 * 1024 * 1024 + 1)
if len(payload.encode()) > 6 * 1024 * 1024:
    raise ValueError('Request too large')
with contextlib.redirect_stdout(io.StringIO()):
    result = run_request(payload)
sys.stdout.write(result)
