# Haolin Wang — Website and Research Playground

A static web CV and interactive, example-only CRASDI playground. This repository is prepared for independent hosting on **Cloudflare Workers Static Assets**, with GitHub as the source of truth. It does not depend on ChatGPT Sites for builds, sign-in, or deployment.

- `/` — profile, research, skills, experience, headshot and CV.
- `/playground` — selectable examples with precomputed results for scoring mode, matching radius, and resolution. No sign-in, uploads, or calculation server.
- `server/` — optional backend code retained for future development; not connected to the website. Container publishing is manual only.

## Develop

Use Node 24 and the pnpm version pinned in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm check
pnpm build
pnpm deploy:check
```

The last command validates the static asset deployment without publishing it. GitHub Actions checks the frontend build. The optional backend has a separate manual workflow.

## Connect GitHub to Cloudflare

1. Create a **private** GitHub repository named `haolin-website` under your own account, initially empty (no generated README or license). Push this source to its `main` branch. The website can eventually be public while its source repository remains private.
2. In Cloudflare, open **Workers & Pages**, create a Worker from your GitHub repository, and grant Cloudflare access only to this repository.
3. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Worker name | `haolin-website` |
   | Production branch | `main` |
   | Root directory | Repository root |
   | Build command | `pnpm run build` |
   | Deploy command | `pnpm run deploy` |
   | Node version | `24` |

   Cloudflare's install step should use the checked-in `pnpm-lock.yaml` and `packageManager` pin. The Worker name must match `cloudflare-static.jsonc`. The build exports HTML, JavaScript, and assets to `dist/client`. The deploy script publishes only these static files through Cloudflare Workers Static Assets; no Worker script or Python service runs per request.
4. **Access is deliberately disabled initially:** `workers_dev` and preview URLs are off, and no custom route is configured. This prevents migration from silently making the current private site public. To review privately, configure Cloudflare Access on the intended hostname before enabling that route. To launch publicly later, explicitly enable the `workers.dev` endpoint or add your chosen custom domain.
5. After connection, pushes to `main` rebuild and deploy automatically. The GitHub workflow supplies separate check results; Cloudflare builds do not automatically wait for them. Use pull requests and required checks on `main` if you want a merge gate.

If using Git locally, add the **actual repository URL returned by GitHub** as your remote and push `main`. Do not change the remote on the old Sites checkout. This migration has its own checkout/branch.

## Example-only playground

The live playground needs no API secrets, email provider, or Python server. All five scenarios support three scoring modes, four matching radii (1, 3, 5, 10 pixels), and three resolutions (2, 4, 8 mm/pixel). Scores and matching evidence are precomputed by the pinned original implementation; opacity only affects visualization.

To regenerate the example data, install the Python dependencies from `server/requirements.txt` in a local virtual environment and run `python scripts/generate-examples.py`. The website serves the generated JSON; it does not run Python for visitors.

The API proxy and sign-in component have been removed. Optional backend source and deployment guides remain in `server/` for future use. Reintroducing custom comparisons will require deliberately restoring the UI/proxy and configuring hosting. Adding API secrets alone will not enable it. Existing Azure resources are managed separately and are not stopped or deleted by this website update.

## Update the site

Use this repository as the canonical source after migration. Content lives in `data/profile.ts`, `app/page.tsx`, and the playground components; public files are under `public/`. Make changes, run checks, merge to `main`, and let Cloudflare deploy. Edits to the original private Sites project do not automatically sync here.

## Research provenance

CRASDI is pinned to upstream commit `9aba96fa250bb98887d1e6cca463d645aa744715` in [THiNK327/CRASDI](https://github.com/THiNK327/CRASDI). Its unmodified research implementation and MIT license are included under `public/crasdi/`. `web_runner.py` is the bounded adapter. Examples are synthetic teaching cases, not experimental results. The local summaries use computed matching evidence; no AI service is connected.

The site uses the owner-supplied headshot and academic CV. No license for those personal materials is granted by the CRASDI license.
