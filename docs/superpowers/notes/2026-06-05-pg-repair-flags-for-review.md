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
