# Known pre-existing schema↔model drifts (found during PG migration Phase 0)

These are NOT migration regressions — they fail identically on SQL Server because
the Prisma model already disagreed with the `GUARDIAN` schema. The Postgres clone
faithfully mirrors `GUARDIAN` (verified: generator copied the right schema; there
are separate `dbo.TASKS`/`dbo.REQUESTS` tables that DO have these columns).

## TASKS.TRACKINGID — model field with no GUARDIAN column (ACTIONABLE at task routes)
- `schema.prisma` `TASKS` model declares `TRACKINGID String? @db.NVarChar(4000)`.
- `GUARDIAN.TASKS` has 9 columns and NO `TRACKINGID` (only `dbo.TASKS` has it).
- Effect: `prisma.tASKS.findMany/findUnique/update/create` → `column TASKS.TRACKINGID does not exist`.
- Used by: `server/routes/workflow.ts` (create/findUnique/update), `server/routes/group.ts:112` (findMany).
- Decision deferred to task-route porting (Plan Tasks 9–10): either (a) drop `TRACKINGID`
  from the model, or (b) add a nullable `TRACKINGID` column to `GUARDIAN.TASKS` (DB + generator DDL)
  if the task feature genuinely needs it. Pick based on how workflow.ts uses the value.

## REQUESTS.FORM_ID — Decimal model field vs int column (BENIGN)
- Model: `FORM_ID Decimal? @db.Decimal(38, 0)`; `GUARDIAN.REQUESTS.FORM_ID` is `integer`.
- Empirically benign: `prisma.rEQUESTS.findMany`/`create` work (Prisma coerces int↔Decimal). No action.

## Not-applicable code-review findings (no runtime impact; we never run prisma migrate/db push)
- `@db.Text` vs `varchar(2000)` on USERS.NOTIFICATION_PREFERENCES; missing `@db.Timestamp(6)`
  on some DateTime fields; DB columns absent from models (TEMPLATE_VALUES_JSON, FIELDS.OPTIONS, etc.).
  Prisma client reads/writes are unaffected; extra DB columns are ignored. Left as-is.
