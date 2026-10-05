# Haolin Wang — Website and Research Playground

A static web CV and modular research Playground, using the existing **Cloudflare Workers Static Assets** deployment with GitHub as the source of truth. It does not depend on ChatGPT Sites for builds, sign-in, or deployment.

- `/` — the existing profile, research, skills, experience, headshot, and CV.
- `/playground` — a data-driven catalog of research tools.
- `/playground/crasdi` — the existing example explorer, plus an independently planned custom-data mode.
- `/playground/lane-marking` and `/playground/alligator-cracking` — clearly labeled planned tools.
- `server/` — optional legacy backend source, not connected or deployed by this update. Container publishing remains manual only.

**No server, uploads, verification provider, or new paid infrastructure is enabled.** Examples keep working without any of them.

## Develop and check

Use Node 24 and the pnpm version pinned in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm check
node --experimental-strip-types scripts/check-playground.mjs
pnpm build
pnpm deploy:check
```

The last command validates the static asset deployment without publishing it. GitHub Actions also runs browser checks for the catalog, tool pages, original CRASDI scores/exports, responsive layouts, profile navigation, and verification-before-upload behavior in a temporary test app. That test app is not a production route.

## Add tools, modes, and later Railway support

See [the Playground extension guide](docs/playground-architecture.md).

The registry is `data/playground.ts`; component adapters are in `components/playground/modules.ts`. Each tool may expose **Explore Example**, **Try Your Own Data**, or both. A mode can be available, planned, or hidden. Examples never get replaced by live processing.

The shared `EntryGate` reserves optional verification at the start of interactive mode, before any upload or data entry. No verification service is enabled now. The future backend remains responsible for real authorization and silent operating limits on every request; frontend flags are not security controls.

`lib/playground/config.ts` deliberately has an empty API origin. The proposed Railway API contract is documented, not deployed. Do not expose the legacy backend unchanged or enable interactive status without its real workspace and backend implementation.

## Existing deployment

Keep the current Cloudflare/GitHub connection and production branch `main`. The repository root, pinned dependencies, build command `pnpm run build`, and deploy command `pnpm run deploy` are unchanged. The build exports to `dist/client`; `cloudflare-static.jsonc` publishes those static files without a Python process or request-time application server.

Use pull requests and the website checks before merging. Cloudflare's connected build runs separately from GitHub checks. This update does not change domain routes, account access, DNS, secrets, or Azure resources. Edits to an earlier private Sites project do not automatically sync to this repository.

## CRASDI examples and provenance

All five scenarios retain three scoring modes, four matching radii (1, 3, 5, 10 pixels), and three resolutions (2, 4, 8 mm/pixel). Scores and matching evidence are precomputed by the pinned original implementation; opacity only affects visualization. Changing modes on the tool page preserves the selected example settings.

To regenerate example data, install the Python dependencies from `server/requirements.txt` in a local virtual environment and run `python scripts/generate-examples.py`. The website serves the generated JSON; it does not run Python for visitors.

CRASDI is pinned to upstream commit `9aba96fa250bb98887d1e6cca463d645aa744715` in [THiNK327/CRASDI](https://github.com/THiNK327/CRASDI). Its unmodified research implementation and MIT license are included under `public/crasdi/`. `web_runner.py` is the bounded adapter. Examples are synthetic teaching cases, not experimental results. The local summaries use computed matching evidence; no AI service is connected.

The site uses the owner-supplied headshot and academic CV. No license for those personal materials is granted by the CRASDI license.
