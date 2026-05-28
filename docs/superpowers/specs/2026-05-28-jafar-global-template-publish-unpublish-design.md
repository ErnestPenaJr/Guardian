# JAFAR Global Template Publish / Unpublish — Design Spec

**Date:** 2026-05-28
**Author:** Ernest + Claude (brainstorming session)
**Status:** Approved — ready for implementation plan
**Predecessor:** `2026-05-28-jafar-global-workflow-templates-design.md` (this feature builds on that)

## Problem

The recently shipped JAFAR Global Templates feature lets JAFAR users (role 6) create platform-wide templates visible to every company. But once a global is created, it is **immediately visible everywhere** — there is no "work in progress" state, no way to hide a published global without deleting it, no way to publish a partially-built draft later. The user-facing `CustomWorkflowTemplateModal` (the workflow that creates and manages templates for company users) already implements a three-state lifecycle: draft → active → active-but-deactivated, with explicit Publish, Activate, and Deactivate actions. Globals should follow the same lifecycle for UX consistency and operational safety.

A related leak: the existing `GET /api/forms` company-facing predicate only checks `IS_PUBLIC = 1` when including globals — it does **not** honor `STATUS` or `IS_ACTIVE`. So the three globals currently in dev DB with `STATUS='inactive'` would still leak to every company once the dashboard starts showing global rows under the new model. This spec closes that gap as part of the same change.

## Goal

Mirror the `CustomWorkflowTemplateModal` lifecycle for global templates. JAFAR creates a global as a draft, explicitly publishes it, and can deactivate/reactivate it after publication. Companies see only published-and-active globals.

## Out of scope

- New audit event types. We reuse `GLOBAL_TEMPLATE_MODIFIED` and record the state transition inside `EVENT_DETAIL`.
- Schema changes. The `STATUS` (`'draft' | 'active' | 'inactive'`) and `IS_ACTIVE` columns on `GUARDIAN.FORMS` already exist.
- Clone-related changes. Clones are independent company-owned rows; their `STATUS` lifecycle is governed by the existing workflow flow, not by this spec.
- The user-facing `CustomWorkflowTemplateModal` itself. This spec only touches the JAFAR-facing `GlobalTemplatesModal` and the underlying API surface.
- Backfilling the three existing inactive globals (`FORM_ID 1050/1051/1052`). Their `STATUS='inactive'` will continue to render as "Inactive" in the JAFAR modal; JAFAR can hand-publish them via the new Publish action if desired.

## Decisions captured

| Question | Decision |
|---|---|
| State model for globals | Full workflow parity: `'draft' | 'active' | 'inactive'` via `STATUS`, plus `IS_ACTIVE` boolean |
| Initial state on create | `STATUS='draft'`, `IS_ACTIVE=true` (matches CustomWorkflowTemplateModal) |
| Two dedicated endpoints (publish + active toggle) vs one omnibus PUT | Two endpoints — clearer audit semantics, simpler state-machine guards |
| New audit event types | None — reuse `GLOBAL_TEMPLATE_MODIFIED` with `detail.action` describing the transition |
| Backfill existing inactive globals | No — frontend just renders any non-`'draft'`/non-`'active'` STATUS as "Inactive" |

## State machine

| State name | `STATUS` | `IS_ACTIVE` | Visible to companies? | Transitions |
|---|---|---|---|---|
| **Draft** | `'draft'` | `true` | No | → *Publish* → Published & Active |
| **Published & Active** | `'active'` | `true` | **Yes** | → *Deactivate* → Published & Deactivated |
| **Published & Deactivated** | `'active'` | `false` | No | → *Activate* → Published & Active |
| **Legacy Inactive** (existing data only) | `'inactive'` | any | No | No transitions in this spec; can be hand-edited via Publish endpoint which is permissive about prev-state |

There is no Draft → Deactivated path and no direct Deactivated → Draft path. Draft is a one-time pre-publication state; once published, the row is only toggled between Active and Deactivated.

## Architecture

A small, surgical extension of the existing JAFAR Global Templates feature. Two new endpoints on the legacy CommonJS server, mirrored across `server.cjs` / `server.js` / `server-production.js`. One tightened predicate on the existing company-facing `GET /api/forms`. Two new methods on `formService`. The `GlobalTemplatesModal` gains state badges, status filter option, and three new buttons (Publish, Deactivate, Activate) — mirroring the layout of `CustomWorkflowTemplateModal` so the UX feels identical.

## Data model

No new columns, no new tables. The lifecycle is encoded using two existing columns:

- `GUARDIAN.FORMS.STATUS NVARCHAR(...)` — values: `'draft'`, `'active'`, `'inactive'` (legacy). New rows get `'draft'`.
- `GUARDIAN.FORMS.IS_ACTIVE BIT` — `true` by default; toggled by the Activate/Deactivate endpoint.

The `lib/globalForms.cjs` predicate (`isGlobalForm`) is unchanged. It still keys on `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1`. The `STATUS`/`IS_ACTIVE` checks are added at the **visibility** layer, not the **identity** layer.

## API surface

All endpoints in `server.cjs` (source of truth), mirrored to `server.js` and `server-production.js`.

### 1. Modified — `POST /api/forms` (IS_GLOBAL branch)

The existing handler does not write to `STATUS` at all (legacy non-global INSERTs leave the column NULL). Add explicit lifecycle defaults for new globals only, preserving non-global behavior:

```js
// Lifecycle defaults: globals start as draft; non-globals leave STATUS NULL.
const statusSql = wantsGlobal ? `'draft'` : 'NULL';
// IS_ACTIVE: globals always start active (so a Publish flips STATUS only);
// non-globals continue to honor form.IS_ACTIVE per the existing behavior.
const isActiveValue = wantsGlobal ? 1 : (form.IS_ACTIVE !== false ? 1 : 0);
```

Extend the `INSERT INTO GUARDIAN.FORMS` column list to include `STATUS` (the existing list doesn't have it). The interpolated value is always one of two literals (`'draft'` or `NULL`) — no user input flows in, so no escaping is required.

The audit row written on global create still uses `GLOBAL_TEMPLATE_CREATED`; we extend its `detail` to include the initial state: `{ formName, templateType, isInternal, isExternal, status: 'draft' }`. Non-global creates write no audit row (unchanged).

**Out of scope:** accepting a client-supplied `form.STATUS` for non-global creates. That's a separate concept (workflow templates' draft/publish flow) governed by the `customTemplateService` create path, not this endpoint.

### 2. Modified — `GET /api/forms` (company-facing visibility)

Currently includes globals via `(ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)` (server.cjs around line 8746). Tighten so globals are visible **only** when also `STATUS = 'active' AND IS_ACTIVE = 1`:

```sql
WHERE (
    ORGANIZATION_ID = ${req.companyId}
    OR COMPANY_ID = ${req.companyId}
    OR (
        ORGANIZATION_ID IS NULL
        AND COMPANY_ID IS NULL
        AND IS_PUBLIC = 1
        AND STATUS = 'active'
        AND IS_ACTIVE = 1
    )
)
AND IS_DELETED = 0
AND TEMPLATE_TYPE = 'request'
...
```

Same tightening applies to any other endpoint that surfaces globals to non-JAFAR users (e.g. `SelectFormModal`'s list, the notice picker). Audit: grep for `ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL` in the three server files and apply the same `STATUS='active' AND IS_ACTIVE=1` clause everywhere that displays templates to end users. **JAFAR-only views** (the new `GET /api/forms/global`) do **not** apply this filter — JAFAR sees every global regardless of state.

### 3. Modified — `GET /api/forms/global` (JAFAR list)

Add `STATUS` and `IS_ACTIVE` to the SELECT column list so the modal can render state badges. No predicate change — JAFAR still sees every active (non-deleted) global.

### 4. New — `PUT /api/forms/:id/publish`

JAFAR-only. Promotes a draft global to published-active.

```js
app.put('/api/forms/:id/publish', getAuthenticatedUserCompany, async (req, res) => {
    // - parseInt id, 400 if invalid
    // - Load target row (FORM_ID, COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC, STATUS, IS_ACTIVE, IS_DELETED, FORM_NAME)
    // - 404 if not found or IS_DELETED
    // - 403 if !isJafarActor(req) || !isGlobalForm(target)
    // - 409 if target.STATUS === 'active' (already published) — return { error: 'Already published', currentStatus }
    //   (Permissive note: also accept STATUS='inactive' transition to 'active' — useful for the legacy globals)
    // - UPDATE GUARDIAN.FORMS SET STATUS = 'active', IS_ACTIVE = 1, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
    //   WHERE FORM_ID = ${formId}
    // - Audit: __writeGlobalTemplateAudit({ eventType: GLOBAL_AUDIT_EVENTS.MODIFIED, actorUserId: actorUserId(req), actorRoleId: 6,
    //          formId, companyId: null, detail: { action: 'publish', prevStatus: target.STATUS, newStatus: 'active', formName: target.FORM_NAME } })
    // - Return { FORM_ID, STATUS: 'active', IS_ACTIVE: true }
});
```

Note on the 409: we accept Draft→Active and Inactive→Active as valid Publish transitions (the latter mostly to rescue the three legacy inactive globals). We reject Active→Active as a no-op.

### 5. New — `PUT /api/forms/:id/active`

JAFAR-only. Toggles `IS_ACTIVE` on a published (STATUS='active') global.

```js
app.put('/api/forms/:id/active', getAuthenticatedUserCompany, async (req, res) => {
    // - parseInt id, validate body { isActive: boolean }, 400 if missing/non-boolean
    // - Load target row, 404 if not found or IS_DELETED
    // - 403 if !isJafarActor(req) || !isGlobalForm(target)
    // - 409 if target.STATUS !== 'active' — return { error: 'Cannot activate/deactivate a non-published global', currentStatus }
    //   (Drafts must be Published first; legacy 'inactive' rows must be Published first.)
    // - UPDATE GUARDIAN.FORMS SET IS_ACTIVE = ${isActive ? 1 : 0}, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
    //   WHERE FORM_ID = ${formId}
    // - Audit: __writeGlobalTemplateAudit({ eventType: GLOBAL_AUDIT_EVENTS.MODIFIED, actorUserId: actorUserId(req), actorRoleId: 6,
    //          formId, companyId: null, detail: { action: isActive ? 'activate' : 'deactivate', isActive, formName: target.FORM_NAME } })
    // - Return { FORM_ID, STATUS: 'active', IS_ACTIVE: isActive }
});
```

### Request/response contracts (concise)

```
POST /api/forms            (existing endpoint)
  IS_GLOBAL=true branch now stamps STATUS='draft', IS_ACTIVE=true on create.

GET /api/forms             (existing endpoint)
  Globals visibility predicate tightened: STATUS='active' AND IS_ACTIVE=1 required.

GET /api/forms/global      (existing endpoint)
  Now includes STATUS and IS_ACTIVE in the response shape.

PUT /api/forms/:id/publish (new)
  Body: {} (no body)
  Returns: { FORM_ID, STATUS: 'active', IS_ACTIVE: true } | 403 | 404 | 409
  403 if not JAFAR or not a global.
  404 if row not found or deleted.
  409 if already STATUS='active'.

PUT /api/forms/:id/active (new)
  Body: { isActive: boolean }
  Returns: { FORM_ID, STATUS: 'active', IS_ACTIVE: <new value> } | 400 | 403 | 404 | 409
  400 if body missing or non-boolean isActive.
  403 if not JAFAR or not a global.
  404 if row not found or deleted.
  409 if STATUS != 'active' (must publish first).
```

## Frontend changes

### `src/services/formService.ts`

Add two methods on the `formService` default export:

```ts
publishGlobal(formId: number): Promise<{ FORM_ID: number; STATUS: 'active'; IS_ACTIVE: boolean }> {
  return api.put(`/api/forms/${formId}/publish`).then(r => r.data);
}

setGlobalActive(formId: number, isActive: boolean): Promise<{ FORM_ID: number; STATUS: 'active'; IS_ACTIVE: boolean }> {
  return api.put(`/api/forms/${formId}/active`, { isActive }).then(r => r.data);
}
```

Extend `DbForm` (or the inline `GlobalForm = DbForm & { ... }` shape in `GlobalTemplatesModal`) to include `STATUS?: 'draft' | 'active' | 'inactive' | null` and `IS_ACTIVE?: boolean`.

### `src/components/admin/GlobalTemplatesModal.tsx`

Mirror the visual treatment of `CustomWorkflowTemplateModal`:

1. **State filter dropdown** — currently has All / Request / Notice. Replace (or supplement) with a status filter: All / Draft / Active / Inactive. Two filter dropdowns is OK; or combine the type filter into one row and keep both visible.
2. **Stats row** — add Draft count and Deactivated count alongside Total / Request / Notice.
3. **State badges on each card** — render based on `STATUS` + `IS_ACTIVE`:
   - `STATUS='draft'` → amber pill: "Draft (not in pickers)"
   - `STATUS='active'` + `IS_ACTIVE=true` → green pill: "Active"
   - `STATUS='active'` + `IS_ACTIVE=false` → gray pill: "Deactivated"
   - Other (e.g. legacy `'inactive'`) → gray pill: "Inactive"
4. **Card actions** — add three buttons next to the existing Edit Fields + Delete:
   - **Publish** (emerald) — visible when `STATUS='draft' || STATUS='inactive'`. Calls `formService.publishGlobal(formId)`, toasts success, refreshes list.
   - **Deactivate** (yellow) — visible when `STATUS='active' && IS_ACTIVE=true`. Calls `formService.setGlobalActive(formId, false)`, toasts, refreshes.
   - **Activate** (green) — visible when `STATUS='active' && IS_ACTIVE=false`. Calls `formService.setGlobalActive(formId, true)`, toasts, refreshes.

These exactly mirror `CustomWorkflowTemplateModal.tsx:592-623` so the JAFAR view feels identical to the user-facing view.

### `src/components/WorkflowManagementModal.tsx` (company admin view)

No changes required — the 🌐 Global badge + locked Edit/Delete + Clone behavior is unchanged. The only effect of this spec on the company admin view is that globals not in the Active+IS_ACTIVE=true state simply do not appear in the list (because `GET /api/forms` now filters them out). The badge / lock / clone code only runs for rows that pass through that endpoint.

## Audit log

Reuse `GLOBAL_TEMPLATE_MODIFIED`. The `EVENT_DETAIL` JSON gains an `action` discriminator:

```jsonc
// On publish:
{ "action": "publish", "prevStatus": "draft", "newStatus": "active", "formName": "..." }

// On deactivate:
{ "action": "deactivate", "isActive": false, "formName": "..." }

// On activate:
{ "action": "activate", "isActive": true, "formName": "..." }

// On regular edit (existing behavior, unchanged):
{ "prevName": "...", "newName": "..." }
```

`COMPANY_ID` on the audit row stays `NULL` (these are platform-level events). `ACTOR_USER_ID` uses the existing `actorUserId(req)` helper so JAFAR impersonators are correctly attributed.

## Permissions

All three actions (Publish, Deactivate, Activate) require **JAFAR** (role 6) and the target row must be a global. Both checks via the existing `isJafarActor(req)` and `isGlobalForm(target)` helpers. Non-JAFAR users — even Admin (role 1) — receive 403. External users (role 5) receive the same 403 — they have no business touching globals.

## Migration concern

The three existing globals with `STATUS='inactive'` will remain hidden from companies (they fail the tightened `GET /api/forms` predicate). JAFAR can hand-publish them through the new modal by clicking Publish on each, which lands them in Active state.

**No database backfill is required.** The `STATUS='inactive'` value is treated by the frontend as a non-published state (rendered as "Inactive") and the Publish endpoint accepts the inactive→active transition.

## Testing

Append to `src/tests/global-templates.smoke.test.ts` (the standalone Bun smoke script):

- **Case 12:** New global is created with STATUS='draft', not visible in company `GET /api/forms`.
- **Case 13:** JAFAR publishes a draft → 200, STATUS becomes 'active', audit row written with `action: 'publish'`. Global now appears in company `GET /api/forms`.
- **Case 14:** JAFAR deactivates a published global → 200, IS_ACTIVE becomes false, audit `action: 'deactivate'`. Disappears from company `GET /api/forms`.
- **Case 15:** JAFAR reactivates the deactivated global → 200, IS_ACTIVE true, audit `action: 'activate'`. Reappears in company list.
- **Case 16:** Non-JAFAR (role 1) calls publish/active → 403.
- **Case 17:** Publish on an already-active global → 409.
- **Case 18:** Active toggle on a draft → 409 (must publish first).
- **Case 19:** Active toggle with non-boolean body → 400.

All cases env-gated on JAFAR + (optionally) admin credentials, matching the existing test conventions.

## Risks and notes

- **Other endpoints that surface globals.** The `GET /api/forms` predicate tightening must be applied wherever globals are listed for company users. Audit list:
  - `server.cjs` GET /api/forms (request-list)
  - Any notice-listing endpoints that include globals
  - `SelectFormModal` data source (uses GET /api/forms, so covered transitively)
  Grep before shipping: `ORGANIZATION_ID IS NULL.*COMPANY_ID IS NULL.*IS_PUBLIC` in each of the three server files. Each match should either gain the `AND STATUS='active' AND IS_ACTIVE=1` clause or be documented as "JAFAR-only, intentionally exempt."
- **`STATUS` column may permit values outside our enum.** The DB schema doesn't enforce the values; legacy data has `'inactive'`. Frontend handles unknown statuses by rendering the gray "Inactive" badge.
- **Race condition between status read and update.** The new endpoints SELECT then UPDATE non-transactionally (same pattern as existing PUT/DELETE in this codebase). Concurrent publish+deactivate could land in an unexpected state. Acceptable for MVP given low concurrency on JAFAR-only actions.
- **Triple-server sync.** All backend changes mirrored across `server.cjs`, `server.js`, `server-production.js`. The existing `lib/globalForms.cjs` + `isJafarActor` / `actorUserId` helpers are reused.
- **The `Publish` button is permissive about prev-state.** It accepts both Draft→Active and (legacy) Inactive→Active. This is intentional so JAFAR can rescue the existing three inactive globals without a manual DB UPDATE. Active→Active returns 409 (no-op).
