# Schema-drift repairs made during PG migration — FOR USER REVIEW

The TS server had queries referencing columns/tables not in the `GUARDIAN` schema
(already broken pre-migration). Per decision, these were REPAIRED onto the current
schema. Each repair below is a behavior/API change worth confirming.

## roles.ts (commit ca3f27e)
- `ROLE_PERMISSIONS`: code used `PERMISSION_ID` (int) + `STATUS` ('A'/'D'); real schema has
  `PERMISSION_KEY` (varchar) + `GRANTED` (boolean). Rewrote GET/POST/PUT/DELETE accordingly.
- **API shape change:** `GET /api/roles/:id` now returns `permissions: ["home.requestQueue", ...]`
  (string keys) instead of `[1,2,3]` (int IDs). Frontend consumers reading numeric IDs are affected.
- **Semantics change:** permission removal is now a hard `DELETE` (was soft `STATUS='D'`); POST/PUT
  upsert via `ON CONFLICT`. No more phantom soft-deleted rows.

## external.ts (commit ca3f27e) — mounted at /api/external
- `NOTICES`: `NOTICE_TITLE`→`TITLE`, `NOTICE_TEXT`→`CONTENT`, `CREATED_DATE`→`ISSUE_DATE`; recipient
  scoping via `NOTICE_RECIPIENTS.RECIPIENT_USER_ID` (NOTICES has no USER_ID/EXTERNAL_USER columns).
- `NOTICE_RESPONSES`: `RESPONSE_ID`→`NOTICE_RESPONSE_ID`, `RESPONSE_TEXT`→`RESPONSE_MESSAGE`,
  `CREATED_DATE`→`RESPONSE_DATE`.
- `FORM_VALUES` table (does not exist) → `FORMS_INSTANCE_VALUES`; form-value writes now create a
  `FORMS_INSTANCE` row first (RETURNING its PK) then insert values. **Verify this matches intended
  external-user form-submission behavior.**

## workflow.ts (commit ca3f27e) — NOT mounted in index.ts (dead/unreachable)
- References `WORKFLOW_STEPS`, which does not exist in any schema. Mechanical TOP→LIMIT applied, but
  the table is absent and routes aren't mounted. **Recommend: confirm whether workflow routes are
  intended to ship; if not, delete the file. If yes, the WORKFLOW_STEPS table must be designed.**

## (running list — appended as later files are repaired)

## roles.ts predefined-vs-custom inconsistency (commit ca3f27e) — found in verification
- Predefined roles (IDs 1–6) return permissions as INT arrays from a hardcoded code map;
  custom roles (DB-backed) now return PERMISSION_KEY STRINGS. Same endpoint, two shapes.
  **Recommend deciding one canonical permission representation** (the frontend MATRIX in
  src/utils/permissions.ts uses string keys). The predefined int map may itself be legacy.

## notices.ts (commit ac948b6)
- `IS_DELETED = 0`/`IS_ACTIVE = 1` → `= false`/`= true` (boolean columns). Behavior-equivalent.

## subpoena-riders.ts (commit ac948b6)
- `IS_PII` was read from `GUARDIAN.FIELDS` (no such column); relocated to `GUARDIAN.FORMS_FIELDS.IS_PII`
  (verified). Confirm the join semantics match intended PII gating.

## group.ts (commit ac948b6)
- `NOTICES` remap (TITLE/ISSUE_DATE) like external.ts; response aliases preserved → API shape unchanged.
- SECURITY: `companyFilter` interpolation split into parameterized `$queryRaw` templates.

## isAdmin.ts (commit ac948b6)
- SECURITY: `decoded.id` moved from inline interpolation to `$1` positional param.

## external.ts repairs are COMPILE-verified only
- `requireExternalUser` does a DB check Ernest doesn't satisfy, so /api/external/* couldn't be
  runtime-tested as a normal user. Needs a real external-user fixture + notice assignment to verify.
