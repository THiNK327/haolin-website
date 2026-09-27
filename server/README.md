# Self-hosted playground API

The website now uses this Python API for custom comparisons. Examples are precomputed and stay accessible without sign-in. Until `CRASDI_API_URL` and `CRASDI_API_KEY` are configured on the website, it displays an honest unavailable state; there is no fake verification or browser-compute fallback.

## Deploy on your own server

Use a Linux server with Docker Compose and at least 2 GB RAM available for this service (allow additional RAM for the OS). No automatic scaling is needed. The website remains a separate Cloudflare-compatible Worker build; it is not a plain static Pages upload.

1. Copy `server/env.example` to `server/.env`. Generate **two different** random secrets with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Set `CRASDI_API_KEY` and `AUTH_SECRET` separately. Keep `.env` out of Git.
2. Create a dedicated Gmail mailbox, turn on two-step verification, and create an app password if Google makes that option available. Set `SMTP_USER` to the full Gmail address and `SMTP_PASSWORD` to the app password, not your normal password. This adapter uses Gmail SMTP with verified TLS. `REPLY_TO` defaults to `hwang972@gatech.edu`. The GT address is not impersonated as the sender. OAuth would require a separate adapter if app passwords are unavailable.
3. From the project root run `docker compose -f server/compose.yaml up -d --build`. The API listens only on the server's loopback port 8000. SQLite resides in the persistent `playground-data` volume. Do not delete that volume during upgrades.
4. Point an API subdomain you own at the server and put an HTTPS reverse proxy in front of port 8000. For example, a host-installed Caddy configuration (replace the domain):

   ```caddy
   api.yourdomain.com {
       request_body {
           max_size 6MB
       }
       reverse_proxy 127.0.0.1:8000
   }
   ```

   Allow inbound HTTPS; keep port 8000 private. Do not enable request-body or cookie logging. Normal reverse-proxy traffic logs may retain IPs according to that proxy's settings.
5. Configure the website's **server-side secrets**: `CRASDI_API_URL=https://api.yourdomain.com` and the same `CRASDI_API_KEY`. Neither is a `NEXT_PUBLIC_` variable. The browser calls same-origin `/api/playground/*`; the Worker forwards only supported routes to Python and supplies the secret gateway key. The API rejects requests without it. Never configure the URL to an untrusted host.
6. Deploy the website and verify actual code delivery to your mailbox, successful sign-in, a sample calculation, and sign-out. No real mail was sent during automated tests. Confirm HTTPS cookies work on your final domain before making the site public.

No domain, server account, SMTP credential, or API endpoint has been provisioned by this source update. These are the remaining activation steps. Keep the existing private Site until the independent deployment is checked. The frontend now includes an independent Worker deployment configuration; see the root README for GitHub and Cloudflare setup.

## Limits and operation

- One running calculation and at most three waiting, with one outstanding request per account. **Run exactly one Uvicorn worker and one API replica.** In-memory admission depends on this; a scale-out deployment needs a shared job queue first.
- 30-second subprocess timeout including Python imports; subprocess CPU/address-space limits; one CPU and 2 GB container memory, read-only filesystem, non-root user, dropped capabilities, bounded writable temporary directory.
- 3 submissions/minute and 20/day per account. 10/minute and 60/day per network IP. Global hard budget 100/day. Daily counters reset at midnight UTC. Admission is transactional; failures/timeouts count once admitted. Change `DAILY_RUN_LIMIT` and `GLOBAL_RUN_LIMIT` to tune budgets, and keep the visitor-facing policy copy in sync.
- Network identifiers come from the authenticated frontend proxy's Cloudflare `CF-Connecting-IP` header. Deploy the frontend behind Cloudflare. On another platform, configure a trusted platform IP source first. Missing IPs share one conservative `unknown` budget; browser-supplied forwarding headers are not trusted by the Python service.
- Gmail dots/plus aliases and `googlemail.com` share an account budget. Other aliases or additional mailboxes may represent the same person; the global cap remains authoritative.
- Email: one code per minute, five/hour/address, ten/hour/IP, 100/day total. Code expires after ten minutes, is single-use, and allows five guesses. Verification attempts are additionally capped at 30/hour/IP. Sending failures consume the mail rate allowance and invalidate the failed challenge.
- Sessions last seven days, stored as keyed hashes. Cookies are Secure, HttpOnly, SameSite=Strict, and host-only. Signing in again revokes earlier sessions for that account; signing out revokes the current one. The website checks same-origin POST requests. No CORS access is enabled.
- Maps and results are processed in memory, never written to the database. Compute subprocesses receive no SMTP or authentication secrets. The fixed open-source adapter validates formats, 512×512 dimensions, segment/point counts, foreground coverage and per-file sizes. Incoming JSON bodies are also bounded before parsing at both proxies.
- Emails are stored with active sessions for up to seven days. OTP records expire after ten minutes; counters at their bucket boundary. Expired records are removed on subsequent rate-limited requests. Idle databases may retain expired rows until the next request. Database backups, if enabled by the owner, need their own retention policy. To revoke all sessions and pending codes, rotate `AUTH_SECRET`; this also resets hashed account matching, so do it deliberately.
- Python/website availability failures do not expose credentials or engine tracebacks. The frontend shows a clear unavailable state when unconfigured. No user computation can run without server-verified authentication.

## Verification

Install `server/requirements.txt` and `httpx==0.28.1` in a virtual environment, then run:

```sh
python -m unittest server.test_api -v
```

Tests replace SMTP with a local mock; they exercise the real API/database and original Python computation. Tests never require or send actual email. Live Gmail delivery, Docker deployment and final-domain integration must be checked after credentials/hosting are connected.
