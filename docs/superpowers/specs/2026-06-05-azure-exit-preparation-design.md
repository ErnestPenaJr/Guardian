# Design: Azure-exit preparation (provider-agnostic)

**Date:** 2026-06-05
**Status:** Approved (design)
**Branch:** `feature/postgres-migration-ts-server` (this prep depends on the completed PostgreSQL migration)

## Goal

Make Guardian deployable to *any* provider with minimal Azure lock-in, so the
eventual move off Azure is fast once a provider is chosen — **without committing
to a provider now**. Top immediate priority: the local server runs against the
local PostgreSQL, as a clean documented one-command workflow.

## Context (current Azure footprint)

| Azure service | Role | Provider-neutral replacement |
|---|---|---|
| Azure App Service (Linux `NODE|20-lts`) — `GUARDIAN-STAGING`, `GUARDIAN-MVP` | Hosts Node server (API + static SPA) | Any container host |
| Azure SQL Database (`guardian-dev-db`) | Database | Managed Postgres (app already ported) |
| Azure DevOps Pipelines (`azure-pipelines.yml`, `AzureWebApp@1`, `AzureSP-Dev`) | Build + deploy | Provider-neutral CI (GitHub Actions) + provider deploy stub |
| `web.config`, `staticwebapp.config.json`, `package.production.json` | IIS/Azure config | Not needed by container path |
| Resend (email) | Transactional email | Already provider-agnostic |

Key enabler: the TS server (`server/index.ts`) already serves the built React
SPA via `express.static('dist')` + SPA fallback (`server/index.ts:207`, `:1444`),
so the whole app runs from one Node process → **single portable container**.

## Scope

**In scope (provider-neutral work doable now):**
- Local dev fully on Postgres (one-command), documented.
- A Dockerfile + `.dockerignore` producing one image that serves API + SPA on `$PORT`.
- `.env.example` documenting all required env vars; confirm no Azure-specific code assumptions.
- Quarantine/label Azure-only files; verify container path is independent of them.
- A provider-neutral GitHub Actions CI workflow (build + typecheck + image build; deploy = stub).
- A readiness assessment + provider-neutral cutover runbook with provider-specific blanks.

**Out of scope (deferred):**
- Choosing the provider; executing the actual cutover.
- Merging the PG branch to Azure staging (would break SQL-Server staging — still gated).
- Pre-existing `/api/requests` auth + company-isolation gaps (separate security pass).
- Decommissioning Azure resources (part of the future cutover, not prep).

## Components

### A. Local server on PostgreSQL (top priority; mostly already working)

Current state (verified): `npm run server:dev:pg` builds the server and runs it
against `postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN`
on port 3001; `bun run dev` (Vite :5175) proxies `/api` + `/logout` → :3001.
Bad-credential login returns a clean 401 (login query runs correctly on Postgres).

Deliverables:
- `.env.local` capturing the local Postgres `DATABASE_URL` + dev `JWT_SECRET` (git-ignored).
- A `dev:pg` npm script that runs backend (on PG) + frontend together (via `concurrently`,
  added as a devDependency) so one command brings up the full app on Postgres.
- `LOCAL_DEV_POSTGRES.md`: quickstart — ensure Docker Postgres is up, load
  `postgres/01_schema.sql` + `02_seed.sql` + `03_app_schema_patches.sql`, run `dev:pg`,
  log in. Includes the reload-from-staging refresh step.

Success: a fresh `git checkout` of this branch + one command = full app on local Postgres,
documented; login works with a real seeded user's credentials.

### B. Portability hardening

- **`Dockerfile`** (multi-stage):
  1. builder: `npm ci`, `npm run build` (Vite → `dist/`), `npm run build:server` (tsc → `dist-server/`), `prisma generate`.
  2. runtime: copy `dist/`, `dist-server/`, `node_modules` (prod) + generated Prisma client, `schema.prisma`; `CMD ["node","dist-server/index.js"]`; `EXPOSE` honors `$PORT` (server already reads `process.env.PORT`).
- **`.dockerignore`** (node_modules, dist, dist-server, .git, .env*, postgres/02_seed.sql, etc.).
- **`.env.example`**: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `FRONTEND_URL`.
  Audit `server/**` for any host-specific assumptions (hardcoded hosts/paths); fix to env-driven.
- **Azure-only files** (`web.config`, `staticwebapp.config.json`, `package.production.json`,
  `azure-pipelines*.yml`): keep (current staging depends on them) but document as Azure-specific
  and confirm the container path uses none of them.
- **Verification:** `docker build` succeeds; container run with `-e DATABASE_URL=<local PG over host networking> -e JWT_SECRET=... -e PORT=8080` boots, `/api/health` 200, SPA loads, an authenticated route works.

### C. Database portability (mostly documentation)

Managed Postgres on any provider. Migration mechanism = `scripts/mssql-to-postgres.cjs`
(regenerate `postgres/01_schema.sql` + `02_seed.sql`) + `03_app_schema_patches.sql`.
Prisma stays client-only (no `migrate`/`db push`). The runbook captures connection-string
handling (`?schema=GUARDIAN`) and the load order.

### D. CI/CD readiness (provider-neutral)

A `.github/workflows/ci.yml`: on push/PR — `npm ci`, `npm run build`, `tsc -p tsconfig.server.json`,
run smoke tests, `docker build` (no push). A separate `deploy` job is present but **disabled/stubbed**
with a clearly-labeled `# TODO(provider): set registry + deploy target` block. `azure-pipelines.yml`
is left untouched so Azure staging keeps deploying until cutover.

### E. Readiness assessment + cutover runbook

`docs/azure-exit/README.md` (or similar): 
- **Lock-in inventory**: every Azure-specific file/service and its neutral replacement (the table above, expanded).
- **Required env/secrets**: the full list with descriptions and where each is set today.
- **Provider-neutral cutover runbook**: ordered steps — provision managed Postgres → load schema/seed/patches →
  build & push image → set env/secrets → deploy container → point DNS → smoke test → decommission Azure —
  with provider-specific blanks (compute service, registry, secrets store, DNS).

## Risks / notes

- The PG branch must NOT deploy to Azure staging (SQL Server). All prep stays on the branch; CI deploy is stubbed.
- `concurrently` is a new devDependency — minimal, dev-only.
- Container must include the generated Prisma client + correct query-engine binary for the runtime base image (use a Debian-based node image matching `binaryTargets`).
- Secrets: `.env.local`/`.env*` stay git-ignored; `.env.example` carries names only, no values.

## Success criteria

- One command runs the full app locally on Postgres; documented; login works.
- `docker build` produces an image that serves API + SPA against an arbitrary `DATABASE_URL`, verified locally.
- `.env.example` + CI workflow exist; Azure-only files are documented and unneeded by the container path.
- A cutover runbook exists that a provider choice can be dropped into.
- Azure staging deploy path (`azure-pipelines.yml`, legacy SQL-Server servers) remains untouched.
