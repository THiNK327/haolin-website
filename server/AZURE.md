# Azure Container Apps deployment

Keep the website on Cloudflare. Deploy the Python API as one Azure Container App.
The built-in examples do not use Azure and remain available while this is set up.

## 1. Publish the container

The `Publish playground API` GitHub Actions workflow tests the API, builds the
container, smoke-tests it, and publishes it to:

`ghcr.io/think327/haolin-playground-api:<full-git-commit-sha>`

It also updates `latest`, but use the immutable commit tag for Azure deployments.
A push does not automatically deploy a new Azure revision.

On first publication, GitHub creates a private package. Open your GitHub profile
→ Packages → haolin-playground-api → Package settings → Change visibility → Public.
The public image contains application code and Python dependencies, not secrets.
Do not enter an image tag into Azure until the publish workflow succeeds.

## 2. Create private durable storage

In the same `haolin-playground` resource group and region:

1. Create an Azure Storage account with a globally unique lowercase name, such as
   `haolinplayground` plus a short suffix you choose.
2. Choose Standard performance, general-purpose v2, locally redundant storage
   (LRS), and the Hot access tier. Require secure transfer; keep anonymous blob
   access disabled. The API uses the public HTTPS endpoint with authentication.
3. Under Data storage → Containers, create `playground-state` with **Private**
   access. Do not enable anonymous access for this container.
4. Under Security + networking → Access keys, copy a connection string directly
   into an Azure Container App secret named `storage-connection`. Do not put it
   in GitHub source, chat, screenshots, or frontend variables.

The app keeps a bounded SQLite snapshot in the private `auth.sqlite3` blob. Each
transaction loads it into memory and uses an ETag-conditional write to persist
changes. Conflicts and storage outages fail closed with HTTP 503; they never
silently fall back to temporary disk. This is intended for the existing low-volume
limits, not high-throughput or horizontally scaled applications. No uploaded maps
or results are saved in the blob. No SQLite file is opened on Azure Files/SMB.

Deletion of the blob resets sessions and counters. Do not delete it during updates.
Keep blob versioning/backup retention deliberate: retained versions may contain
expired email records. The live database removes expired records on subsequent
rate-limited requests. Private storage, requests, and any logs have their own costs.

## 3. Set up email

In Resend, add and verify `haolinwang.com` by putting its supplied DNS records in
Cloudflare. Create a sending API key restricted to this domain. Add it directly to
an Azure Container App secret named `resend-key`. Do not share the key in chat.

Sender: `Haolin's Research Playground <verify@haolinwang.com>`
Reply-To: `hwang972@gatech.edu`

Resend does not verify visitors itself; the API issues and verifies six-digit
single-use codes. Gmail remains supported with `EMAIL_PROVIDER=gmail` and the
existing SMTP variables, but Resend is the intended Azure setup.

## 4. Configure the Container App

| Setting | Value |
| --- | --- |
| Name | `haolin-playground-api` |
| Workload profile | Consumption |
| Image source | Docker Hub or other registries |
| Image type | Public (after GitHub visibility change) |
| Registry login server | `ghcr.io` |
| Image and tag | `think327/haolin-playground-api:<published-commit-sha>` |
| CPU / memory | Start at 1 vCPU / 2 GiB; reduce only after measuring real maps |
| Command / arguments override | Empty |
| Ingress | Enabled, accepting traffic from anywhere, HTTP, target port 8000 |
| Insecure HTTP | Disabled |
| Minimum replicas | 0 |
| Maximum replicas | 1 |
| Revision mode | Single |
| Health probes | HTTP GET `/healthz` on port 8000 |

The only unauthenticated endpoint is `/healthz`, which returns `{"ok":true}` for
container health checks. All user routes require the website proxy's API key.
The browser calls the same-origin Cloudflare proxy; do not configure public CORS.
Keep exactly one Uvicorn worker (already set in the image) and one replica. Drain
active jobs before changing revisions, since admission/queue state is in memory.

Generate two different random secrets locally (run twice):

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Create Container App secrets `gateway-key` and `auth-secret`. Save them privately.
Configure these environment variables, selecting **Secret reference** where shown:

| Environment variable | Value |
| --- | --- |
| `STATE_BACKEND` | `azure_blob` |
| `AZURE_STORAGE_CONNECTION_STRING` | Secret reference: `storage-connection` |
| `AZURE_STORAGE_CONTAINER` | `playground-state` |
| `CRASDI_API_KEY` | Secret reference: `gateway-key` |
| `AUTH_SECRET` | Secret reference: `auth-secret` |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Secret reference: `resend-key` |
| `EMAIL_FROM` | `Haolin's Research Playground <verify@haolinwang.com>` |
| `REPLY_TO` | `hwang972@gatech.edu` |
| `DAILY_RUN_LIMIT` | `20` |
| `GLOBAL_RUN_LIMIT` | `100` |

If the creation wizard does not offer secret references, create the container app
with ingress disabled, then add its secrets/environment variables and create a
revision before enabling ingress. It will not start successfully without valid
storage and distinct authentication secrets. Do not use a public temporary DB.

Scale-to-zero causes a cold start. A first request may need a retry if startup
exceeds the website proxy's timeout. Keeping min replicas at 1 avoids this but
incurs idle compute charges. A max replica count is not a hard monetary cap.
Use Azure budget alerts and inspect costs; alerts do not automatically stop usage.
Keep logs minimal; never log codes, cookies, request bodies, or secrets.

## 5. Connect Cloudflare and test

Once Azure reports the revision healthy, copy its HTTPS application URL.
In your Cloudflare Worker's runtime secrets set:

- `CRASDI_API_URL`: the Azure HTTPS application URL, without a path.
- `CRASDI_API_KEY`: exactly the value of the Azure `gateway-key` secret.

These are server-side settings, never `NEXT_PUBLIC_` variables. Redeploy if needed
for your Cloudflare settings to take effect. Test the final site:

1. Request a code at an address you own; confirm actual email delivery.
2. Verify the code, run a sample comparison, and check the remaining quota.
3. Restart the Azure revision and verify session and quota persist.
4. Sign out; confirm custom runs again require verification.

Automated tests use mocked email and a local Azure storage emulator. Actual Azure
provisioning, live email delivery, and Cloudflare integration require your accounts.
Cloudflare Turnstile is not included in this deployment yet; server-side email,
IP, calculation, and global rate limits are already enforced.
