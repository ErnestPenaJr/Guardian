# Azure-Exit Readiness Assessment & Cutover Runbook

> Generated: 2026-06-05 — branch `feature/postgres-migration-ts-server`  
> Status: **pre-cutover** — PG branch unmerged; do NOT deploy to SQL-Server Azure staging.

---

## 1. Lock-in Inventory

Every Azure-specific asset, its provider-neutral replacement, and whether the
source file is safe to delete **after** cutover completes.

| Azure Asset | Provider-Neutral Replacement | Delete-after-cutover? | Notes |
|---|---|---|---|
| Azure App Service `GUARDIAN-STAGING` (Linux, NODE\|20-lts) | Any OCI-compatible container host (AWS App Runner/ECS, GCP Cloud Run, Render, Fly.io, Railway, etc.) | N/A — Azure resource, not a file | Decommission after DNS cutover + smoke test pass |
| Azure App Service `GUARDIAN-MVP` (Linux, NODE\|20-lts) | Same container host | N/A — Azure resource | Decommission after cutover |
| Azure SQL `guardian-dev-db` (SQL Server) | Managed PostgreSQL (any provider) | N/A — Azure resource | Migrate data via `scripts/mssql-to-postgres.cjs` before decommission |
| Azure DevOps pipeline `azure-pipelines.yml` | `.github/workflows/ci.yml` (this repo) | **Yes** — `azure-pipelines.yml` | Safe to delete after CI is green on new provider |
| Azure DevOps pipeline `azure-pipelines-staging.yml` | Same CI workflow | **Yes** — `azure-pipelines-staging.yml` | Safe to delete after cutover |
| Azure DevOps pipeline `azure-pipelines-1.yml` | Same CI workflow | **Yes** — `azure-pipelines-1.yml` | Safe to delete after cutover |
| IIS `web.config` (iisnode + static-file rules) | Express static middleware in `server/index.ts` handles SPA + assets | **Yes** — `web.config` | Container serves everything; IIS not used |
| `staticwebapp.config.json` (Azure Static Web Apps routing) | Not needed — container serves SPA from `dist/` | **Yes** — `staticwebapp.config.json` | Only relevant to Azure SWA deployments |
| `package.production.json` (forces `"type":"commonjs"` for IIS/iisnode) | Not needed — container runs the compiled TS server (`dist-server/index.js`) | **Yes** — `package.production.json` | CommonJS compat was an IIS/iisnode concern; container runs Node.js directly |
| Legacy `server.cjs` (dev CJS Express server) | `server/index.ts` → `dist-server/index.js` (TS server, compiled) | **Yes** — `server.cjs` | All new endpoints live only in the TS server |
| Legacy `server.js` (production-deployed CJS copy) | TS server in container | **Yes** — `server.js` | Pipeline artifact; not used by container |
| Legacy `server-production.js` (pipeline source for `server.js`) | TS server in container | **Yes** — `server-production.js` | Pipeline artifact; not used by container |

**Do not delete any of the "Yes" files until the cutover smoke tests pass and
the Azure resources are confirmed decommissioned.**

---

## 2. Required Env Vars / Secrets

All variables consumed by the TS server (`server/**`). "Set today" = Azure App
Service Application Settings. "Goes in" = provider secret store (GitHub
Actions secrets, AWS Secrets Manager, GCP Secret Manager, Render env vars, etc.).

| Variable | Required? | Description | Set today in Azure? | Goes in provider secret store |
|---|---|---|---|---|
| `DATABASE_URL` | **REQUIRED** | PostgreSQL connection string. Format: `postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=GUARDIAN&connection_limit=30&pool_timeout=10`. The `?schema=GUARDIAN` parameter is mandatory — all tables live in the `GUARDIAN` schema. | Azure SQL (mssql) string | Postgres connection string for new managed DB |
| `JWT_SECRET` | **REQUIRED** | Signs all JWT tokens. Use a random 32+ byte hex string. Must stay stable — rotating it invalidates all active sessions. | Yes | Yes |
| `RESEND_API_KEY` | **REQUIRED AT STARTUP** | Resend transactional email API key (`re_…`). The `resend` npm package **throws at module import** if this is absent — the server will not start without it. | Yes (or `SMTP_PASSWORD`) | Yes |
| `SMTP_PASSWORD` | Optional (legacy alias) | Accepted as a fallback if `RESEND_API_KEY` is not set. Set one or the other; `RESEND_API_KEY` takes precedence. | May be set instead of above | Only needed if `RESEND_API_KEY` is not set |
| `JWT_EXPIRES_IN` | Optional | Token lifetime (jsonwebtoken format, e.g. `"24h"`). Defaults to `"24h"` if unset. | Maybe | Recommended to set explicitly |
| `PORT` | Optional | TCP port Express listens on. Defaults to `3001`. Most container platforms inject `PORT` automatically. | 3001 (via App Service) | Usually auto-injected; confirm with provider |
| `NODE_ENV` | Optional | Set to `"production"` in hosted deployments. | Yes | Yes |
| `FRONTEND_URL` | Optional | Base URL used to build links in emails (no trailing slash). E.g. `https://your-domain.example`. | Yes | Yes |
| `EMAIL_FROM` | Optional | "From" address for outbound emails. Defaults to `support@shieldlytics.com`. | Maybe | Recommended |
| `EMAIL_LOGO_URL` | Optional | Logo image URL embedded in email HTML. Defaults to `https://shieldlytics.com/logo.png`. | Maybe | Optional |
| `ERROR_NOTIFY_EMAIL` | Optional | Server-level unhandled errors are emailed here. Falls back to `EMAIL_FROM` if unset. | Maybe | Optional |

> **Critical:** `RESEND_API_KEY` is not a "nice to have" — omitting it causes
> a hard crash at startup before any request is handled.

---

## 3. Database Portability

### PostgreSQL — provider-agnostic

The Postgres path is entirely provider-agnostic. Any managed Postgres service
works (AWS RDS, GCP Cloud SQL, Supabase, Render Postgres, Neon, Railway, etc.)
provided the server is reachable from the container host network.

### Schema & data load order

Apply SQL files in this exact order against a fresh database:

1. `postgres/01_schema.sql` — DDL: all tables, indexes, constraints in the
   `GUARDIAN` schema. Re-generated from the MSSQL source by
   `scripts/mssql-to-postgres.cjs`.
2. `postgres/02_seed.sql` — reference/lookup data (field types, roles, etc.).
   **This file is git-ignored** because it contains PII from the dev database.
   Re-generate with `node scripts/mssql-to-postgres.cjs` against a live MSSQL
   source, or build a clean synthetic seed for greenfield deployments.
3. `postgres/03_app_schema_patches.sql` — additive patches applied after the
   generated schema (e.g. the `VALIDATION` column on `FIELDS`, other
   migration-era additions). Always apply this after `01` + `02`.

### Schema parameter

`DATABASE_URL` **must** include `?schema=GUARDIAN` (or
`&schema=GUARDIAN` if other params precede it). Prisma uses this to scope all
queries to the `GUARDIAN` schema.

### Prisma usage

Prisma is used as a **client-only** query interface — `npx prisma generate`
produces the typed client from `prisma/schema.prisma`. **Never run
`prisma migrate` or `prisma db push`** in this project; schema management is
handled by the SQL files above.

---

## 4. Container

### `Dockerfile` summary

- **Multi-stage build**: `node:20-bookworm` builder → `node:20-bookworm-slim`
  runtime.
- **Single image**: serves both the Express API and the compiled React SPA
  (`dist/`) on `$PORT` (default 3001).
- **Build sequence inside image**:
  1. `npm ci --ignore-scripts` (plain `npm ci` fails — `postinstall` runs
     build before source exists)
  2. `npx prisma generate`
  3. `npm run build` (Vite → `dist/`)
  4. `npm run build:server` (tsc → `dist-server/`)
- **Image size**: ~250 MB.
- **SPA routing**: the TS server's catch-all route serves `dist/index.html`
  for non-API paths — no separate static CDN needed.

### Local verification (completed 2026-06-05)

The container was verified locally against a host-side Postgres instance:

```bash
docker build -t guardian:ci .
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="postgresql://USER:PASS@host.docker.internal:5433/postgres?schema=GUARDIAN" \
  -e JWT_SECRET="..." \
  -e RESEND_API_KEY="re_..." \
  -p 3001:3001 \
  guardian:ci
```

Endpoints verified: `/api/health` → 200, SPA root `/` → 200,
`/api/requests` → 200.

> **Note on `host.docker.internal`**: this is a Docker Desktop / Linux
> `--add-host` convention for reaching the host machine from inside a
> container. In production the container connects to a managed Postgres over
> its normal hostname — no special host mapping is needed.

---

## 5. Provider-Neutral Cutover Runbook

Work through this checklist top-to-bottom. Items marked `<BLANK>` require a
provider decision before they can be filled in.

### Pre-cutover (can do before maintenance window)

- [ ] **Provision managed Postgres** at `<provider>` (RDS, Cloud SQL, Supabase, Render, Neon, …)
- [ ] **Load database**:
  - [ ] Apply `postgres/01_schema.sql`
  - [ ] Apply `postgres/02_seed.sql` (re-generate from MSSQL source if needed; file is PII-sensitive / git-ignored)
  - [ ] Apply `postgres/03_app_schema_patches.sql`
  - [ ] Verify row counts in key tables (`GUARDIAN.USERS`, `GUARDIAN.FORMS`, `GUARDIAN.REQUESTS`)
- [ ] **Resolve outstanding issues** in `docs/superpowers/notes/2026-06-05-pg-repair-flags-for-review.md` (see Section 6)
- [ ] **Build & push container image** to `<registry>` (ECR, GCR, Docker Hub, GHCR, …):
  ```bash
  docker build -t <registry>/guardian:<tag> .
  docker push <registry>/guardian:<tag>
  ```
- [ ] **Configure secrets** in `<secret store>`:
  - [ ] `DATABASE_URL` → new Postgres connection string (include `?schema=GUARDIAN&connection_limit=30&pool_timeout=10`)
  - [ ] `JWT_SECRET` → same value as current Azure App Service config (session continuity)
  - [ ] `RESEND_API_KEY` → same value (REQUIRED — server will not start without it)
  - [ ] `NODE_ENV=production`
  - [ ] `FRONTEND_URL` → new domain
  - [ ] Optional: `JWT_EXPIRES_IN`, `EMAIL_FROM`, `EMAIL_LOGO_URL`, `ERROR_NOTIFY_EMAIL`
- [ ] **Deploy container** to `<compute>` (App Runner, Cloud Run, Render service, Fly app, …)
  - [ ] Set `PORT` or confirm provider injects it
  - [ ] Confirm container starts without crash (check startup logs for Resend init)

### Smoke test (new host, before DNS cut)

- [ ] `GET <new-host>/api/health` → `{ "status": "ok", ... }`
- [ ] `POST <new-host>/api/login` with valid credentials → JWT returned
- [ ] `GET <new-host>/api/requests` (authenticated) → array response, correct company isolation
- [ ] SPA root `GET <new-host>/` → React app loads, no console errors
- [ ] Send a test email (password reset or invite) → arrives via Resend

### DNS cutover

- [ ] **Point DNS** `<domain>` → `<new host>` (A record or CNAME depending on provider)
- [ ] Wait for TTL propagation; verify with `dig <domain>`
- [ ] Repeat smoke tests against the production domain

### Post-cutover monitoring (first 24h)

- [ ] Monitor application logs for errors (`/api/requests` auth warnings, DB connection pool exhaustion)
- [ ] Monitor Resend dashboard for email delivery failures
- [ ] Confirm no cross-company data leaks (see Section 6 pre-conditions)
- [ ] Confirm `/api/health` stays green

### Azure decommission (only after 24h clean monitoring)

- [ ] Decommission Azure App Service `GUARDIAN-STAGING`
- [ ] Decommission Azure App Service `GUARDIAN-MVP`
- [ ] Decommission Azure SQL `guardian-dev-db`
- [ ] Disable / archive Azure DevOps pipeline(s)
- [ ] Delete Azure-only source files (see Section 1 lock-in table):
  - [ ] `azure-pipelines.yml`, `azure-pipelines-staging.yml`, `azure-pipelines-1.yml`
  - [ ] `web.config`
  - [ ] `staticwebapp.config.json`
  - [ ] `package.production.json`
  - [ ] `server.cjs`, `server.js`, `server-production.js`

---

## 6. Outstanding Issues Before Production Cutover

> Full details: [`docs/superpowers/notes/2026-06-05-pg-repair-flags-for-review.md`](../superpowers/notes/2026-06-05-pg-repair-flags-for-review.md)

### SECURITY — must fix before any public production cutover

These issues predate the Postgres migration (present in the original TS server
on the MSSQL branch). They were identified during the PG migration review and
flagged but intentionally not fixed in this branch (out of scope for a DB
port):

1. **`/api/requests` routes have no `requireAuth`** — `GET /`, `GET /:id`,
   `POST /`, `PUT /:id`, `DELETE /:id`, `/:id/assign`, `/:id/start`,
   `/:id/complete`, `/assigned/me`, `/:id/progress` in
   `server/routes/requests.ts` are all reachable without a JWT. Unauthenticated
   callers can read and mutate request data.

2. **No company-data isolation on the `/api/requests` list query** — the
   list endpoint returns requests across ALL companies (missing
   `WHERE COMPANY_ID = ...`). This violates the project's core multi-tenant
   security requirement.

3. **`auth.ts` login interpolates email into `$queryRawUnsafe`** — only
   quote-escaped, not parameterized. The Zod `.email()` validator here has no
   length cap. Low exploitation risk given format constraints, but should be
   hardened.

4. **`jafarPurge` LIKE search doesn't escape `%`/`_` wildcards** — causes
   over-broad matches (not injection); gated by `requireJafar` so impact is
   limited.

**These must be resolved in a dedicated security-hardening PR before this
branch is merged to a production-facing environment.**

### Schema-drift repairs needing validation

During the PG migration, several routes were repaired to match the actual
`GUARDIAN` schema (columns that the TS server referenced didn't exist). Each
repair is a behavior/API change that needs user-facing validation:

- **`roles.ts`**: `GET /api/roles/:id` now returns permissions as string keys
  (e.g. `["home.requestQueue"]`) instead of integer IDs. Any frontend code
  reading numeric permission IDs will break.

- **`external.ts`** (`/api/external/*`): Column remaps in `NOTICES` and
  `NOTICE_RESPONSES`; form-value writes now create a `FORMS_INSTANCE` row
  before inserting values. Requires a real external-user fixture to runtime-test
  (the `requireExternalUser` middleware blocks normal-user testing).

- **`workflow.ts`**: Routes reference `WORKFLOW_STEPS` which does not exist in
  the schema. The router is not mounted in `index.ts` (dead code). Confirm
  whether workflow routes are intended to ship; if yes, the table must be
  designed; if no, delete the file.

- **`subpoena-riders.ts`**: `IS_PII` relocated from `GUARDIAN.FIELDS` (no
  such column) to `GUARDIAN.FORMS_FIELDS.IS_PII`. Confirm join semantics match
  intended PII gating.

### PG branch merge gate

The `feature/postgres-migration-ts-server` branch is unmerged. It **must not**
be deployed to the SQL-Server Azure staging environment (`guardian-staging.azurewebsites.net`)
— doing so would corrupt production data. The branch should only be deployed to
a fresh Postgres-backed host.
