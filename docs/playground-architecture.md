# Playground extension guide

## What is live, and what is deliberately dormant

The website stays static on its existing Cloudflare deployment. No Railway project, paid service, account system, database, upload endpoint, or verification provider is provisioned by this change. The existing CRASDI examples, stored results, comparison visualization, and exports remain independent of all future server features.

- `/playground`: catalog generated from `data/playground.ts`.
- `/playground/[tool]`: statically generated page for each registered tool.
- CRASDI: examples available; custom inputs planned.
- Lane marking and alligator cracking: clearly labeled planned entries, without invented demonstrations or results.

## Two independent modes

Each tool declares `example: available | planned | hidden` and `interactive.status: available | planned | hidden`. Set an unneeded mode to `hidden`; one-mode and two-mode tools share the same page. `planned` displays an honest explanation, not a working-looking upload form. Examples are lazy-loaded locally and are retained when switching modes. An interactive failure never silently substitutes a precomputed example for a user's analysis.

## Add a tool

1. Add its ID, description, category, and mode statuses to `data/playground.ts`. Its catalog card and static URL follow automatically; do not add a route per tool.
2. Add the implemented example and/or workspace components to `components/playground/modules.ts`. Use lazy imports for substantial modules. `WorkspaceProps` supplies a tool ID and a shared `run` function; a browser-only workspace can compute locally instead.
3. Mark only genuinely implemented modes `available`. An absent workspace fails closed even if its flag is accidentally changed.
4. Run `pnpm check`, `node --experimental-strip-types scripts/check-playground.mjs`, `pnpm build`, and `pnpm deploy:check`. The existing browser workflow also checks examples, keyboard navigation, mobile layouts, and entry verification.

## User-input verification comes first

The required visitor journey is:

`Choose Try Your Own Data -> entry check -> optional verification -> workspace -> inputs/uploads -> silent operational checks -> computation -> results`

`EntryGate` does not mount upload or parameter-input components before access is granted. It supports an open entry decision without prompting and a verification decision with a registered provider. A missing provider, denied decision, malformed response, network error, or stale request cannot unlock the workspace. Completing a verification UI triggers a fresh backend check; it does not locally grant permission.

Verification UIs (email, login, challenge, invitation, or another method) are future adapters in `verificationProviders`. No provider is implemented or enabled now. Keep prompts at entry, not after the visitor uploads files. A quota or processing rejection can be displayed afterward without introducing a surprise identity form. Preserve input state for recoverable errors. For expired sessions, prefer silent renewal; when renewal is impossible, retain inputs and offer an explicit return to the entry step, not a modal verification demand inside the upload workflow.

Examples remain outside this gate. Browser-only, public tools can use an open local entry decision. Every **server** workspace checks the backend even when its initial policy is open: changing a client flag is not authorization.

## Reserved Railway contract (not deployed)

`lib/playground/config.ts` has an intentionally empty `apiBaseUrl`. Later, configure one HTTPS backend origin. No secrets belong in this public file. The transport uses credentials, timeouts, cancellation, JSON-response validation for access checks, and bounded error messages. It does not set a multipart Content-Type manually.

Proposed contract for the future backend:

- `GET /api/v1/access?tool=crasdi`, before any upload, returns one of:
  - `{ "status": "allowed" }`
  - `{ "status": "verification-required", "method": "email" }`
  - `{ "status": "denied", "message": "Daily usage limit reached." }`
- `POST /api/v1/tools/crasdi/run` accepts a tool-specific multipart request and returns a tool-specific result. Workspaces own input/result validation and presentation; the shared transport returns unknown data, not an assumed CRASDI result.

These paths are a frontend integration contract, not existing endpoints. Adapt the legacy `server/` code deliberately rather than exposing it unchanged. For lengthy calculations, evolve the run response to a job ID and add status/cancellation endpoints; the current browser timeout does **not** stop server computation by itself.

## Backend requirements before launch

The frontend gate is a user-experience boundary only. Railway must independently enforce authorization and quotas on every protected request, including direct API calls. Use secure sessions, appropriate cookie settings, a strict frontend-origin allowlist, and CSRF protection for credentialed state changes. CORS alone is not authorization. Check capacity/quota at entry when practical, then again atomically at run time. Enforce file count/byte limits, decoded image dimensions, file type validation, safe temporary files, processing timeouts, and concurrency/job limits. Do not silently downgrade a verification requirement when the service fails. Keep verification prompts out of the post-upload processing path.

Do not deploy the server just to enable a registry flag. Add and test the actual workspace, backend contract, operating limits, and any required verification provider together. Keep the example mode enabled independently throughout.
