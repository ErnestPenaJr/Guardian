# TS Server PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical TypeScript server (`server/index.ts` + its route modules, built to `dist-server/`) run against PostgreSQL instead of SQL Server, verified against the local Docker Postgres clone of staging.

**Architecture:** Two-layer change. (1) Prisma layer: flip the `schema.prisma` datasource to `postgresql` and replace SQL-Server-only native type attributes — the 216 model calls then work unchanged. (2) Raw-SQL layer: mechanically port 175 `$queryRaw*`/`$executeRaw*` calls (quote identifiers, fix T-SQL syntax) file-by-file, verifying each route against local Postgres before moving on. The legacy `server.cjs`/`server.js`/`server-production.js` monolith is left on SQL Server, untouched.

**Tech Stack:** Node + Express + TypeScript, Prisma ORM, PostgreSQL 16 (Docker, `localhost:5433`), `tsc -p tsconfig.server.json` build → `dist-server/index.js`.

---

## Reference: shared values used throughout this plan

**Local Postgres connection (Prisma form):**
```
postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN
```

**Dev JWT secret** (from `.env`): `<JWT_SECRET>`

**Seeded test user:** Ernest — `USER_ID=1176`, `ernest@shieldlytics.com`, `COMPANY_ID=54`.

**Mint a verification token** (paste the secret above; broad roles so RBAC passes):
```bash
export PG_JWT='<JWT_SECRET>'
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},process.env.PG_JWT))")
echo "$TOKEN"
```

**Run the TS server against local Postgres** (added as a script in Task 4; until then use this directly):
```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
JWT_SECRET="$PG_JWT" PORT=3001 node dist-server/index.js
```

**T-SQL → PostgreSQL transformation table** (apply to every raw query):

| SQL Server | PostgreSQL |
|------------|-----------|
| `GUARDIAN.REQUESTS` (bare table) | `"GUARDIAN"."REQUESTS"` |
| bare column `fi.FORM_INSTANCE_ID` | `fi."FORM_INSTANCE_ID"` |
| `SELECT TOP n …` | `SELECT … LIMIT n` (move to end of query) |
| `GETDATE()` / `SYSDATETIME()` | `now()` |
| `GETUTCDATE()` / `SYSUTCDATETIME()` | `timezone('utc', now())` |
| `… OUTPUT INSERTED.COL …` (insert) | append `RETURNING "COL"` |
| `ISNULL(a, b)` | `COALESCE(a, b)` |
| `LEN(x)` | `length(x)` |
| `CHARINDEX(a, b)` | `position(a in b)` |
| string `a + b` | `a || b` |
| `NEWID()` | `gen_random_uuid()` |
| `[col]` | `"col"` |
| `DATEADD(day, n, d)` | `d + (n \|\| ' days')::interval` |
| `CONVERT(type, x)` | `CAST(x AS type)` / `x::type` |

**Identifier-quoting rule:** every table is `"GUARDIAN"."TABLE"` and every column is `"COLUMN"` (uppercase, double-quoted). Bare/unquoted identifiers fold to lowercase in Postgres and will NOT match. Quote table refs, column refs, and aliased column refs. Table *aliases* (e.g. `fi`, `r`) are lowercase already and stay unquoted.

**Param style:** `$queryRawUnsafe(sql, a, b)` uses positional `$1, $2` placeholders in Postgres (SQL Server `mssql` used `@P1`). Prisma rewrites placeholders per-provider, so existing `$queryRawUnsafe` calls that already use `${interpolated}` template strings or pass params positionally do not change placeholder syntax — but re-verify any hand-written `@P1`/`?` placeholders.

---

## File Structure

**Modified:**
- `schema.prisma` — datasource provider + native type attributes (Phase 0).
- `package.json` — add `server:dev:pg` run script (Phase 1).
- `server/routes/requests.ts` — 59 raw queries (Phase 2).
- `server/services/jafarPurge.ts` — 44 raw queries (Phase 3).
- `server/routes/milestones.ts` (16), `server/routes/forms-groups.ts` (13) (Phase 4).
- `server/routes/external.ts` (8), `server/routes/forms.ts` (7), `server/routes/workflow.ts` (5), `server/routes/roles.ts` (5) (Phase 5).
- `server/index.ts` (5), `server/routes/notices.ts` (4), `server/auth.ts` (4), `server/routes/subpoena-riders.ts` (2), `server/routes/users.ts` (1), `server/routes/group.ts` (1), `server/middleware/isAdmin.ts` (1) (Phase 6).
- `postgres/README.md`, `CLAUDE.md` — doc updates (Final).

**Not touched:** `server.cjs`, `server.js`, `server-production.js`.

**Route → mount path map** (for verification curls):
`forms`→`/api/forms`, `fields`→`/api/fields`, `field-types`→`/api/field-types`, `requests`→`/api/requests`, `forms-groups`→`/api/forms-groups`, `users`→`/api/users`, `roles`→`/api/roles`, `invites`→`/api/invites`, `field-lookups`→`/api/field-lookups`, `notices`→`/api/notices`, `my-notices`→`/api/my-notices`, `platform-admin`→`/api/platform`, `securities-notices`→`/api/securities-notices`, `recipients`→`/api/recipients`, `notice-templates`→`/api/templates`, `subpoena-riders`→`/api/subpoena-riders`, `audit`→`/api/audit`, `attachments`→`/api/attachments`, `milestones`→`/api` (mounted at root), `external`/`external-notices`→`/api/external`.

---

## Phase 0 — Prisma layer

### Task 1: Back up the SQL Server schema and flip the datasource

**Files:**
- Modify: `schema.prisma:8`
- Create: `prisma/schema.sqlserver.prisma.bak`

- [ ] **Step 1: Back up the current schema**

```bash
cp schema.prisma prisma/schema.sqlserver.prisma.bak
```

- [ ] **Step 2: Change the datasource provider**

In `schema.prisma`, change line 8 inside the `datasource db` block:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 3: Commit**

```bash
git add schema.prisma prisma/schema.sqlserver.prisma.bak
git commit -m "chore(prisma): back up sqlserver schema, switch provider to postgresql"
```

### Task 2: Replace SQL-Server-only native type attributes

The schema uses these SQL-Server-only attributes that are invalid for the
`postgresql` provider and must be replaced: `@db.DateTime` (58), `@db.NVarChar(Max)` (10),
and `@db.NVarChar(n)` for n ∈ {255,50,40,64,4000,32,2000,1024,100,10}.
Valid-for-Postgres attributes already present stay unchanged: `@db.VarChar(n)`,
`@db.Char(1)`, `@db.Decimal(38, 0)`.

**Files:**
- Modify: `schema.prisma`

- [ ] **Step 1: Apply the mechanical replacements**

```bash
# datetime -> timestamp(6)
perl -0pi -e 's/\@db\.DateTime\b/\@db.Timestamp(6)/g' schema.prisma
# nvarchar(Max) -> text  (must run BEFORE the sized NVarChar rule)
perl -0pi -e 's/\@db\.NVarChar\(Max\)/\@db.Text/g' schema.prisma
# nvarchar(n) -> varchar(n)
perl -0pi -e 's/\@db\.NVarChar\((\d+)\)/\@db.VarChar($1)/g' schema.prisma
```

- [ ] **Step 2: Verify no SQL-Server-only attributes remain**

```bash
grep -nE '@db\.(NVarChar|DateTime|DateTime2|Bit|Money|UniqueIdentifier|NText|Image|VarBinary|TinyInt)' schema.prisma
```
Expected: no output (exit 1 / empty).

- [ ] **Step 3: Validate the schema**

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
  node_modules/.bin/prisma validate
```
Expected: `The schema at schema.prisma is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add schema.prisma
git commit -m "chore(prisma): port native type attributes to postgresql"
```

### Task 3: Regenerate the Prisma client and typecheck

**Files:**
- Modify: (generated) `node_modules/.prisma/client/*`

- [ ] **Step 1: Regenerate the client**

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
  node_modules/.bin/prisma generate
```
Expected: `Generated Prisma Client … in …`

- [ ] **Step 2: Typecheck the server**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0, no errors. (If errors appear, they are almost always raw-SQL
type inference and will be addressed in later phases — but a clean compile here
confirms the model layer is sound.)

- [ ] **Step 3: Smoke-test a model read against local Postgres**

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT count(*)::int AS n FROM \"GUARDIAN\".\"USERS\"').then(r=>{console.log('USERS via prisma:',r);return p.uSERS.count()}).then(n=>{console.log('uSERS.count():',n);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: `USERS via prisma: [ { n: 43 } ]` and `uSERS.count(): 43`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(prisma): regenerate client for postgresql"
```

---

## Phase 1 — Connection wiring & first boot

### Task 4: Add a Postgres dev run script

**Files:**
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Add the script**

Add to `package.json` `scripts` (leave `backend`, `server:dev`, `start:server` untouched):

```json
"server:dev:pg": "npm run build:server && DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' JWT_SECRET='<JWT_SECRET>' PORT=3001 node dist-server/index.js"
```

- [ ] **Step 2: Verify it parses**

```bash
node -e "console.log(require('./package.json').scripts['server:dev:pg'])"
```
Expected: prints the command.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add server:dev:pg script to run TS server on local postgres"
```

### Task 5: Boot the server and catalogue runtime failures

**Files:** none (diagnostic task; produces a checklist)

- [ ] **Step 1: Build and start the server in the background**

```bash
npm run server:dev:pg > /tmp/pg_server.log 2>&1 &
sleep 8
```

- [ ] **Step 2: Confirm it is up**

```bash
curl -s localhost:3001/api/health
```
Expected: a JSON health payload (HTTP 200).

- [ ] **Step 3: Mint a token and probe every route's happy-path GET**

```bash
export PG_JWT='<JWT_SECRET>'
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},process.env.PG_JWT))")
for ep in /api/users /api/roles /api/fields /api/field-types /api/forms /api/requests /api/forms-groups /api/notices /api/my-notices /api/milestones /api/audit /api/invites /api/field-lookups; do
  code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "localhost:3001$ep")
  echo "$ep -> $code $(head -c 120 /tmp/resp.json)"
done
```

- [ ] **Step 4: Record the failures**

Note every endpoint returning 500 (and the matching stack trace / SQL error in
`/tmp/pg_server.log`). These map to the route files ported in Phases 2–6.
`relation "guardian.xxx" does not exist` = unquoted-identifier casing;
`syntax error at or near "TOP"` etc. = T-SQL syntax. Endpoints returning 200
need no raw-SQL work (Prisma-only routes).

- [ ] **Step 5: Stop the server**

```bash
kill %1 2>/dev/null; pkill -f dist-server/index.js 2>/dev/null; true
```

- [ ] **Step 6: Commit the diagnostic note**

```bash
mkdir -p docs/superpowers/notes
# paste the Step 3 output + failure list into the file below, then:
git add docs/superpowers/notes/2026-06-05-pg-boot-failures.md 2>/dev/null || true
git commit -m "docs: record initial postgres boot endpoint status" --allow-empty
```

---

## Phases 2–6 — Raw SQL port (per file)

Every file task below uses this **same procedure**. The transformation table and
quoting rule from the Reference section are the "how"; the steps are identical
per file, differing only in the target file and the endpoints to verify.

### Task 6: Port `server/routes/requests.ts` (59 raw queries)

**Files:**
- Modify: `server/routes/requests.ts`
- Verify endpoints under: `/api/requests`

- [ ] **Step 1: Enumerate every T-SQL construct in the file**

```bash
grep -nE 'GUARDIAN\.[A-Z_]+|SELECT TOP|\bTOP [0-9]|GETDATE|GETUTCDATE|SYSDATETIME|ISNULL|OUTPUT INSERTED|NEWID|DATEADD|DATEDIFF|CHARINDEX|\bLEN\(|\[[A-Z_]+\]' server/routes/requests.ts
```
This is the work list. Every hit must be transformed per the table.

- [ ] **Step 2: Apply the transformations**

Edit each raw query in `server/routes/requests.ts`:
- Quote tables: `GUARDIAN.REQUESTS` → `"GUARDIAN"."REQUESTS"` (every table in the grep output).
- Quote columns referenced in SELECT/WHERE/ON/INSERT/SET/RETURNING, including aliased ones (`r.STATUS` → `r."STATUS"`). Leave lowercase aliases (`r`, `fi`) unquoted.
- `SELECT TOP n …` → remove `TOP n`, append `LIMIT n` before the closing backtick.
- `GETDATE()`→`now()`, `GETUTCDATE()`→`timezone('utc', now())`.
- `… OUTPUT INSERTED.REQUEST_ID …` on INSERTs → drop the OUTPUT clause, append `RETURNING "REQUEST_ID"`.
- `ISNULL`→`COALESCE`, `LEN(`→`length(`, string `+`→`||`, `[x]`→`"x"`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0.

- [ ] **Step 4: Rebuild, boot, and verify the requests endpoints**

```bash
pkill -f dist-server/index.js 2>/dev/null; npm run server:dev:pg > /tmp/pg_server.log 2>&1 & sleep 8
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
curl -s -o /dev/null -w 'GET /api/requests -> %{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:3001/api/requests
curl -s -H "Authorization: Bearer $TOKEN" localhost:3001/api/requests | head -c 300; echo
# spot-check the request-detail / form endpoints exercised by the raw queries:
curl -s -o /dev/null -w 'GET /api/requests/assigned/me -> %{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:3001/api/requests/assigned/me
```
Expected: HTTP 200 with a JSON array of requests (89 rows seeded for the company set). No `relation … does not exist` / `syntax error` in `/tmp/pg_server.log`.

- [ ] **Step 5: Tail the log for any residual SQL errors**

```bash
grep -iE 'error|does not exist|syntax' /tmp/pg_server.log | tail -20
pkill -f dist-server/index.js 2>/dev/null; true
```
Expected: no SQL errors attributable to requests endpoints.

- [ ] **Step 6: Commit**

```bash
git add server/routes/requests.ts
git commit -m "feat(pg): port requests.ts raw SQL to postgresql"
```

### Task 7: Port `server/services/jafarPurge.ts` (44 raw queries)

**Files:**
- Modify: `server/services/jafarPurge.ts`
- Verify: invoked via JAFAR/platform admin flows (`/api/platform`) and/or its unit entry point.

- [ ] **Step 1: Enumerate constructs**

```bash
grep -nE 'GUARDIAN\.[A-Z_]+|SELECT TOP|\bTOP [0-9]|GETDATE|GETUTCDATE|SYSDATETIME|ISNULL|OUTPUT INSERTED|NEWID|DATEADD|DATEDIFF|CHARINDEX|\bLEN\(|\[[A-Z_]+\]' server/services/jafarPurge.ts
```

- [ ] **Step 2: Apply the transformations** (same rules as Task 6, Step 2). Pay extra attention to DELETE ordering / `$transaction` blocks — purge logic deletes across many tables; FK constraints are `DEFERRABLE INITIALLY DEFERRED`, so wrap multi-table deletes in a transaction if not already.

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0.

- [ ] **Step 4: Verify against local Postgres**

If `jafarPurge` exposes an HTTP entry (via `/api/platform`), boot and curl it with the minted token (role 6). Otherwise run its exported function directly against local PG inside a transaction that you roll back:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT count(*)::int AS n FROM \"GUARDIAN\".\"AUDIT_LOG\"').then(r=>{console.log(r);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"
```
Expected: no SQL error; counts return.

- [ ] **Step 5: Commit**

```bash
git add server/services/jafarPurge.ts
git commit -m "feat(pg): port jafarPurge.ts raw SQL to postgresql"
```

### Task 8: Port `milestones.ts` (16) and `forms-groups.ts` (13)

**Files:**
- Modify: `server/routes/milestones.ts`, `server/routes/forms-groups.ts`
- Verify: `/api/milestones` (mounted at `/api`), `/api/forms-groups`

- [ ] **Step 1: Enumerate constructs in both files**

```bash
for f in server/routes/milestones.ts server/routes/forms-groups.ts; do echo "== $f =="; grep -nE 'GUARDIAN\.[A-Z_]+|SELECT TOP|\bTOP [0-9]|GETDATE|GETUTCDATE|SYSDATETIME|ISNULL|OUTPUT INSERTED|NEWID|DATEADD|DATEDIFF|CHARINDEX|\bLEN\(|\[[A-Z_]+\]' "$f"; done
```

- [ ] **Step 2: Apply the transformations** to both files (same rules as Task 6, Step 2).

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0.

- [ ] **Step 4: Boot and verify**

```bash
pkill -f dist-server/index.js 2>/dev/null; npm run server:dev:pg > /tmp/pg_server.log 2>&1 & sleep 8
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
curl -s -o /dev/null -w '/api/milestones -> %{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:3001/api/milestones
curl -s -o /dev/null -w '/api/forms-groups -> %{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:3001/api/forms-groups
grep -iE 'error|does not exist|syntax' /tmp/pg_server.log | tail -20
pkill -f dist-server/index.js 2>/dev/null; true
```
Expected: both 200; no SQL errors.

- [ ] **Step 5: Commit**

```bash
git add server/routes/milestones.ts server/routes/forms-groups.ts
git commit -m "feat(pg): port milestones.ts and forms-groups.ts raw SQL to postgresql"
```

### Task 9: Port `external.ts` (8), `forms.ts` (7), `workflow.ts` (5), `roles.ts` (5)

**Files:**
- Modify: `server/routes/external.ts`, `server/routes/forms.ts`, `server/routes/workflow.ts`, `server/routes/roles.ts`
- Verify: `/api/external`, `/api/forms`, `/api/roles` (workflow may be internal)

- [ ] **Step 1: Enumerate constructs**

```bash
for f in server/routes/external.ts server/routes/forms.ts server/routes/workflow.ts server/routes/roles.ts; do echo "== $f =="; grep -nE 'GUARDIAN\.[A-Z_]+|SELECT TOP|\bTOP [0-9]|GETDATE|GETUTCDATE|SYSDATETIME|ISNULL|OUTPUT INSERTED|NEWID|DATEADD|DATEDIFF|CHARINDEX|\bLEN\(|\[[A-Z_]+\]' "$f"; done
```

- [ ] **Step 2: Apply transformations** to all four files (Task 6, Step 2 rules).

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0.

- [ ] **Step 4: Boot and verify**

```bash
pkill -f dist-server/index.js 2>/dev/null; npm run server:dev:pg > /tmp/pg_server.log 2>&1 & sleep 8
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
for ep in /api/forms /api/roles; do curl -s -o /dev/null -w "$ep -> %{http_code}\n" -H "Authorization: Bearer $TOKEN" "localhost:3001$ep"; done
grep -iE 'error|does not exist|syntax' /tmp/pg_server.log | tail -20
pkill -f dist-server/index.js 2>/dev/null; true
```
Expected: 200s; no SQL errors. (`external` routes require a role-5 token — mint one with `roles:[5],role:5` if exercising `/api/external`.)

- [ ] **Step 5: Commit**

```bash
git add server/routes/external.ts server/routes/forms.ts server/routes/workflow.ts server/routes/roles.ts
git commit -m "feat(pg): port external/forms/workflow/roles raw SQL to postgresql"
```

### Task 10: Port the remaining low-count files

**Files:**
- Modify: `server/index.ts` (5), `server/routes/notices.ts` (4), `server/auth.ts` (4), `server/routes/subpoena-riders.ts` (2), `server/routes/users.ts` (1), `server/routes/group.ts` (1), `server/middleware/isAdmin.ts` (1)
- Verify: `/api/notices`, `/api/users`, login flow, `/api/subpoena-riders`

- [ ] **Step 1: Enumerate constructs across all seven files**

```bash
for f in server/index.ts server/routes/notices.ts server/auth.ts server/routes/subpoena-riders.ts server/routes/users.ts server/routes/group.ts server/middleware/isAdmin.ts; do echo "== $f =="; grep -nE 'GUARDIAN\.[A-Z_]+|SELECT TOP|\bTOP [0-9]|GETDATE|GETUTCDATE|SYSDATETIME|ISNULL|OUTPUT INSERTED|NEWID|DATEADD|DATEDIFF|CHARINDEX|\bLEN\(|\[[A-Z_]+\]' "$f"; done
```

- [ ] **Step 2: Apply transformations** to all seven files (Task 6, Step 2 rules). `auth.ts` raw queries back the login/lookup path — quote `"GUARDIAN"."USERS"` and its columns carefully since `requireAuth`/login depend on them.

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.server.json
```
Expected: exit 0.

- [ ] **Step 4: Boot and verify (incl. an authenticated DB-backed route and isAdmin middleware)**

```bash
pkill -f dist-server/index.js 2>/dev/null; npm run server:dev:pg > /tmp/pg_server.log 2>&1 & sleep 8
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
for ep in /api/users /api/notices /api/subpoena-riders; do curl -s -o /dev/null -w "$ep -> %{http_code}\n" -H "Authorization: Bearer $TOKEN" "localhost:3001$ep"; done
grep -iE 'error|does not exist|syntax' /tmp/pg_server.log | tail -20
pkill -f dist-server/index.js 2>/dev/null; true
```
Expected: 200s; no SQL errors.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts server/routes/notices.ts server/auth.ts server/routes/subpoena-riders.ts server/routes/users.ts server/routes/group.ts server/middleware/isAdmin.ts
git commit -m "feat(pg): port remaining TS server raw SQL to postgresql"
```

---

## Final — Full smoke pass & docs

### Task 11: Full-route regression sweep against local Postgres

**Files:** none (verification)

- [ ] **Step 1: Reload a clean copy of the data** (so mutations from earlier verification don't skew results)

```bash
export PGPASSWORD=postgres
psql -h localhost -p 5433 -U postgres -d postgres -c 'DROP SCHEMA IF EXISTS "GUARDIAN" CASCADE;'
psql -h localhost -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=1 -f postgres/01_schema.sql
psql -h localhost -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=1 -f postgres/02_seed.sql
```
Expected: both load with no errors.

- [ ] **Step 2: Boot and sweep every route**

```bash
pkill -f dist-server/index.js 2>/dev/null; npm run server:dev:pg > /tmp/pg_server.log 2>&1 & sleep 8
export TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1176,email:'ernest@shieldlytics.com',firstName:'Ernest',lastName:'P',roles:[1,3,4,6],COMPANY_ID:54,username:'ernest@shieldlytics.com',role:1},'<JWT_SECRET>'))")
for ep in /api/health /api/users /api/roles /api/fields /api/field-types /api/forms /api/requests /api/requests/assigned/me /api/forms-groups /api/notices /api/my-notices /api/milestones /api/audit /api/invites /api/field-lookups /api/securities-notices /api/templates/subpoena /api/recipients; do
  curl -s -o /dev/null -w "%{http_code}  $ep\n" -H "Authorization: Bearer $TOKEN" "localhost:3001$ep"
done
echo "--- SQL errors in log (expect none) ---"; grep -iE 'does not exist|syntax error|column .* does not exist' /tmp/pg_server.log
pkill -f dist-server/index.js 2>/dev/null; true
```
Expected: every endpoint 200 (or 403 for role-gated ones the test token lacks — acceptable, means the query ran). No SQL errors in the log.

- [ ] **Step 3: Run applicable smoke tests against local Postgres**

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN' \
JWT_SECRET='<JWT_SECRET>' \
  bun test src/tests/securities-notice-permissions.test.ts
```
Expected: pass (RBAC matrix is DB-independent; this confirms no regression).

### Task 12: Update documentation

**Files:**
- Modify: `postgres/README.md`, `CLAUDE.md`

- [ ] **Step 1: Document the TS-server Postgres run path in `postgres/README.md`**

Add a section noting: the TS server now runs on Postgres via `npm run server:dev:pg`; the SQL Server scripts (`backend`, `server:dev`) are unchanged; the SQL Server Prisma schema backup lives at `prisma/schema.sqlserver.prisma.bak`.

- [ ] **Step 2: Add a note to `CLAUDE.md`** under the environment/runtime section: the canonical TS server supports PostgreSQL (local dev clone), provider switched in `schema.prisma`, legacy monolith remains on SQL Server.

- [ ] **Step 3: Commit**

```bash
git add postgres/README.md CLAUDE.md
git commit -m "docs: document TS server postgresql run path"
```

- [ ] **Step 4: Finalize the branch** — invoke superpowers:finishing-a-development-branch to choose merge / PR / cleanup.

---

## Self-review notes

- **Spec coverage:** Phase 0 = Prisma layer (spec §1); Phases 2–6 = raw SQL port (spec §2) covering all 15 files with raw queries by descending count; Task 4 = connection/env (spec §3); Tasks 5, 6–11 = per-route + final verification (spec §4); Task 12 = docs. All spec phases mapped.
- **No SQL-Server-only attrs left after Task 2** is explicitly asserted (Task 2 Step 2 grep).
- **Auth for verification** is consistent across all tasks (same minted-token one-liner, same secret/user/roles).
- **Mutations during verification** are reset in Task 11 Step 1 before the final sweep.
