# JAFAR Global Workflow Templates — Design Spec

**Date:** 2026-05-28
**Author:** Ernest + Claude (brainstorming session)
**Status:** Approved — ready for implementation plan

## Problem

Today, every workflow template created through the admin dashboard is hard-stamped with the creator's `COMPANY_ID` (server.cjs:8871), so templates are always company-isolated. There is no path for a platform-level (JAFAR) user to publish a template that all companies can see and use. The read side already supports this — `GET /api/forms` returns rows where `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1` to every caller (server.cjs:8746) — but no endpoint creates such rows, and there is no UI to manage them.

## Goal

Let users with the JAFAR role (role ID 6) create and manage **global workflow templates** that are visible to every company. Company admins (role ID 1) can see globals in their existing Workflow Management modal as read-only entries with a "Clone to my company" action that materializes an independent, editable copy.

## Out of scope

- Self-service templates. `'self-service'` appears as a TypeScript `formType` value in `src/types/formBuilder.ts:48` but is not a persisted `TEMPLATE_TYPE` in the database (`POST /api/forms` normalizes anything that isn't `'notice'` to `'request'` at server.cjs:8852). Deferred until self-service becomes a first-class backend concept.
- Promoting an existing company-scoped template to global. MVP supports creating globals from scratch only.
- Linked / forked clones with sync. Clones are independent copies; later edits to the global do not propagate.
- Migrating existing template endpoints from the legacy CommonJS servers into the TypeScript server. This spec stays in the existing CJS runtime (Approach A — see Architecture).

## Decisions captured

| Question | Decision |
|---|---|
| Where does JAFAR create globals? | Dedicated "Global Templates" card on the admin dashboard, JAFAR-only |
| Template scope | Request + Notice (self-service deferred) |
| How do company admins see globals? | Visible in their existing Workflow Management modal with a "Global" badge; Edit/Delete disabled; Clone action available |
| Clone relationship | Independent copy — no link back to the parent global |
| Promote existing → global | Not in MVP; create-from-scratch only |
| Audit logging | Full audit trail to `GUARDIAN.AUDIT_LOG` for every create/edit/delete/clone |
| Server runtime for new endpoints | Legacy CJS (`server.cjs` source of truth, mirrored to `server-production.js` and `server.js`) |

## Architecture

A global template is a row in `GUARDIAN.FORMS` where `COMPANY_ID IS NULL`, `ORGANIZATION_ID IS NULL`, and `IS_PUBLIC = 1`. The existing `GET /api/forms` already returns these to every company, so the read path is unchanged. The write path gains a "global mode" gated by JAFAR. Company admins gain a clone action that materializes an independent company-owned copy.

Three concrete surfaces:

1. **Backend** — `server.cjs` (source of truth) with mirrors to `server-production.js` and `server.js`. Endpoints: extended `POST /api/forms`, new `GET /api/forms/global`, new `POST /api/forms/:id/clone`, tightened permissions on `PUT /api/forms/:id` and `DELETE /api/forms/:id`.
2. **Admin dashboard** — a new `GlobalTemplatesCard.tsx` rendered only when `isJafarUser()` is true, opening a `GlobalTemplatesModal.tsx` that reuses `SimpleFormBuilder` for create/edit pre-flagged as global.
3. **Existing `WorkflowManagementModal.tsx`** — globals appear with a "Global" badge and a "Clone to my company" button; Edit/Delete are disabled on global rows for non-JAFAR users.

No new tables. The triple `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1` encodes "is global." Audit entries go to the existing `GUARDIAN.AUDIT_LOG`.

## Data model

### Global template row shape in `GUARDIAN.FORMS`

| Column | Company template (today) | Global template (new) |
|---|---|---|
| `COMPANY_ID` | user's company | `NULL` |
| `ORGANIZATION_ID` | user's company | `NULL` |
| `IS_PUBLIC` | `0` (or as passed) | `1` (forced when `IS_GLOBAL` is true) |
| `IS_INTERNAL` / `IS_EXTERNAL` | as passed | as passed (JAFAR controls audience same as today) |
| `TEMPLATE_TYPE` | `'request'` or `'notice'` | `'request'` or `'notice'` (JAFAR picks at create) |
| `NOTICE_CATEGORY` | optional, only for notices | same, only for notices |
| `CREATE_USER_ID` / `UPDATE_USER_ID` | normal | JAFAR's userId — preserves authorship without schema change |

The canonical "is global" test is `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1`. Centralize this in a single helper (`isGlobalForm(row)` in CJS, mirrored to TS types) so every endpoint reasons about it the same way.

### Fields

A global template's fields live in `GUARDIAN.FIELDS` and are linked via `GUARDIAN.FORMS_FIELDS` exactly like today. The existing `POST /api/forms` inserts fields with `ORGANIZATION_ID = ${req.companyId}` (server.cjs:8899) — for global templates we stamp `ORGANIZATION_ID = NULL` instead. The read path needs no change.

### Clone semantics

`POST /api/forms/:id/clone` reads the source form + its fields, then performs the same insert pattern as `POST /api/forms` using the caller's `COMPANY_ID` and `ORGANIZATION_ID`. The cloned form gets a fresh `FORM_ID`; each field is copied to a fresh `GUARDIAN.FIELDS` row (fresh `FIELD_ID`) so future edits to the global's fields do not bleed into the clone. The clone's `FORM_NAME` is the source name unchanged; if a duplicate name exists in the caller's company's active forms, append ` (Copy)`.

### Audit events

Four new event types added to `AUDIT_EVENT_TYPES` (and the parallel constant in CJS):

| Event type | When | `COMPANY_ID` on audit row |
|---|---|---|
| `GLOBAL_TEMPLATE_CREATED` | JAFAR creates a global | `NULL` (platform-level) |
| `GLOBAL_TEMPLATE_MODIFIED` | JAFAR edits a global | `NULL` |
| `GLOBAL_TEMPLATE_DELETED` | JAFAR soft-deletes a global | `NULL` |
| `GLOBAL_TEMPLATE_CLONED` | Any admin clones a global | cloning admin's `COMPANY_ID` |

The existing `audit.viewFull` and `audit.export` permissions continue to cover these — admin (1) and super admin (6) see them in the existing audit UI.

## API surface

All endpoints in `server.cjs` (source of truth) with mirrors to `server.js` and `server-production.js`.

### 1. `POST /api/forms` — extended

Existing endpoint at `server.cjs:8829`. Accepts a new `IS_GLOBAL` flag on `req.body.form`.

```
const wantsGlobal = req.body.form.IS_GLOBAL === true;
if (wantsGlobal && !req.userRoleIds.includes(6)) {
  return res.status(403).json({ error: 'JAFAR access required to create global templates' });
}
const companyIdToUse = wantsGlobal ? null : req.companyId;
const isPublicValue  = wantsGlobal ? 1 : (form.IS_PUBLIC ? 1 : 0);
const orgIdForFields = wantsGlobal ? null : req.companyId;
```

The `INSERT INTO GUARDIAN.FORMS` uses `${companyIdToUse}` (resolves to `NULL` literal when null), `${isPublicValue}`, and field inserts use `${orgIdForFields}`. Writes a `GLOBAL_TEMPLATE_CREATED` audit row when `wantsGlobal`.

### 2. `GET /api/forms/global` — new (JAFAR-only)

Returns the platform-wide list of globals for the management card.

```sql
SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE,
       IS_INTERNAL, IS_EXTERNAL, NOTICE_CATEGORY,
       CREATE_DATE, CREATE_USER_ID, UPDATE_DATE
FROM GUARDIAN.FORMS
WHERE COMPANY_ID IS NULL
  AND ORGANIZATION_ID IS NULL
  AND IS_PUBLIC = 1
  AND IS_DELETED = 0
  AND TEMPLATE_TYPE IN ('request', 'notice')
ORDER BY TEMPLATE_TYPE, CREATE_DATE DESC
```

Inline role-6 check at the top; returns 403 otherwise.

### 3. `PUT /api/forms/:id` — tightened

Add a global-row check before the existing update logic:
- If the target row has `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL`, require role 6. Non-JAFAR users get 403.
- If role 6 edits a global, write `GLOBAL_TEMPLATE_MODIFIED` audit row.
- All other behavior unchanged.

### 4. `DELETE /api/forms/:id` — tightened

Existing endpoint at server.cjs:8946. Same gate as PUT: only role 6 can soft-delete a global. Writes `GLOBAL_TEMPLATE_DELETED`. Existing clones in other companies are independent rows and are untouched.

### 5. `POST /api/forms/:id/clone` — new

Any authenticated caller can clone any template visible to them. Logic:

- Load source form and its fields via the existing query patterns.
- Reject (404) if source has `IS_DELETED = 1` or is not visible to the caller (apply the same visibility predicate as `GET /api/forms`: globals visible to all, company templates visible only to that company).
- Insert a new `GUARDIAN.FORMS` row with `COMPANY_ID = req.companyId`, `ORGANIZATION_ID = req.companyId`, `IS_PUBLIC = 0`, `CREATE_USER_ID = req.userId`, copying `FORM_NAME` / `FORM_DESCRIPTION` / `TEMPLATE_TYPE` / `NOTICE_CATEGORY` / `IS_INTERNAL` / `IS_EXTERNAL` from source.
- For each source field: insert a fresh `GUARDIAN.FIELDS` row (with `ORGANIZATION_ID = req.companyId`), then insert the junction row in `GUARDIAN.FORMS_FIELDS`.
- If `FORM_NAME` collides with another active form in the same company, append ` (Copy)`.
- Writes `GLOBAL_TEMPLATE_CLONED` audit row when the source is a global. If the source is a company-owned template, no global-audit event is written.
- Returns `{ FORM_ID, FORM_NAME, TEMPLATE_TYPE, fields: [...] }`.

**Source-agnostic backend, scoped UI (intentional):** The endpoint accepts both global and company-owned sources because the clone logic is identical for both. The UI only surfaces the Clone button on global rows (see `WorkflowManagementModal.tsx` changes below); cloning a company-owned template via the API is not a user-facing feature in this MVP. Keeping the backend source-agnostic avoids an unnecessary "source must be global" check and leaves the door open for future UX (e.g. duplicating an existing company template) without an endpoint change.

### Request/response contracts (concise)

```
POST /api/forms
  Body: { form: { ..., IS_GLOBAL?: boolean }, fields: [...] }
  403 if IS_GLOBAL and caller lacks role 6.

GET /api/forms/global
  Returns: [{ FORM_ID, FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE, ... }]
  403 if caller lacks role 6.

PUT /api/forms/:id
  403 if target is global and caller lacks role 6.

DELETE /api/forms/:id
  403 if target is global and caller lacks role 6.

POST /api/forms/:id/clone
  Body: {} (no body needed; clone is into caller's company)
  Returns: { FORM_ID, FORM_NAME, TEMPLATE_TYPE, fields: [...] }
  403 / 404 if source not visible to caller.
```

## UI components

### `GlobalTemplatesCard.tsx` (new) — `src/components/admin/`

Dashboard card rendered in `AdminDashboard.tsx`, conditionally shown only when `isJafarUser()` is true.

- Title: "Global Templates"
- Subtitle: "JAFAR access only — visible to all companies"
- Body: count of existing globals (e.g. "12 active global templates")
- Primary button: "Manage Global Templates" → opens `GlobalTemplatesModal`

Uses the same Bootstrap classes and spacing as neighboring admin cards. Reuses the `isJafarUser()` helper pattern from `SimpleFormBuilder.tsx:271`.

### `GlobalTemplatesModal.tsx` (new) — `src/components/admin/`

Management modal modeled on `WorkflowManagementModal.tsx`. Loads `GET /api/forms/global` on open. Lists globals with columns: Name, Template Type (Request / Notice badge), Audience (Internal / External chips), Created, Actions (Edit, Delete). Filter dropdown for Template Type. Empty state: "No global templates yet — create your first one."

**Navigation to the form builder.** `GlobalTemplatesModal` mirrors the parent-callback pattern from `WorkflowManagementModal`:

- **Props:** `onCreateGlobal(templateType: 'request' | 'notice')` and `onEditGlobal(formId, formData)`, supplied by `AdminDashboard`.
- **Create flow:** Header "+ New Global Template" button opens an inline template-type picker (Request / Notice). On pick, the modal calls `onClose()` then `onCreateGlobal(templateType)`. `AdminDashboard` is responsible for navigating to the form builder route with `IS_GLOBAL=true` in route state and the chosen `TEMPLATE_TYPE` pre-applied.
- **Edit flow:** Edit row action calls `formService.getFormById(formId)` to load the form + fields, then calls `onClose()` + `onEditGlobal(formId, formData)` — same pattern as `WorkflowManagementModal.handleEditTemplate` (line 64). The form builder is opened with `IS_GLOBAL=true` in route state so the save handler keeps the row global on `PUT`.
- **Save:** On submit the builder calls `createForm` (with `IS_GLOBAL: true` on the payload) or `PUT /api/forms/:id` as today; no separate save path.

Delete uses the existing SweetAlert2 confirmation pattern from `WorkflowManagementModal.handleDeleteTemplate` (line 87), with tightened copy: "This will delete the global template for all companies. Existing clones in companies are not affected."

### `SimpleFormBuilder.tsx` — small change

When `formData.IS_GLOBAL === true` (passed in via props or route state), the existing save handler sends `IS_GLOBAL: true` in the POST body. No new UI control inside the builder — JAFAR's path to setting this is through the Global Templates card.

Header gets a small badge when in global mode: "🌐 Editing Global Template" so JAFAR sees what they're working on.

### `WorkflowManagementModal.tsx` — three changes

- **Global badge:** for any row where `COMPANY_ID === null && ORGANIZATION_ID === null && IS_PUBLIC === 1`, render a "🌐 Global" pill next to the name.
- **Edit/Delete gating:** for global rows, disable Edit and Delete buttons unless `isJafarUser()` is true. Tooltip on hover: "Only JAFAR users can edit global templates."
- **Clone action:** add a "Clone to my company" button on every global row, visible to all admins (role 1 and role 6). Click calls `POST /api/forms/:id/clone`, on success closes the modal and toasts "Template cloned. Edit it from your company templates."

### `formService.ts` additions

- `getGlobalForms()` → `GET /api/forms/global`
- `cloneForm(formId)` → `POST /api/forms/:id/clone`
- Existing `createForm()` extended to accept an optional `IS_GLOBAL` field on the form payload.

`DbForm` interface already has `TEMPLATE_TYPE?: string | null` and `COMPANY_ID`. No type changes needed beyond exposing the new service methods.

## Permissions & security

### Role-6 gates (JAFAR only)

- `GET /api/forms/global` → 403 if caller is not role 6.
- `POST /api/forms` with `IS_GLOBAL: true` → 403 if caller is not role 6.
- `PUT /api/forms/:id` where target row is global → 403 if caller is not role 6.
- `DELETE /api/forms/:id` where target row is global → 403 if caller is not role 6.

CJS role-check pattern (matching existing endpoints):

```js
if (!Array.isArray(req.userRoleIds) || !req.userRoleIds.includes(6)) {
  return res.status(403).json({ error: 'JAFAR access required' });
}
```

Relies on `getAuthenticatedUserCompany` populating `req.userRoleIds` (it does — the JWT carries roles).

### Authenticated-only (no role gate)

- `POST /api/forms/:id/clone` — any authenticated user can clone, subject to visibility. The endpoint applies the same visibility predicate as `GET /api/forms` before allowing the clone. External users (role 5) remain restricted by the form allowlist, so they cannot clone forms they cannot see.

### Frontend defense-in-depth (UX guards, not the primary gate)

- `GlobalTemplatesCard` only renders when `isJafarUser()`.
- Edit/Delete buttons on global rows in `WorkflowManagementModal` are disabled for non-JAFAR.
- Server checks are authoritative.

### Cross-company isolation

Globals deliberately bypass company isolation on read — that is the feature. Writes and audit entries preserve `CREATE_USER_ID` / `UPDATE_USER_ID` so we always know which JAFAR user touched a global. Cloned templates flip back into normal company-isolated mode (`COMPANY_ID = caller's company`), so clones inherit standard isolation rules. There is no leakage path from a clone back to other companies.

### JWT

No changes. Role 6 in `req.userRoleIds` is already what the existing JAFAR-aware code uses.

## Testing

### Backend smoke tests (Bun-runnable, under `src/tests/`)

`global-templates.smoke.test.ts` covers:

- JAFAR creates a global → row has `COMPANY_ID IS NULL`, `IS_PUBLIC = 1`, audit row written.
- Non-JAFAR sends `IS_GLOBAL: true` → 403.
- JAFAR edits a global → audit row written, row updated.
- Non-JAFAR PUT / DELETE on a global → 403.
- `GET /api/forms/global` as non-JAFAR → 403.
- Company A admin clones a global → new row with `COMPANY_ID = A`, clone audit written.
- Company A admin clones their own company template → succeeds (no global audit event).
- External user (role 5) cannot clone forms outside their allowlist.
- JAFAR deletes a global → existing clones in companies survive untouched.

### Cross-company isolation regression test

- Two companies' admins both list `GET /api/forms` → both see the same global, neither sees the other's company-owned templates.

### Frontend manual QA checklist (run before merge)

1. Log in as JAFAR — Global Templates card visible on admin dashboard.
2. Log in as company admin (role 1) — card hidden.
3. JAFAR creates a Request-type global → other company admins see it in their Workflow Management modal with the Global badge, Edit/Delete disabled.
4. Company admin clicks "Clone to my company" → new editable template appears under their own templates.
5. JAFAR edits the global → clones unchanged; original global reflects changes for all companies.
6. JAFAR deletes the global → it disappears from all companies' lists; clones remain.
7. Notice-type global flows through `AddNoticeModal` / `SelectNoticeModal` correctly.

No new test infrastructure needed. Uses the existing Bun test runner and the fixtures the Securities Notice MVP smoke tests use.

## Risks and notes

- **Triple-server sync.** Every backend change must land in `server.cjs`, `server-production.js`, and `server.js`. The pipeline copies `server-production.js` → `server.js` at deploy, but local production testing reads `server.js` directly. Follow the project's standard sync protocol from CLAUDE.md.
- **Audit log table.** The `GUARDIAN.AUDIT_LOG` migration (`migrations/securities_notice/01_audit_log.sql`) must already be applied in every environment where this feature ships. If it is not, the audit insert calls will fail and create-global will fail with it. Confirm before deployment.
- **`isGlobalForm` helper.** Inline duplication of the triple-null predicate across five endpoints is error-prone. Centralize in one helper function and reuse.
- **Legacy NULL rows.** The existing `GET /api/forms` includes `(ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)`. There may be pre-existing rows that match this predicate without being intentional globals. Before shipping, run a one-time query against staging to surface any existing matches and decide per-row whether they are legitimately global or need backfilling.
- **Form name collision on clone.** The ` (Copy)` suffix can stack (`Foo (Copy) (Copy)`). Acceptable for MVP.
- **JAFAR cloning their own globals.** A JAFAR user who is also a member of a company will see the Clone button on global rows in their own Workflow Management modal. This is intentional — JAFAR may want to test a clone flow from a real company perspective.
