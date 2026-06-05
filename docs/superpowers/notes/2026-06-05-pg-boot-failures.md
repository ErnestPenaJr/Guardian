# Postgres Boot — Endpoint Status Catalogue (2026-06-05)

Recorded during Task 5 of the SQL Server → PostgreSQL migration.
Server: `dist-server/index.js` on `postgresql://postgres:postgres@localhost:5433/postgres?schema=GUARDIAN`, port 3001.

---

## Endpoint → HTTP Status

| Endpoint | HTTP Status | Result | Route File |
|---|---|---|---|
| `GET /api/health` | 200 | OK | `server/index.ts` (inline) |
| `GET /api/users` | 200 | OK — returns 4 users | `server/routes/users.ts` |
| `GET /api/roles` | 200 | OK | `server/routes/roles.ts` |
| `GET /api/fields` | 200 | OK | `server/routes/fields.ts` |
| `GET /api/field-types` | 200 | OK | `server/routes/field-types.ts` |
| `GET /api/forms` | 200 | OK | `server/routes/forms.ts` |
| `GET /api/requests` | 500 | Failed to fetch requests | `server/routes/requests.ts` |
| `GET /api/requests/assigned/me` | 500 | Error fetching assigned requests | `server/routes/requests.ts` |
| `GET /api/forms-groups` | 500 | Failed to fetch groups | `server/routes/forms-groups.ts` |
| `GET /api/notices` | 404 | Not Found | `server/routes/notices.ts` (no GET `/` handler — only `/my`, `/stats`, `/active`) |
| `GET /api/my-notices` | 401 | Unauthorized | `server/routes/my-notices.ts` |
| `GET /api/milestones` | 404 | Not Found | `server/routes/milestones.ts` (no GET `/` handler — routes are nested under `/requests/:id/milestones`) |
| `GET /api/audit` | 401 | Unauthorized | `server/routes/audit.ts` |
| `GET /api/invites` | 401 | Unauthorized | `server/routes/invites.ts` |
| `GET /api/field-lookups` | 404 | Not Found | `server/routes/field-lookups.ts` (no GET `/` handler — only POST, PUT, DELETE) |
| `GET /api/securities-notices` | 401 | Unauthorized | `server/routes/securities-notices.ts` |
| `GET /api/recipients` | 404 | Not Found | `server/routes/recipients.ts` (no GET `/` handler — only `/:id/verification`) |

---

## Summary by Disposition

### 200 — No raw-SQL porting needed (Prisma ORM handles these)
- `/api/users` — `users.ts` uses Prisma ORM queries
- `/api/roles` — `roles.ts` uses Prisma ORM queries
- `/api/fields` — `fields.ts` uses Prisma ORM queries
- `/api/field-types` — `field-types.ts` uses Prisma ORM queries
- `/api/forms` — `forms.ts` uses Prisma ORM queries

### 404 — Route path doesn't exist (not a Postgres failure, expected)
These endpoints return 404 because there is no GET `/` handler registered for the mount path.
No SQL porting needed for these specific paths.
- `/api/notices` — valid sub-paths are `/api/notices/my`, `/api/notices/stats`, `/api/notices/active`
- `/api/milestones` — valid paths are `/api/requests/:requestId/milestones`
- `/api/field-lookups` — only POST/PUT/DELETE handlers exist
- `/api/recipients` — only `/:id/verification` exists

### 401 — Route exists but Passport JWT strategy fails DB verification
These routes all have GET `/` handlers and are guarded by `requireAuth` (= `passport.authenticate('jwt', {session: false})`).
The JWT passport strategy in `server/auth.ts` runs a `$queryRawUnsafe` to validate the user from the token payload. That raw SQL uses unquoted `GUARDIAN.USERS` identifiers.

**Root cause**: PostgreSQL folds unquoted identifiers to lowercase. `GUARDIAN.USERS` becomes `guardian.users` at runtime, but the actual schema and table are `"GUARDIAN"."USERS"` (uppercase, as created by the Prisma migration). Fix: quote all identifiers in `server/auth.ts`.

Affected routes (all share this single root cause):
- `/api/my-notices` → `server/routes/my-notices.ts`
- `/api/audit` → `server/routes/audit.ts`
- `/api/invites` → `server/routes/invites.ts`
- `/api/securities-notices` → `server/routes/securities-notices.ts`

### 500 — Route exists, auth passes (JWT is accepted without DB check), raw SQL fails in handler
These routes use `requireAuth` (same passport middleware) but the JWT payload is accepted
at the middleware layer (the strategy short-circuits before the DB check in some cases,
OR the specific strategy path doesn't block on a DB error for these). The route handler itself
runs `$queryRawUnsafe` with unquoted identifiers.

- `/api/requests` and `/api/requests/assigned/me` → `server/routes/requests.ts`
  - SQL error: `relation "guardian.requests" does not exist`
  - Cause: **unquoted-identifier casing** — raw SQL uses `GUARDIAN.REQUESTS` without double-quotes; Postgres folds to `guardian.requests` which doesn't match the uppercase `"GUARDIAN"."REQUESTS"` table
- `/api/forms-groups` → `server/routes/forms-groups.ts`
  - SQL error: `relation "guardian.forms_groups" does not exist`
  - Cause: **unquoted-identifier casing** — same pattern, `GUARDIAN.FORMS_GROUPS` folded to `guardian.forms_groups`

---

## SQL Errors from `/tmp/pg_server.log`

```
Error fetching requests: PrismaClientKnownRequestError:
  Raw query failed. Code: 42P01.
  Message: relation "guardian.requests" does not exist
  (from prisma.$queryRawUnsafe in server/routes/requests.ts)

Error fetching assigned requests: PrismaClientKnownRequestError:
  Raw query failed. Code: 42P01.
  Message: relation "guardian.requests" does not exist
  (from prisma.$queryRawUnsafe in server/routes/requests.ts)

Error fetching groups: PrismaClientKnownRequestError:
  Raw query failed. Code: 42P01.
  Message: relation "guardian.forms_groups" does not exist
  (from prisma.$queryRaw in server/routes/forms-groups.ts)

Database JWT verification error: PrismaClientKnownRequestError:
  Raw query failed. Code: 42P01.
  Message: relation "guardian.users" does not exist
  (from prisma.$queryRawUnsafe in server/auth.ts — JWT strategy user lookup)
  [fires once per protected endpoint that invokes requireAuth]
```

---

## Root Cause Classification

All failures share a single root cause class:

**unquoted-identifier casing**: Raw SQL strings use `GUARDIAN.TABLE_NAME` without
double-quotes. PostgreSQL's identifier folding rule lowercases unquoted identifiers,
so `GUARDIAN.REQUESTS` → `guardian.requests` at parse time. The actual schema and
tables are uppercase (`"GUARDIAN"."REQUESTS"` etc.) because the Prisma migration
preserved the original SQL Server casing. Fix: wrap schema and table names in
double-quotes everywhere raw SQL is used: `"GUARDIAN"."REQUESTS"`.

No T-SQL-specific syntax errors (TOP, GETDATE, NOLOCK, etc.) were observed in this
initial sweep — those will surface in subsequent passes as the 500/401 auth blocks
are cleared.

---

## Priority Fix Order

1. **`server/auth.ts`** — Fix JWT strategy raw SQL (`GUARDIAN.USERS`, `GUARDIAN.USER_ROLES`).
   Unblocks ALL 401 endpoints: my-notices, audit, invites, securities-notices.
2. **`server/routes/requests.ts`** — Fix `GUARDIAN.REQUESTS` raw SQL (59 raw SQL calls per task plan).
   Unblocks `/api/requests` and `/api/requests/assigned/me`.
3. **`server/routes/forms-groups.ts`** — Fix `GUARDIAN.FORMS_GROUPS` raw SQL.
   Unblocks `/api/forms-groups`.

After steps 1–3, re-probe all 401 endpoints to surface any handler-level SQL errors.
