# Design: Migrate the Guardian TS server to PostgreSQL

**Date:** 2026-06-05
**Status:** Approved (design)
**Branch:** `feature/postgres-migration-ts-server`

## Goal

Make the canonical TypeScript server (`server/index.ts` plus its 26 route
modules, compiled to `dist-server/index.js`) run against PostgreSQL instead of
SQL Server. Target for development is the local Docker Postgres
(`localhost:5433`, db `postgres`, schema `GUARDIAN`), already loaded with a full
clone of staging via `postgres/01_schema.sql` + `postgres/02_seed.sql`.

## Scope

**In scope**
- `schema.prisma` (root, the active Prisma schema) — provider + native types.
- The TS server: `server/index.ts`, `server/routes/*.ts`,
  `server/middleware/*.ts`, `server/lib/*.ts`, `server/services/*.ts`,
  `server/auth.ts`.
- Connection wiring + a dev run script.

**Out of scope (left on SQL Server / untouched)**
- Legacy monolith: `server.cjs`, `server.js`, `server-production.js`.
- Production/Azure deploy config and the production database move (separate
  effort; prod migration gated per existing release process).
- Converting raw SQL into Prisma calls (explicitly deferred — mechanical port
  only; a follow-up backlog item may convert hot paths later).

## Current-state facts (measured)

- Active Prisma schema: `./schema.prisma`, `provider = "sqlserver"`, 37 models,
  no `@@schema` directives (schema scoping via `?schema=GUARDIAN` in the URL).
- TS server DB surface: **216 Prisma model calls**, **175 raw SQL calls**
  (`$queryRaw*` / `$executeRaw*`).
- Raw SQL concentration: `requests.ts` 59, `services/jafarPurge.ts` 44,
  `milestones.ts` 16, `forms-groups.ts` 13, `external.ts` 8, `forms.ts` 7,
  `workflow.ts` 5, `roles.ts` 5, `index.ts` 5, `notices.ts` 4, `auth.ts` 4,
  `subpoena-riders.ts` 2, `users.ts` 1, `group.ts` 1, `middleware/isAdmin.ts` 1.
- **204 unquoted `GUARDIAN.TABLE` references** in raw SQL (the core porting
  problem: Postgres folds bare identifiers to lowercase; our tables are quoted
  uppercase).

## Approach

### 1. Prisma layer (low risk)

Edit the existing `schema.prisma` **in place** rather than replacing it with
`prisma db pull` output. This preserves the exact model / relation / field
names the app is coded against (`prisma.aTTACHMENTS`, `.USER_ID`, nested-include
relation names), changing only what Postgres requires:

- `datasource.provider`: `sqlserver` → `postgresql`.
- Replace SQL-Server-native attributes with Postgres equivalents:
  - `@db.NVarChar(n)` → `@db.VarChar(n)`; `@db.NVarChar(Max)` / `@db.Text` /
    `@db.NText` → `@db.Text`.
  - `@db.DateTime` / `@db.DateTime2` → `@db.Timestamp(6)`.
  - `@db.Bit` → remove (Prisma `Boolean` maps to `boolean`).
  - `@db.VarBinary(Max)` / `@db.Image` → `Bytes` with no native attr (`bytea`).
  - `@db.Money` → `@db.Decimal(19,4)`; keep `@db.Decimal(p,s)`.
  - `@db.UniqueIdentifier` → `@db.Uuid`.
  - Drop any `map:` names that are SQL-Server-specific only if they cause
    conflicts (default keep).
- Authoritative type reference: the verified `prisma db pull` output from the
  spike (run against the loaded local Postgres), which produced uppercase
  models with correct Postgres-native types.
- `prisma generate`, then `tsc -p tsconfig.server.json` to confirm the model
  layer compiles with the regenerated client.

**Validation gate:** typecheck passes; a trivial model read
(`prisma.uSERS.findMany`) returns rows from local Postgres.

### 2. Raw SQL layer (the real work — mechanical port)

Port the 175 raw queries file-by-file, highest count first. Per query, apply:

| SQL Server | PostgreSQL |
|------------|-----------|
| `GUARDIAN.REQUESTS` | `"GUARDIAN"."REQUESTS"` |
| bare column `fi.FORM_INSTANCE_ID` | `fi."FORM_INSTANCE_ID"` |
| `SELECT TOP n …` | `SELECT … LIMIT n` |
| `GETDATE()` / `SYSDATETIME()` | `now()` |
| `GETUTCDATE()` / `SYSUTCDATETIME()` | `timezone('utc', now())` |
| `… OUTPUT INSERTED.col …` | `… RETURNING "col"` |
| `ISNULL(a,b)` | `COALESCE(a,b)` |
| `LEN(x)` | `length(x)` |
| string `a + b` | `a || b` |
| `NEWID()` | `gen_random_uuid()` |
| bracket `[col]` | `"col"` |

Watch items per query:
- Parameter binding: Prisma `$queryRaw` tagged templates use `$1…`/parameterized
  values automatically; `$queryRawUnsafe(sql, ...params)` uses `$1` positional —
  confirm placeholder style per call.
- Dynamic `$queryRawUnsafe` string-building: re-verify quoting and that
  interpolated identifiers are quoted; do not introduce injection.
- `$transaction` / `tx.$queryRawUnsafe` semantics unchanged but re-test.

**Validation gate per file:** server boots; the endpoints backed by that file
return expected results against local Postgres (GET happy-path + at least one
mutation where present).

### 3. Connection & env

- The TS server loads `DATABASE_URL` via `import 'dotenv/config'` in
  `server/index.ts`.
- Use `postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN`
  (already captured in `.env.postgres-local`).
- Add an npm script (e.g. `server:dev:pg`) that builds the server and runs it
  with the Postgres `DATABASE_URL`, leaving `backend` / `server:dev` /
  `start:server` untouched.

### 4. Verification strategy

- **Build:** `tsc -p tsconfig.server.json` clean.
- **Boot:** `node dist-server/index.js` connects to local Postgres; `/api/health`
  OK; `/api/login` issues a JWT for a seeded user.
- **Per route:** exercise a representative GET (and a mutation where it exists)
  for each route module after its raw queries are ported.
- **Smoke tests:** run applicable `src/tests/*.smoke.test.ts` against local PG.
- **Regression sweep at the end:** walk every route module once more for a
  happy-path call.

## Phasing (basis for the implementation plan)

- **Phase 0** — Branch (done). Postgres Prisma schema edits + `prisma generate` +
  typecheck. Model layer green; no raw fixes yet.
- **Phase 1** — Connection/env wiring; boot server against local PG; catalogue
  every runtime error (most will be raw-SQL casing/syntax).
- **Phases 2–N** — Port raw SQL route-by-route in descending count order,
  verifying each file against local Postgres before moving on:
  - 2: `requests.ts` (59)
  - 3: `services/jafarPurge.ts` (44)
  - 4: `milestones.ts` (16) + `forms-groups.ts` (13)
  - 5: `external.ts` (8) + `forms.ts` (7) + `workflow.ts` (5) + `roles.ts` (5)
  - 6: `index.ts` (5) + `notices.ts` (4) + `auth.ts` (4) + `subpoena-riders.ts`
       (2) + `users.ts` (1) + `group.ts` (1) + `middleware/isAdmin.ts` (1)
- **Final** — Full smoke pass across all routes; update `postgres/README.md` and
  CLAUDE.md notes; summarize remaining follow-ups (e.g. raw→Prisma backlog,
  production DB move).

## Risks & mitigations

- **Relation-name drift** — mitigated by editing `schema.prisma` in place
  (not regenerating from `db pull`).
- **Dynamic SQL casing / injection** — review each `$queryRawUnsafe`; quote
  interpolated identifiers; keep values parameterized.
- **Type differences** (`Bytes`/`bytea`, `Decimal`, `DateTime` tz) — covered by
  Postgres-native attribute mapping; spot-check blob + date round-trips.
- **Transaction semantics** — re-test each `$transaction` path.
- **Two-stack confusion** — explicitly leave the legacy monolith on SQL Server;
  only `dist-server` is migrated.

## Success criteria

- `tsc -p tsconfig.server.json` compiles clean with the Postgres Prisma client.
- `node dist-server/index.js` runs against local Postgres with no SQL Server
  dependency.
- `/api/health`, `/api/login`, and a happy-path call for every route module
  succeed against the local Postgres clone.
- Applicable smoke tests pass.
- SQL Server scripts (`backend`, `server:dev`) remain functional and untouched.
