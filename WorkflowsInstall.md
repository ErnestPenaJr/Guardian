# WorkflowsInstall.md — Workflow Template Management for .NET / React Port

> **Audience:** Claude Code working in a .NET 8/9 + ASP.NET Core + EF Core target project with a React frontend.
> **Source:** Guardian MVP (Node/Express/Prisma + React/TS) — `/Users/epena/Desktop/www/projects/Guardian MVP/`.
> **Goal:** Reproduce the **Workflow Template Management** layer — the admin modals, first-time-admin wizard, and `notice`/`request` template type taxonomy that sit on top of the form-builder API.

**Prerequisites in the target project** — these must already be in place:
- Everything in **FormBuilderInstall.md** is installed: `FORMS`, `FIELDS`, `FORMS_FIELDS` tables; the `/api/custom-templates` endpoints (`GET`, `GET /:id`, `POST`, `PUT /:id`, `PATCH /:id/publish`, `DELETE /:id`); `/api/forms` endpoints; `TEMPLATE_TYPE` + `STATUS` columns on FORMS.
- JWT middleware + `CompanyScopingMiddleware` + role policies — **FormBuilderInstall.md §4**.
- React frontend already proxies `/api` to the .NET host.

This doc is **mostly UX / frontend** because the heavy lifting is already in the form-builder install. The .NET tasks here are small: a few permission tweaks, a `Self-Service`-type carve-out, and one new helper endpoint.

---

## 0. Definition of Done

- [ ] `/admin/workflow-templates?type=notice` and `?type=request` both render a list of company templates scoped by `TEMPLATE_TYPE`.
- [ ] Admins (role 1 or 6) can create, edit (via the form-builder page), publish, activate/deactivate.
- [ ] **Delete** requires **Super Admin (role 6) only**; the backend rejects role 1 with 403.
- [ ] Draft templates show an amber "Draft (not in pickers)" badge and never appear in Create-Notice / Create-Request pickers.
- [ ] Publishing a draft is one click (no confirmation dialog) and fires a toast.
- [ ] `STATUS` and `IS_ACTIVE` are kept in sync per the rules in §4.
- [ ] First-time-admin detection works: first user in a company who is admin/super-admin AND has zero `IS_ACTIVE && !IS_DELETED` company templates sees the wizard automatically on `/home` load.
- [ ] The wizard's "Next" from Step 1 navigates the user to `/form-builder/new?...&returnTo=/home&returnSection=admin` — **does NOT** keep them in the modal.
- [ ] `TEMPLATE_TYPE` is one of `'notice' | 'request'`. `'Self-Service'` is a UI-only option that is disabled and unused server-side. Document why (see §3.3).

---

## 1. Scope vs. siblings

| What | Where |
|---|---|
| `/api/custom-templates` CRUD + publish | **FormBuilderInstall.md** |
| `/api/forms` + `/api/fields` + `/api/field-types` | **FormBuilderInstall.md** |
| `FORMS`, `FIELDS`, `FORMS_FIELDS`, `FORMS_INSTANCE*` schema | **FormBuilderInstall.md** |
| Notice distribution, recipients, contact groups | **notices.md** |
| Request lifecycle, tasks, work progress | **RequestsInstall.md** |
| **Admin modals + wizard + template-type taxonomy** | **this doc** |

If a topic touches both this doc and a sibling, the sibling is canonical and this doc links to it.

---

## 2. React components to install

Copy these files unchanged into the target React app (relative to `src/`):

| File | Lines | Purpose |
|---|---:|---|
| `components/CustomWorkflowTemplateModal.tsx` | ~666 | Main admin UI: list / create / publish / activate / delete templates by type |
| `components/WorkflowManagementModal.tsx` | ~325 | Legacy modal — kept for any pages still referencing it; safe to retire after audit |
| `components/CreateTemplateModal.tsx` | ~221 | Lightweight "create" modal: name + type + description + internal/external flags → navigates to form builder |
| `components/TemplateSelector.tsx` | ~38 | Simple presentational list of templates with chevron — used inside other modals |
| `pages/admin/WorkflowTemplatesAdmin.tsx` | ~20 | Router page mounted at `/admin/workflow-templates` — reads `?type=` query and renders `CustomWorkflowTemplateModal` with `formType` prop |
| `services/customTemplateService.ts` | — | API client wrapping `/api/custom-templates/*` (already required by FormBuilderInstall) |
| `types/template.ts` | ~51 | Shared TypeScript types |

**Dependencies on the React side** (mostly already present from form-builder install):
- `react-modal`
- `react-toastify`
- `lucide-react`
- `react-icons/fa`
- `sweetalert2` (for delete confirmation in legacy `WorkflowManagementModal`)
- A `GuardianSweetAlert` helper (in `src/utils/`) — copy verbatim from source

**Router additions** (`src/router.tsx` or equivalent):

```tsx
<Route path="/admin/workflow-templates" element={<WorkflowTemplatesAdmin />} />
// Existing form-builder route required:
<Route path="/form-builder/new" element={<FormBuilderPage />} />
<Route path="/form-builder/:formId" element={<FormBuilderPage />} />
```

---

## 3. Template-type taxonomy

### 3.1 The three options shown in the UI

| Label | Value | Server-side | Notes |
|---|---|---|---|
| Requests | `request` | Stored in `TEMPLATE_TYPE` | Drives Create Request picker |
| Notice | `notice` | Stored in `TEMPLATE_TYPE` | Drives Create Notice picker |
| Self-Service | `Self-Service` | **Disabled in UI** | Reserved for future; no backend code paths consume it yet |
| Survey | `survey` | Used only by `CreateTemplateModal.tsx` | Treated as `request` server-side; safe to omit if you don't need it |
| Other | `other` | Same — treated as `request` server-side | |

**Do not extend `TEMPLATE_TYPE` to accept anything other than `'notice'` and `'request'` on the server** until product decides. If `CreateTemplateModal` sends `survey` / `other` / `Self-Service`, coerce to `request` before insert.

### 3.2 `STATUS` lifecycle

| `STATUS` | `IS_ACTIVE` | Appears in Create picker? | Buttons shown |
|---|---|---|---|
| `draft` | `1` (default) | **No** | Edit Fields · Publish · Delete |
| `draft` | `0` | **No** | Edit Fields · Publish · Delete |
| `active` | `1` | **Yes** | Edit Fields · Deactivate · Delete |
| `active` | `0` | **No** (hidden by `IS_ACTIVE` filter) | Edit Fields · Activate · Delete |
| `inactive` | `0` | **No** | Edit Fields · Activate · Delete |
| `inactive` | `1` | (illegal — never persist this combo) | — |

Picker visibility on the Create-Notice / Create-Request modals filters `WHERE STATUS = 'active' AND IS_ACTIVE = 1`. Anything else is admin-only.

### 3.3 `STATUS` ↔ `IS_ACTIVE` mirroring rules (critical)

When `PUT /api/custom-templates/:id` includes `IS_ACTIVE`:

```csharp
var existing = await db.Forms.FindAsync(id);
var newStatus = existing.Status;          // preserve

if (body.IsActive.HasValue && existing.Status != "draft")
{
    newStatus = body.IsActive.Value ? "active" : "inactive";
}
// drafts are NEVER silently published by toggling IS_ACTIVE
```

**The single most-important behavior** in this whole feature: *drafts stay drafts.* Deactivating a draft must not promote it to `inactive`.

---

## 4. UX: CustomWorkflowTemplateModal

The main component. Implements the entire admin workflow-template page.

### 4.1 Props

```ts
interface CustomWorkflowTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew?: () => void;                 // optional override; default opens internal create form
  formType?: 'notice' | 'request';          // when set, locks type and scopes the GET filter
}
```

### 4.2 Layout

- Header: title (varies by `formType` — "Notice Templates" / "Request Templates" / "Workflow Templates"), close button, search box, status filter (`all|active|draft|inactive`), "Create New Template" button (admin-gated).
- Stats strip: total / active / draft / inactive counts.
- Grid: responsive 1/2/3 columns of template cards.
- Each card: icon · name · type badge · status badge · description (truncated) · created date · field count · action buttons.

### 4.3 Status badges (preserve exact UX)

- **Draft** — amber pill with dot, text `Draft (not in pickers)`. This explicit "(not in pickers)" copy is intentional and reduces support tickets — keep it.
- **Active** — green pill, text `Active`.
- **Inactive** — gray pill, text `Inactive`.
- **Type pill** — colored by type (notice = sky/blue, request = indigo).

### 4.4 Action buttons (per card)

| Button | Condition | Action |
|---|---|---|
| Edit Fields | admin | `navigate('/form-builder/' + FORM_ID + '?returnTo=/admin/workflow-templates&returnSection=admin')` |
| Publish | admin AND `STATUS === 'draft'` | `customTemplateService.publish(id)` → toast → reload list |
| Activate | admin AND `IS_ACTIVE === false` | `customTemplateService.updateFields(id, { IS_ACTIVE: true }, [])` |
| Deactivate | admin AND `IS_ACTIVE === true` AND `STATUS !== 'draft'` | `customTemplateService.updateFields(id, { IS_ACTIVE: false }, [])` |
| Delete | **super admin only (role 6)** | `GuardianSweetAlert.showConfirmation(...)` → `customTemplateService.remove(id)` |

### 4.5 Inline "Create Template" form (Step 0 of the wizard)

The same modal hosts the create form (no nested modal). It collects:
- Name (required, 100 char max)
- Type (dropdown; **disabled** if `formType` prop is set — locked)
- Description (500 char max with counter)

On submit:
1. `POST /api/custom-templates` with `{ form: { FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE }, fields: [] }`.
2. Server returns the new `FORM_ID` with `STATUS='draft'`.
3. Client navigates to `/form-builder/{newFormId}?returnTo=/admin/workflow-templates&returnSection=admin&type={formType}`.

### 4.6 Permission gating in JSX

```tsx
const hasAdminRole = useCallback(() => {
  if (!user) return false;
  const arr = user.roles?.some((r: any) => r.id === 1 || r.id === 6);
  const str = user.role === '1' || user.role === '6';
  return arr || str;
}, [user]);

const isSuperAdmin = useCallback(() => {
  if (!user) return false;
  return user.roles?.some((r: any) => r.id === 6) || user.role === '6';
}, [user]);
```

`hasAdminRole()` gates Create / Edit / Publish / Activate / Deactivate. `isSuperAdmin()` gates Delete.

---

## 5. UX: First-time admin wizard

The wizard isn't a separate component — it's a runtime *trigger* that opens `NewRequestModal` (already in the codebase from RequestsInstall.md) in step 0 with no `initialFormData`. Detection lives in `pages/Home.tsx`.

### 5.1 Detection (translate to your `Home` page on first paint)

```tsx
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (hasCheckedForExistingTemplates) return;
    if (!isAdmin()) { setHasCheckedForExistingTemplates(true); return; }

    const companyId = user?.companyId ?? user?.COMPANY_ID;
    if (!companyId) { setHasCheckedForExistingTemplates(true); return; }

    // 1) Account creator? -- first row when listing by USER_ID asc
    const companyUsers = await api.get(`/api/users/company/${companyId}`);
    const isAccountCreator = companyUsers?.data?.[0]?.USER_ID === user?.id;
    if (!isAccountCreator) { setHasCheckedForExistingTemplates(true); return; }

    // 2) Any active company templates?
    const forms = await formService.getAllForms();
    const companyForms = (forms ?? []).filter(f =>
      f.COMPANY_ID === companyId && f.IS_ACTIVE && !f.IS_DELETED
    );

    if (!cancelled && companyForms.length === 0) {
      setShowFirstTimeWorkflowModal(true);
    }
    setHasCheckedForExistingTemplates(true);
  })();
  return () => { cancelled = true; };
}, [user, hasCheckedForExistingTemplates]);
```

Trigger rules — **all three must hold**:
1. Caller is Admin (role 1) or Super Admin (role 6).
2. Caller is the first user in the company (lowest `USER_ID`).
3. Company has zero rows in `FORMS` with `IS_ACTIVE=1 AND IS_DELETED=0`.

Once true, render `NewRequestModal` with `isTemplateForm = false` and no `initialFormData`.

### 5.2 The three steps (in `NewRequestModal`)

**Step 0 — Type selection.** Radio: Requests / Self-Service (disabled, tooltip "Coming soon") / Notice. Required.

**Step 1 — Name + description.** Both fields required. On "Next":

```tsx
if (step === 1 && !isTemplateForm) {
  const params = new URLSearchParams({
    name: formData.name.trim(),
    type: formData.formType,
    description: formData.description.trim(),
    returnTo: '/home',
    returnSection: 'admin',
  });
  handleClose();
  navigate(`/form-builder/new?${params.toString()}`);
  return;
}
```

**Step 2** is **NOT** part of the wizard — the user lands on the form-builder page directly. This is intentional: keeping the user in a modal for field editing was unwieldy and was removed (commit `9d0ae74`).

### 5.3 Completion path

1. User builds fields on `/form-builder/new`.
2. Saves — `POST /api/custom-templates` creates row with `STATUS='draft'`.
3. User clicks **Publish** on the form-builder page → `PATCH /api/custom-templates/:id/publish`.
4. Toast: "Template published."
5. Navigate back to `/home?section=admin` (from `returnTo` + `returnSection`).
6. Next time the user logs in, the company-templates check returns a non-empty list and the wizard does not re-open.

---

## 6. Backend changes (small)

Most of the API surface is already implemented per FormBuilderInstall.md. Apply these adjustments:

### 6.1 Tighten `DELETE /api/custom-templates/:id` to Super Admin only

The form-builder install used `Policies.CanManageForms` (role 1 OR 6). Override for delete:

```csharp
options.AddPolicy(Policies.CanDeleteWorkflowTemplate, p =>
    p.RequireAssertion(c =>
        c.User.FindAll("roles").Select(x => int.Parse(x.Value))
              .Contains(RoleConstants.SuperAdmin)));
```

Apply the policy to the delete action:

```csharp
[HttpDelete("{id:int}")]
[Authorize(Policy = Policies.CanDeleteWorkflowTemplate)]
public async Task<IActionResult> Delete(int id) { /* ... */ }
```

If a role-1 Admin hits the endpoint, return `403 { "error": "Only Super Admin can delete templates." }`.

### 6.2 Validate `TEMPLATE_TYPE` on create

The form-builder install accepts whatever the client sends. Tighten on create:

```csharp
private static readonly HashSet<string> AllowedTemplateTypes = new(StringComparer.Ordinal) { "notice", "request" };

[HttpPost]
[Authorize(Policy = Policies.CanManageForms)]
public async Task<IActionResult> Create([FromBody] CreateCustomTemplateDto body)
{
    var type = (body.Form?.TemplateType ?? "request").ToLowerInvariant();
    // coerce UI-only labels to 'request' silently
    if (type is "survey" or "other" or "self-service") type = "request";
    if (!AllowedTemplateTypes.Contains(type))
        return BadRequest(new { error = $"Invalid TEMPLATE_TYPE '{type}'." });

    // ... insert with STATUS='draft', IS_ACTIVE=true, TEMPLATE_TYPE=type
}
```

Force `STATUS = 'draft'` server-side regardless of body. Force `IS_ACTIVE = true` so the new template is "ready to publish" rather than DOA.

### 6.3 Partial-update preservation on `PUT /api/custom-templates/:id`

Use nullable fields and only update what was sent (this is the bug fixed by commit `99b435b`):

```csharp
public class UpdateCustomTemplateDto
{
    public CustomTemplateFormPatch? Form { get; set; }
    public List<FieldDto>? Fields { get; set; }
    [JsonPropertyName("IS_ACTIVE")] public bool? IsActiveTopLevel { get; set; }   // shortcut shape sometimes sent
}

public class CustomTemplateFormPatch
{
    [JsonPropertyName("FORM_NAME")] public string? FormName { get; set; }
    [JsonPropertyName("FORM_DESCRIPTION")] public string? FormDescription { get; set; }
    [JsonPropertyName("IS_ACTIVE")] public bool? IsActive { get; set; }
    [JsonPropertyName("IS_PUBLIC")] public bool? IsPublic { get; set; }
}

[HttpPut("{id:int}")]
[Authorize(Policy = Policies.CanManageForms)]
public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomTemplateDto body)
{
    var f = await db.Forms.FirstOrDefaultAsync(x =>
        x.FormId == id && x.CompanyId == HttpContext.CompanyId() && !x.IsDeleted);
    if (f is null) return NotFound();

    var newName        = body.Form?.FormName        ?? f.FormName;
    var newDescription = body.Form?.FormDescription ?? f.FormDescription;
    var newIsActive    = body.Form?.IsActive ?? body.IsActiveTopLevel ?? f.IsActive;
    var newIsPublic    = body.Form?.IsPublic ?? f.IsPublic;

    var newStatus = f.Status;
    if ((body.Form?.IsActive.HasValue == true || body.IsActiveTopLevel.HasValue) && f.Status != "draft")
        newStatus = newIsActive ? "active" : "inactive";

    f.FormName = newName;
    f.FormDescription = newDescription;
    f.IsActive = newIsActive;
    f.IsPublic = newIsPublic;
    f.Status = newStatus;
    f.UpdateUserId = HttpContext.UserId();
    f.UpdateDate = DateTime.UtcNow;

    if (body.Fields is not null) { /* replace FORMS_FIELDS — same path as FormBuilderInstall §6.3 */ }

    await db.SaveChangesAsync();
    return Ok(new { success = true, message = "Custom template updated successfully" });
}
```

### 6.4 First-time admin detection (no new endpoint required)

The wizard detection runs entirely client-side using two existing endpoints:
- `GET /api/users/company/{companyId}` — already exists per CLAUDE.md.
- `GET /api/forms` — already exists per FormBuilderInstall.md.

No backend addition needed. If you want a single round-trip optimization, you can add:

```
GET /api/admin/first-time-status
→ { needsWizard: boolean }
```

Optional. Skip until you measure it matters.

---

## 7. Implementation order

### Phase A — Frontend
1. Copy the seven files listed in §2 into `src/`.
2. Add the `/admin/workflow-templates` route.
3. Wire the `NewRequestModal` first-time-admin trigger into `pages/Home.tsx` (§5.1).
4. Confirm `CreateTemplateModal` (if used) coerces non-`notice`/`request` types to `request` *before* POST (or rely on §6.2 server-side coercion).

**Validate:** Visit `/admin/workflow-templates?type=notice` as an Admin — the modal opens, list is empty (assuming no templates), "Create New Template" button is visible and locked to type `notice`.

### Phase B — Backend tightening
5. Add `Policies.CanDeleteWorkflowTemplate` (super-admin only) and apply to the delete action.
6. Add server-side `TEMPLATE_TYPE` validation + coercion (§6.2).
7. Implement partial-update preservation on `PUT /api/custom-templates/:id` (§6.3) — **this is the most important backend task in this doc.**
8. Confirm `POST /api/custom-templates` server-side forces `STATUS='draft'` and `IS_ACTIVE=true` regardless of body.

**Validate (Postman):**
- `POST` creates with `STATUS='draft'`.
- `PUT` with `{ "IS_ACTIVE": false }` only does **not** clear `FORM_NAME` or `FORM_DESCRIPTION`.
- `PUT` with `{ "IS_ACTIVE": false }` on a `draft` row leaves `STATUS='draft'` (does NOT switch to `inactive`).
- `DELETE` returns 403 for a role-1 user, 200 for role-6.

### Phase C — End-to-end wizard
9. Log in to a **fresh** company as the first user (role 1).
10. Confirm the wizard auto-opens on `/home`.
11. Walk through Step 0 → Step 1 → navigation to `/form-builder/new`.
12. Add fields, save, publish.
13. Verify next login does not re-open the wizard.

---

## 8. Pitfalls — read before coding

1. **STATUS and IS_ACTIVE are orthogonal**, not a single flag. Drafts can be "inactive" (still drafts). Active rows can be deactivated (become `inactive`, not `draft`). The mirroring in §3.3 is intentional and must be preserved.

2. **Partial PUT must not NULL-out columns** (commit `99b435b`). Use nullable DTO fields and fall back to the existing row's values for anything not sent. The frontend sends `{ "IS_ACTIVE": false }` for the activate/deactivate toggle — that single-field shape must work.

3. **Delete is super-admin only (role 6).** Frontend's `WorkflowManagementModal` historically allowed role-1 to attempt delete; the backend rejects it. Either gate the button on `isSuperAdmin()` or display a meaningful 403 toast on failure.

4. **The wizard does NOT trap users in a modal for field editing.** Step 1's "Next" must `navigate('/form-builder/new?...')` and close the modal. This was a deliberate refactor (commit `9d0ae74`) — don't revert it.

5. **`Self-Service` is UI-only.** Keep the radio option labeled "Self-Service" but disabled with a tooltip. Do not let it reach the API. If it ever does, server-side coercion (§6.2) maps it to `request`.

6. **Company isolation on `GET /api/custom-templates`** also applies to the public-notice-read carve-out (`?type=notice&status=active`). Don't accidentally expose other companies' notice templates while implementing the public-read rule.

7. **First-time-admin detection must not race.** If the user navigates away from `/home` before the two API calls resolve, the modal will pop up on the wrong screen. Guard with `cancelled` flag in the effect's cleanup (§5.1).

8. **No confirmation dialog on Publish** is correct. Publishing is reversible (deactivate), and the source's UX is intentionally one-click. Do not add a confirm modal.

9. **Toast wording matters for the support team:**
   - On publish: `Template "{name}" published`.
   - On deactivate: `Template "{name}" deactivated`.
   - On delete: `Template "{name}" deleted`.
   Keep these strings stable — support docs reference them.

10. **`COMPANY_ID` is `decimal(38,0)`** on `FORMS` (see RequestsInstall.md pitfall #1). Frontend reads it back as a number — keep that round-trip safe.

---

## 9. Smoke test (manual, ~10 min)

1. Log in to a fresh company as the first user (Admin, role 1).
2. The first-time wizard auto-opens on `/home`. **Pass:** modal visible.
3. Select "Requests" → enter name + description → Next. **Pass:** browser at `/form-builder/new?name=...&type=Requests&returnTo=/home&returnSection=admin`.
4. Add 2 fields, save. **Pass:** new row in `FORMS` with `TEMPLATE_TYPE='request'`, `STATUS='draft'`, `IS_ACTIVE=1`.
5. Click **Publish** on the form builder. **Pass:** toast, row updates to `STATUS='active'`.
6. Navigate to `/admin/workflow-templates?type=request`. **Pass:** card visible, green Active badge, no draft amber pill.
7. Click **Deactivate**. **Pass:** card flips to Inactive badge, row now `STATUS='inactive'`, `IS_ACTIVE=0`.
8. Click **Activate**. **Pass:** back to Active.
9. As role-6 Super Admin, click **Delete** → confirm. **Pass:** `IS_DELETED=1` in DB, card disappears from list.
10. As role-1 Admin in a different company, hit the same `DELETE` via Postman. **Pass:** 403.
11. Log out, log back in. **Pass:** wizard does NOT reopen.

If all 11 steps pass, the install is complete.

---

## 10. Reference — source files in the Guardian MVP repo

| Concern | File |
|---|---|
| Main modal | `src/components/CustomWorkflowTemplateModal.tsx` |
| Legacy modal | `src/components/WorkflowManagementModal.tsx` |
| Create entry modal | `src/components/CreateTemplateModal.tsx` |
| Template selector list | `src/components/TemplateSelector.tsx` |
| Router page | `src/pages/admin/WorkflowTemplatesAdmin.tsx` |
| First-time wizard host | `src/pages/NewRequestModal.tsx` (steps 0–1) |
| First-time detection | `src/pages/Home.tsx` (effect block) |
| API client | `src/services/customTemplateService.ts` |
| Shared types | `src/types/template.ts` |
| Form-builder page (target of wizard navigation) | `src/pages/FormBuilderPage.tsx` |
| Backend: `GET /api/custom-templates` | `server.cjs` ~10434 |
| Backend: `POST /api/custom-templates` | `server.cjs` ~10578 |
| Backend: `PUT /api/custom-templates/:id` (partial-update fix) | `server.cjs` ~10688 |
| Backend: `PATCH /api/custom-templates/:id/publish` | `server.cjs` ~10918 |
| Backend: `DELETE /api/custom-templates/:id` (role 6 only) | `server.cjs` ~10961 |

---

## 11. Out of scope

- **Self-Service workflow** — the radio option exists in the UI as disabled; no implementation work is required until the feature ships.
- **Global / cross-company templates** (`COMPANY_ID IS NULL`) — only Super Admin can create these in the source, and the workflow modal doesn't expose that path. Skip unless explicitly requested.
- **Template versioning / history** — there isn't any. Edits mutate in place. Don't introduce a versioning model without product sign-off.
- **Bulk activate / deactivate** — UI shows individual buttons per card; no multi-select. Skip.
- **Workflow approval chains, routing rules, SLAs** — not part of this app. These belong to a different "workflows" concept (BPMN-style) that does not exist here.

When the user asks for any of these, push back and confirm what they actually need.
