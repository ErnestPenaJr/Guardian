# Azure-Exit Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Guardian provider-agnostic and migration-ready off Azure — starting with a one-command local app on PostgreSQL, then a portable container, provider-neutral CI, and a cutover runbook — without choosing a provider.

**Architecture:** The TS server (`server/index.ts` → `dist-server/index.js`, ESM) already serves the API **and** the built React SPA (`express.static('dist')` + SPA fallback), so the whole app runs from one Node process and ships as a single container. All config is env-driven. Azure-specific files are kept but quarantined so current staging is untouched.

**Tech Stack:** Node 20 (Debian bookworm for Prisma `debian-openssl-3.0.x` engine), Vite + React, Express + Prisma (PostgreSQL, client-only), Docker, GitHub Actions, `concurrently` (dev only).

---

## Reference (shared values)

- Local Postgres (Prisma form): `postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN`
- Dev JWT secret: `<JWT_SECRET>`
- Build commands: `npm run build` (Vite → `dist/`), `npm run build:server` (tsc → `dist-server/`).
- Server reads `process.env.PORT` (default 3001) and serves `dist/` for the SPA.
- Token mint (verification): `node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))"`

---

## File Structure

**Create:**
- `.env.local` — local Postgres connection + dev secret (git-ignored; reference/psql + optional `--env-file`).
- `.env.example` — names + descriptions of every required env var (committed, no secret values).
- `Dockerfile` — multi-stage build → single runtime image serving API + SPA.
- `.dockerignore` — exclude node_modules, dist, .git, .env*, postgres/02_seed.sql, etc.
- `LOCAL_DEV_POSTGRES.md` — one-command local-on-Postgres quickstart.
- `.github/workflows/ci.yml` — provider-neutral build/typecheck/image CI; stubbed deploy job.
- `docs/azure-exit/README.md` — lock-in inventory + env/secrets + provider-neutral cutover runbook.

**Modify:**
- `package.json` — add `dev:pg` script + `concurrently` devDependency.
- `.gitignore` — ensure `.env.local` is ignored (already covered by `.env*`; verify).

**Not touched:** `azure-pipelines*.yml`, `web.config`, `staticwebapp.config.json`, `package.production.json`, `server.cjs`/`server.js`/`server-production.js`.

---

## Task 1: One-command local app on PostgreSQL (`dev:pg`)

**Files:** Modify `package.json`; Create `.env.local`.

- [ ] **Step 1: Add `concurrently` as a dev dependency (skip the heavy postinstall)**

```bash
npm install --save-dev --ignore-scripts concurrently
```
Expected: `concurrently` appears under `devDependencies` in `package.json`; no full rebuild triggered.

- [ ] **Step 2: Add the `dev:pg` script**

Add to `package.json` `scripts` (runs the PG-backed API and the Vite frontend together; Ctrl-C stops both):

```json
"dev:pg": "concurrently -k -n api,web -c blue,green \"npm run server:dev:pg\" \"vite\""
```

- [ ] **Step 3: Create `.env.local` (git-ignored reference for local Postgres)**

```bash
cat > .env.local <<'EOF'
# Local development against the Docker PostgreSQL clone (localhost:5433).
# The dev:pg / server:dev:pg scripts set these inline (they must override the
# SQL Server DATABASE_URL in .env), so this file is for psql/tools and reference.
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN"
JWT_SECRET="<JWT_SECRET>"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:5175"
EOF
```

- [ ] **Step 4: Verify `.env.local` is git-ignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (matched by the existing `.env*` rule).

- [ ] **Step 5: Verify the one-command flow boots both servers on Postgres**

Run (let it start, then probe in another shell or background it):
```bash
( npm run dev:pg > /tmp/devpg.log 2>&1 & ) ; sleep 18
curl -s -o /dev/null -w 'api /api/health -> %{http_code}\n' localhost:3001/api/health
curl -s -o /dev/null -w 'web vite root -> %{http_code}\n' localhost:5175/
curl -s -o /dev/null -w 'web proxied /api/health -> %{http_code}\n' localhost:5175/api/health
pkill -f dist-server/index.js 2>/dev/null; pkill -f vite 2>/dev/null; true
```
Expected: api health 200; vite root 200; proxied `/api/health` via :5175 → 200 (proves the frontend→backend→Postgres loop).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example 2>/dev/null; git add package.json package-lock.json
git commit -m "feat(dev): one-command dev:pg runs full app on local postgres"
```

## Task 2: Local-on-Postgres quickstart doc

**Files:** Create `LOCAL_DEV_POSTGRES.md`.

- [ ] **Step 1: Write the quickstart**

Create `LOCAL_DEV_POSTGRES.md`:

````markdown
# Local development on PostgreSQL

Run the full Guardian app locally against a Docker PostgreSQL clone of staging.
(The legacy `server.cjs` SQL Server flow via `npm run server:dev` is unchanged.)

## One-time setup

1. Start a local Postgres 16 (port 5433):
   ```bash
   docker run -d --name gd_pg -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
   ```
2. Load schema + data + patches:
   ```bash
   export PGPASSWORD=postgres
   psql -h localhost -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=1 -f postgres/01_schema.sql
   psql -h localhost -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=1 -f postgres/02_seed.sql
   psql -h localhost -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=1 -f postgres/03_app_schema_patches.sql
   ```
   (`02_seed.sql` is git-ignored — regenerate with `node scripts/mssql-to-postgres.cjs --out ./postgres` if missing.)

## Run

```bash
npm run dev:pg
```
- API (Postgres-backed): http://localhost:3001
- Frontend (proxies /api → :3001): http://localhost:5175

Log in with a real seeded user. To run only the API: `npm run server:dev:pg`.

## Refresh data from staging
```bash
node scripts/mssql-to-postgres.cjs --out ./postgres   # regenerates 01_schema.sql + 02_seed.sql
# then re-run the load steps above (DROP SCHEMA "GUARDIAN" CASCADE first for a clean reload)
```

## Notes
- `.env.local` documents the connection; `dev:pg`/`server:dev:pg` set env inline so they
  override the SQL Server `DATABASE_URL` in `.env`.
- Prisma is used as a client only — never run `prisma migrate`/`db push` against this DB
  (the schema is owned by `postgres/01_schema.sql`).
````

- [ ] **Step 2: Commit**

```bash
git add LOCAL_DEV_POSTGRES.md
git commit -m "docs: local development on postgresql quickstart"
```

## Task 3: `.env.example` + audit code for host-specific assumptions

**Files:** Create `.env.example`; audit `server/**`.

- [ ] **Step 1: Audit for hardcoded hosts/ports/paths that should be env-driven**

```bash
grep -rnE "azurewebsites|localhost:3001|http://localhost|guardian-[a-z-]*\.database|hardcoded|127\.0\.0\.1" server --include='*.ts' | grep -viE "comment|//|cors|proxy" | head -40
```
For any **runtime** hardcoded host/URL (not test/comment), replace with `process.env.<VAR>` with a sane default. Common ones: `FRONTEND_URL` for email links, CORS origins. If none found, note "clean" and proceed. Do NOT change Vite proxy config (`vite.config.ts` is dev-only) or the legacy `server.cjs`.

- [ ] **Step 2: Create `.env.example` (committed, names + descriptions only)**

```bash
cat > .env.example <<'EOF'
# Guardian MVP — required environment variables (no secret values here).
# Copy to .env (or set in your host's secret store) and fill in real values.

# Database — PostgreSQL connection (Prisma client). Include ?schema=GUARDIAN.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=GUARDIAN"

# Auth
JWT_SECRET="<random-32+-byte-hex>"
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
NODE_ENV="production"

# Frontend base URL (used in transactional email links)
FRONTEND_URL="https://your-domain.example"

# Email (Resend SMTP) — provider-agnostic
SMTP_HOST="smtp.resend.com"
SMTP_PORT=465
SMTP_USER="resend"
SMTP_PASSWORD="<resend-api-key>"
EMAIL_FROM="support@your-domain.example"
EOF
```

- [ ] **Step 2b: Verify the var list matches what the code reads**

```bash
grep -rhoE "process\.env\.[A-Z_]+" server --include='*.ts' | sort -u
```
Expected: every var the server reads at runtime appears in `.env.example` (or is intentionally optional). Add any missing ones to `.env.example`.

- [ ] **Step 3: Commit**

```bash
git add .env.example $(git diff --name-only server 2>/dev/null)
git commit -m "chore: add .env.example; make runtime config env-driven"
```

## Task 4: Dockerfile + .dockerignore (single portable image)

**Files:** Create `Dockerfile`, `.dockerignore`.

- [ ] **Step 1: Create `.dockerignore`**

```bash
cat > .dockerignore <<'EOF'
node_modules
dist
dist-server
.git
.github
.env
.env.*
postgres/02_seed.sql
*.log
.claude
docs
deployment
**/*.bak
EOF
```

- [ ] **Step 2: Create `Dockerfile` (multi-stage; Debian for Prisma engine)**

```dockerfile
# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# install deps without the source-dependent postinstall (prisma generate + build:all)
RUN npm ci --ignore-scripts
COPY . .
# generate the Prisma client (postgresql provider, debian-openssl-3.0.x engine)
RUN npx prisma generate
# build frontend (-> dist/) and server (-> dist-server/)
RUN npm run build && npm run build:server
# drop dev dependencies for a lean runtime node_modules (keeps generated prisma client)
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# openssl for the Prisma query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/schema.prisma ./schema.prisma
# PORT is provided by the host; the server reads process.env.PORT
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
```

- [ ] **Step 3: Build the image**

Run: `docker build -t guardian:prep .`
Expected: build completes; final stage produces the image. (If `npx prisma generate` complains about engines, confirm `binaryTargets` in `schema.prisma` includes `debian-openssl-3.0.x` — it does.)

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(deploy): add portable multi-stage Dockerfile (single container: API + SPA)"
```

## Task 5: Verify the container serves the app against Postgres

**Files:** none (verification).

- [ ] **Step 1: Run the container against the local Postgres (host networking)**

```bash
docker rm -f guardian_prep 2>/dev/null; true
docker run -d --name guardian_prep -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -e JWT_SECRET='<JWT_SECRET>' \
  -e DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:5432/postgres?schema=GUARDIAN' \
  guardian:prep
sleep 8
```
Note: the local Postgres container publishes 5433→5432 on the host; from inside the app container reach it via `host.docker.internal:5433`. Adjust the URL to `host.docker.internal:5433` to match the published host port:
```bash
docker rm -f guardian_prep 2>/dev/null; true
docker run -d --name guardian_prep -p 8080:8080 -e PORT=8080 -e NODE_ENV=production \
  -e JWT_SECRET='<JWT_SECRET>' \
  -e DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:5433/postgres?schema=GUARDIAN' \
  guardian:prep
sleep 8
```

- [ ] **Step 2: Probe the container**

```bash
curl -s -o /dev/null -w '/api/health -> %{http_code}\n' localhost:8080/api/health
curl -s -o /dev/null -w 'SPA root -> %{http_code}\n' localhost:8080/
TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
curl -s -o /dev/null -w '/api/requests -> %{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:8080/api/requests
docker logs guardian_prep 2>&1 | grep -iE 'error|does not exist|listen|running' | tail -10
docker rm -f guardian_prep
```
Expected: `/api/health` 200, SPA root 200 (serves `dist/index.html`), `/api/requests` 200 (DB reachable from container). No DB/Prisma errors in logs.

- [ ] **Step 3: Record the result**

If green, the single-container path is proven portable. If `host.docker.internal` doesn't resolve on this platform (Linux), re-run with `--add-host=host.docker.internal:host-gateway` or `--network host` and note which worked in the runbook (Task 7). No commit (verification only) unless a Dockerfile fix was needed — then commit it.

## Task 6: Provider-neutral CI workflow

**Files:** Create `.github/workflows/ci.yml`.

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npx prisma generate
      - run: npm run build            # frontend -> dist/
      - run: npm run build:server     # server -> dist-server/
      - name: Typecheck server
        run: npx tsc -p tsconfig.server.json --noEmit
      - name: Build container image (no push)
        run: docker build -t guardian:ci .

  # ---------------------------------------------------------------------------
  # DEPLOY — intentionally disabled until a provider is chosen.
  # TODO(provider): set registry login + push, then deploy the image to the
  # chosen host (AWS App Runner/ECS, GCP Cloud Run, Render, Fly.io, etc.).
  # Wire DATABASE_URL/JWT_SECRET/SMTP_* from the provider's secret store.
  # ---------------------------------------------------------------------------
  deploy:
    if: false
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy step is a stub. Fill in once a provider is selected."
```

- [ ] **Step 2: Lint the YAML locally**

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!/jobs:/.test(s)||!/build:/.test(s))throw new Error('workflow malformed');console.log('workflow ok')"
```
Expected: `workflow ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add provider-neutral build/typecheck/image workflow (deploy stubbed)"
```

## Task 7: Azure-exit readiness assessment + cutover runbook

**Files:** Create `docs/azure-exit/README.md`.

- [ ] **Step 1: Write the assessment + runbook**

Create `docs/azure-exit/README.md` covering:
1. **Lock-in inventory** — table of every Azure-specific asset and its neutral replacement: App Service→container host; Azure SQL→managed Postgres; Azure DevOps `azure-pipelines.yml`/`AzureWebApp@1`/`AzureSP-Dev`→GitHub Actions + provider deploy; `web.config`/`staticwebapp.config.json`/`package.production.json`→not needed by the container; Resend→unchanged. Note which files are safe to delete only AFTER cutover.
2. **Required env/secrets** — reproduce the `.env.example` list with where each is set today (Azure App Service config) and where it'll go (provider secret store).
3. **Database portability** — managed Postgres on any provider; migration mechanism = `scripts/mssql-to-postgres.cjs` + `postgres/01_schema.sql`+`02_seed.sql`+`03_app_schema_patches.sql`; Prisma client-only; load order; `?schema=GUARDIAN`.
4. **Container** — `Dockerfile` builds one image serving API+SPA on `$PORT`; verified locally (note the `host.docker.internal` finding from Task 5).
5. **Provider-neutral cutover runbook** — ordered, with provider-specific blanks:
   `[ ] provision managed Postgres` → `[ ] load schema/seed/patches` → `[ ] build & push image to <registry>` →
   `[ ] set env/secrets in <secret store>` → `[ ] deploy container to <compute>` → `[ ] smoke test (/api/health, login, key routes)` →
   `[ ] point DNS <domain> to <new host>` → `[ ] monitor` → `[ ] decommission Azure (App Service, Azure SQL, DevOps pipeline)`.
6. **Outstanding before production cutover** — link the PG review-flags note (`docs/superpowers/notes/2026-06-05-pg-repair-flags-for-review.md`): the `/api/requests` auth + company-isolation gaps and the external/roles schema-drift repairs to validate.

- [ ] **Step 2: Commit**

```bash
git add docs/azure-exit/README.md
git commit -m "docs: azure-exit readiness assessment + provider-neutral cutover runbook"
```

---

## Self-review notes

- **Spec coverage:** A (local-on-PG) = Tasks 1–2; B (portability: Dockerfile/.env.example/quarantine) = Tasks 3–5; C (DB portability) = Task 7 §3; D (CI) = Task 6; E (assessment + runbook) = Task 7. All components mapped.
- **No placeholders:** the only intentional stub is the CI `deploy` job (`if: false` + labeled TODO), which is the spec's explicit "provider-specific blank."
- **Consistency:** `dev:pg`, `server:dev:pg`, ports (3001 api / 5175 web / 8080 container), and the PG URL/secret are identical across tasks.
- **Scope discipline:** no task edits `azure-pipelines*.yml`, the legacy servers, or `web.config`.
