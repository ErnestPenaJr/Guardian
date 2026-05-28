# JAFAR Global Workflow Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let JAFAR users (role 6) create globally-visible workflow templates from a dedicated admin-dashboard card, and let company admins clone those globals into independent, editable copies in their own company.

**Architecture:** Extend the existing legacy CommonJS Express server (`server.cjs` as source of truth, mirrored to `server-production.js` and `server.js`). A global template is a row in `GUARDIAN.FORMS` with `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1`; the existing `GET /api/forms` already returns these to every company so the read path is unchanged. New CJS endpoints add the write surface, with role-6 gates and audit logging to `GUARDIAN.AUDIT_LOG`. Frontend gets a new `GlobalTemplatesCard` + `GlobalTemplatesModal` in the admin dashboard, and the existing `WorkflowManagementModal` gains a "🌐 Global" badge, locked Edit/Delete on globals for non-JAFAR users, and a "Clone to my company" action.

**Tech Stack:**
- Backend: Node.js + Express (CommonJS), Prisma raw SQL against SQL Server, the existing CJS `__writePlatformAudit` helper pattern for audit writes
- Frontend: React 18 + TypeScript, React Bootstrap, react-toastify, sweetalert2, existing `useAuth` hook
- Tests: Bun test runner (`*.smoke.test.ts` under `src/tests/`), modeled after `src/tests/securities-notice-workflow.smoke.test.ts`

**Spec:** `docs/superpowers/specs/2026-05-28-jafar-global-workflow-templates-design.md`

---

## File Structure

**New files:**
- `lib/globalForms.cjs` — Shared helper exporting `isGlobalForm(row)` and the four `GLOBAL_TEMPLATE_*` event-type constants
- `src/components/admin/GlobalTemplatesCard.tsx` — Dashboard card, JAFAR-only
- `src/components/admin/GlobalTemplatesModal.tsx` — Management modal (list / edit / delete + entry to create flow)
- `src/components/admin/GlobalTemplateTypePicker.tsx` — Small modal that asks "Request or Notice?" before opening the form builder for a new global
- `src/tests/global-templates.smoke.test.ts` — Backend smoke tests

**Modified files:**
- `server.cjs` — Extend `POST /api/forms`, add `GET /api/forms/global`, add `POST /api/forms/:id/clone`, tighten `PUT /api/forms/:formId` and `DELETE /api/forms/:id`, add `__writeGlobalTemplateAudit` helper
- `server-production.js` — Mirror of `server.cjs` changes
- `server.js` — Mirror of `server.cjs` changes
- `src/services/formService.ts` — Add `getGlobalForms()`, `cloneForm(formId)`; extend `createForm()` to accept `IS_GLOBAL`
- `src/pages/AdminDashboard.tsx` — Render `GlobalTemplatesCard` when JAFAR, wire `onCreateGlobal` / `onEditGlobal` callbacks to the form builder route
- `src/components/SimpleFormBuilder.tsx` — Accept `isGlobalTemplate` prop / route state; show 🌐 banner; pass `IS_GLOBAL: true` in `createForm` payload
- `src/pages/FormBuilderPage.tsx` — Read `IS_GLOBAL` from route state and propagate to `SimpleFormBuilder`
- `src/components/WorkflowManagementModal.tsx` — Render Global badge, gate Edit/Delete for non-JAFAR on globals, add Clone button + handler

---

## Pre-Implementation Verification

### Task 0: Verify environment + audit-log dependency

**Files:** none — verification only

- [ ] **Step 1: Confirm `GUARDIAN.AUDIT_LOG` exists in staging**

The Securities Notice MVP migration created this table. Confirm it's applied before this feature lands. Run from a shell that has the staging DATABASE_URL:

```bash
DATABASE_URL="<staging url>" bunx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS table_exists FROM sys.tables WHERE name = 'AUDIT_LOG' AND SCHEMA_NAME(schema_id) = 'GUARDIAN';
SQL
```

Expected: `table_exists = 1`. If `0`, apply `migrations/securities_notice/01_audit_log.sql` before proceeding.

- [ ] **Step 2: Scan for legacy `COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1` rows**

```bash
DATABASE_URL="<staging url>" bunx prisma db execute --stdin <<'SQL'
SELECT FORM_ID, FORM_NAME, TEMPLATE_TYPE, IS_DELETED, CREATE_DATE
FROM GUARDIAN.FORMS
WHERE COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_PUBLIC = 1 AND IS_DELETED = 0;
SQL
```

Expected: zero or a small number of rows. If rows are returned, decide per-row whether they should remain visible as globals or be archived. Document the decision in the PR description; the new feature will treat any such row as a global.

- [ ] **Step 3: Confirm the `lib/` directory deploys with the app**

The Securities Notice MVP introduced `lib/permissions.cjs` and the deploy pipeline copies `lib/` into the artifact. Confirm by:

```bash
grep -n "lib/" azure-pipelines.yml | head -10
```

Expected: at least one line copying or referencing `lib/`. If `lib/` is not copied by the pipeline, fix the pipeline before adding new helpers in `lib/`.

---

## Backend — Shared Helper

### Task 1: Add `lib/globalForms.cjs` helper module

**Files:**
- Create: `lib/globalForms.cjs`

- [ ] **Step 1: Create the helper file**

```js
// lib/globalForms.cjs
// Shared predicate + constants for JAFAR global workflow templates.
// A global template is a row in GUARDIAN.FORMS where ALL of:
//   COMPANY_ID IS NULL, ORGANIZATION_ID IS NULL, IS_PUBLIC = 1.

function isGlobalForm(row) {
    if (!row) return false;
    return row.COMPANY_ID == null
        && row.ORGANIZATION_ID == null
        && (row.IS_PUBLIC === 1 || row.IS_PUBLIC === true);
}

const GLOBAL_AUDIT_EVENTS = Object.freeze({
    CREATED: 'GLOBAL_TEMPLATE_CREATED',
    MODIFIED: 'GLOBAL_TEMPLATE_MODIFIED',
    DELETED: 'GLOBAL_TEMPLATE_DELETED',
    CLONED: 'GLOBAL_TEMPLATE_CLONED',
});

module.exports = {
    isGlobalForm,
    GLOBAL_AUDIT_EVENTS,
};
```

- [ ] **Step 2: Smoke-test the helper from the Node REPL**

```bash
node -e "const g = require('./lib/globalForms.cjs'); console.log(g.isGlobalForm({COMPANY_ID:null,ORGANIZATION_ID:null,IS_PUBLIC:1})); console.log(g.isGlobalForm({COMPANY_ID:54,ORGANIZATION_ID:54,IS_PUBLIC:1})); console.log(g.GLOBAL_AUDIT_EVENTS.CREATED);"
```

Expected:
```
true
false
GLOBAL_TEMPLATE_CREATED
```

- [ ] **Step 3: Commit**

```bash
git add lib/globalForms.cjs
git commit -m "feat(global-templates): add isGlobalForm helper + audit event constants"
```

---

### Task 2: Add `__writeGlobalTemplateAudit` helper to `server.cjs`

**Files:**
- Modify: `server.cjs` (add helper near `__writePlatformAudit` at line 10555)

- [ ] **Step 1: Add the new helper directly below `__writePlatformAudit`**

Locate `server.cjs:10566` (the closing `}` of `__writePlatformAudit`). Immediately after that closing brace, insert:

```js
// Audit helper for JAFAR global workflow templates. COMPANY_ID is NULL for
// platform-level events (create / edit / delete by JAFAR) and the cloning
// company's id for the company-scoped CLONED event. Modeled on
// __writePlatformAudit but parameterized so it can write either.
async function __writeGlobalTemplateAudit({ eventType, actorUserId, actorRoleId, formId, companyId, detail }) {
    await prisma.$executeRawUnsafe(
        `INSERT INTO GUARDIAN.AUDIT_LOG
            (EVENT_TYPE, ACTOR_USER_ID, ACTOR_ROLE_ID, TARGET_TYPE, TARGET_ID, EVENT_DETAIL, COMPANY_ID, CREATED_AT)
         VALUES
            (@P1, @P2, @P3, 'TEMPLATE', @P4, @P5, @P6, SYSUTCDATETIME());`,
        eventType,
        actorUserId,
        actorRoleId == null ? null : actorRoleId,
        String(formId),
        detail == null ? null : JSON.stringify(detail),
        companyId == null ? null : companyId
    );
}
```

- [ ] **Step 2: Require the new shared helper at the top of `server.cjs`**

Find the existing `require('./lib/permissions.cjs')` line (or any other `require('./lib/...')` line near the top of the file). Add immediately after it:

```js
const { isGlobalForm, GLOBAL_AUDIT_EVENTS } = require('./lib/globalForms.cjs');
```

If no `lib/` require exists near the top, place this line after the last `require()` at the head of the file.

- [ ] **Step 3: Verify the server still starts**

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" bun server.cjs &
SERVER_PID=$!
sleep 5
curl -s http://localhost:3001/api/health
kill $SERVER_PID
```

Expected: `/api/health` returns JSON with `status: "OK"`. If it fails, fix the require path or syntax before continuing.

- [ ] **Step 4: Commit**

```bash
git add server.cjs
git commit -m "feat(global-templates): add __writeGlobalTemplateAudit helper + require globalForms lib"
```

---

## Backend — Endpoints

### Task 3: Write failing smoke test for "JAFAR can create a global template"

**Files:**
- Create: `src/tests/global-templates.smoke.test.ts`

- [ ] **Step 1: Read the reference test pattern**

Open `src/tests/securities-notice-workflow.smoke.test.ts` and read the top ~80 lines to understand the project's smoke-test conventions (how the test boots the server / acquires a JWT / makes HTTP requests / cleans up). The new tests will follow the same pattern.

- [ ] **Step 2: Create the first failing test**

Create `src/tests/global-templates.smoke.test.ts` with one initial test. Copy the imports + setup boilerplate from `securities-notice-workflow.smoke.test.ts` (the `loginAs(...)`, `apiCall(...)`, `BASE_URL`, etc. helpers). Then add:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
// ... (other imports + helpers copied from securities-notice-workflow.smoke.test.ts)

describe('Global Workflow Templates — JAFAR create flow', () => {
  let jafarToken: string;

  beforeAll(async () => {
    jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
  });

  it('JAFAR can create a global template (COMPANY_ID = NULL, IS_PUBLIC = 1)', async () => {
    const res = await apiCall('POST', '/api/forms', jafarToken, {
      form: {
        FORM_NAME: `Smoke Global ${Date.now()}`,
        FORM_DESCRIPTION: 'created by smoke test',
        TEMPLATE_TYPE: 'request',
        IS_GLOBAL: true,
        IS_INTERNAL: true,
        IS_EXTERNAL: false,
      },
      fields: [],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.form.FORM_ID).toBeGreaterThan(0);
    expect(res.body.form.COMPANY_ID).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and verify it FAILS**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: FAIL. The current `POST /api/forms` ignores `IS_GLOBAL` and stamps the caller's `COMPANY_ID` (server.cjs:8871), so `res.body.form.COMPANY_ID` will equal the JAFAR test user's company id, not null. Confirm this is the failure reported before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/tests/global-templates.smoke.test.ts
git commit -m "test(global-templates): failing test — POST /api/forms IS_GLOBAL stamps null company"
```

---

### Task 4: Extend `POST /api/forms` to honor `IS_GLOBAL` (JAFAR only)

**Files:**
- Modify: `server.cjs:8829-8943`

- [ ] **Step 1: Replace the body of `POST /api/forms`**

Locate `server.cjs:8829` (the `app.post('/api/forms', ...)` declaration). Replace lines 8829-8943 with the version below. The changes from the existing code are:
- Reads `IS_GLOBAL` from the body and returns 403 if non-JAFAR sets it
- Computes `companyIdToUse`, `isPublicValue`, `orgIdForFields` based on global vs not
- Stamps `NULL` (literal) for company/organization columns when global
- Writes a `GLOBAL_TEMPLATE_CREATED` audit row after a successful insert when global

```js
app.post('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { form, fields } = req.body;
        const wantsGlobal = form && form.IS_GLOBAL === true;

        const userRoleIds = Array.isArray(req.userRoleIds) ? req.userRoleIds : [];
        if (wantsGlobal && !userRoleIds.includes(6)) {
            return res.status(403).json({ error: 'JAFAR access required to create global templates' });
        }

        console.log(`📝 Creating new form (global=${wantsGlobal}) for company: ${req.companyId}`);

        if (!form || !form.FORM_NAME) {
            return res.status(400).json({ error: 'Form name is required' });
        }

        const escapedFormName = form.FORM_NAME.replace(/'/g, "''");
        const escapedFormDescription = (form.FORM_DESCRIPTION || '').replace(/'/g, "''");

        const isInternal = form.IS_INTERNAL === false ? 0 : 1;
        const isExternal = form.IS_EXTERNAL === false ? 0 : 1;

        const rawTemplateType = (form.TEMPLATE_TYPE || 'request').toString().toLowerCase();
        const templateType = rawTemplateType === 'notice' ? 'notice' : 'request';

        const NOTICE_CATEGORY_ALLOW = ['ANCM', 'SEC', 'GEN', 'TRGT'];
        const noticeCategorySql =
            templateType === 'notice' && NOTICE_CATEGORY_ALLOW.includes(form.NOTICE_CATEGORY)
                ? `'${form.NOTICE_CATEGORY}'`
                : 'NULL';

        // Globals get NULL company/organization and IS_PUBLIC = 1; non-globals
        // get the caller's company stamped on both columns and IS_PUBLIC = whatever
        // the caller passed (default 0).
        const companyIdSql = wantsGlobal ? 'NULL' : `${req.companyId}`;
        const organizationIdSql = wantsGlobal ? 'NULL' : `${req.companyId}`;
        const isPublicValue = wantsGlobal ? 1 : (form.IS_PUBLIC ? 1 : 0);
        const orgIdForFieldsSql = wantsGlobal ? 'NULL' : `${req.companyId}`;

        const formResult = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                IS_INTERNAL, IS_EXTERNAL, TEMPLATE_TYPE, NOTICE_CATEGORY,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                '${escapedFormName}', '${escapedFormDescription}', ${companyIdSql}, ${organizationIdSql}, ${isPublicValue}, ${form.IS_ACTIVE !== false ? 1 : 0}, 0,
                ${isInternal}, ${isExternal}, '${templateType}', ${noticeCategorySql},
                GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `);

        const formId = formResult[0].FORM_ID;
        console.log(`✅ Created form ${formId} (global=${wantsGlobal})`);

        const createdFields = [];
        if (fields && Array.isArray(fields) && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const escapedFieldName = field.FIELD_NAME.replace(/'/g, "''");
                const escapedOptions = field.OPTIONS != null ? `'${String(field.OPTIONS).replace(/'/g, "''")}'` : 'NULL';

                const fieldResult = await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FIELDS (
                        FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED, [OPTIONS],
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID, ORGANIZATION_ID
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        '${escapedFieldName}', ${field.FIELD_TYPE_ID}, ${field.IS_REQUIRED ? 1 : 0}, ${field.IS_ACTIVE !== false ? 1 : 0}, 0, ${escapedOptions},
                        GETDATE(), GETDATE(), ${req.userId}, ${req.userId}, ${orgIdForFieldsSql}
                    )
                `);

                const fieldId = fieldResult[0].FIELD_ID;

                await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FORMS_FIELDS (
                        FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                    )
                    VALUES (
                        ${formId}, ${fieldId}, ${field.IS_REQUIRED ? 1 : 0}, ${field.SEQUENCE || i + 1}, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                    )
                `);

                createdFields.push({ ...field, FIELD_ID: fieldId, FORM_ID: formId });
            }
        }

        // Audit: only globals get a platform-level audit row.
        if (wantsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.CREATED,
                actorUserId: req.userId,
                actorRoleId: 6,
                formId,
                companyId: null,
                detail: { formName: form.FORM_NAME, templateType, isInternal: !!isInternal, isExternal: !!isExternal },
            });
        }

        res.json({
            success: true,
            form: {
                ...form,
                FORM_ID: formId,
                COMPANY_ID: wantsGlobal ? null : req.companyId,
                ORGANIZATION_ID: wantsGlobal ? null : req.companyId,
                IS_PUBLIC: isPublicValue,
            },
            fields: createdFields,
        });

    } catch (error) {
        console.error('❌ Error creating form:', error);
        res.status(500).json({ error: 'Failed to create form', message: error.message });
    }
});
```

- [ ] **Step 2: Run the failing test from Task 3 — verify it PASSES**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS.

- [ ] **Step 3: Add a "non-JAFAR is forbidden" test and verify it passes**

Append to `src/tests/global-templates.smoke.test.ts` inside the same `describe` block:

```ts
  it('non-JAFAR user gets 403 when sending IS_GLOBAL=true', async () => {
    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const res = await apiCall('POST', '/api/forms', adminToken, {
      form: {
        FORM_NAME: `Smoke Should Fail ${Date.now()}`,
        TEMPLATE_TYPE: 'request',
        IS_GLOBAL: true,
      },
      fields: [],
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/JAFAR/i);
  });
```

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS for both tests.

- [ ] **Step 4: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-templates): POST /api/forms honors IS_GLOBAL for JAFAR (role 6)"
```

---

### Task 5: Add `GET /api/forms/global` endpoint (JAFAR-only list)

**Files:**
- Modify: `server.cjs` (add new endpoint immediately after the existing `GET /api/forms` block, around line 8826)

- [ ] **Step 1: Write the failing test**

Append to `src/tests/global-templates.smoke.test.ts`:

```ts
describe('Global Workflow Templates — JAFAR list', () => {
  it('GET /api/forms/global returns globals for JAFAR', async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const res = await apiCall('GET', '/api/forms/global', jafarToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Every returned row must satisfy the global predicate
    for (const row of res.body) {
      expect(row.COMPANY_ID).toBeNull();
    }
  });

  it('GET /api/forms/global returns 403 for non-JAFAR', async () => {
    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const res = await apiCall('GET', '/api/forms/global', adminToken);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: the two new tests FAIL with 404 (route does not exist yet).

- [ ] **Step 3: Add the endpoint**

In `server.cjs`, locate the closing `});` of `GET /api/forms` (around line 8826) and insert immediately after:

```js
// JAFAR-only: list all active global workflow templates (platform-wide).
app.get('/api/forms/global', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userRoleIds = Array.isArray(req.userRoleIds) ? req.userRoleIds : [];
        if (!userRoleIds.includes(6)) {
            return res.status(403).json({ error: 'JAFAR access required' });
        }

        const rows = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE,
                   IS_INTERNAL, IS_EXTERNAL, NOTICE_CATEGORY,
                   ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC,
                   CREATE_DATE, CREATE_USER_ID, UPDATE_DATE
            FROM GUARDIAN.FORMS
            WHERE COMPANY_ID IS NULL
              AND ORGANIZATION_ID IS NULL
              AND IS_PUBLIC = 1
              AND IS_DELETED = 0
              AND TEMPLATE_TYPE IN ('request', 'notice')
            ORDER BY TEMPLATE_TYPE, CREATE_DATE DESC, FORM_ID DESC
        `;

        // Belt-and-suspenders: filter through isGlobalForm in case the predicate ever drifts.
        const globals = rows.filter(isGlobalForm);
        res.json(globals);
    } catch (error) {
        console.error('❌ Error listing global templates:', error);
        res.status(500).json({ error: 'Failed to list global templates', message: error.message });
    }
});
```

- [ ] **Step 4: Run — expect pass**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-templates): add GET /api/forms/global (JAFAR-only list)"
```

---

### Task 6: Tighten `PUT /api/forms/:formId` for global rows

**Files:**
- Modify: `server.cjs:7480-7548` (and the field-update block that follows)

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/global-templates.smoke.test.ts`:

```ts
describe('Global Workflow Templates — JAFAR edit', () => {
  let globalFormId: number;

  beforeAll(async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const create = await apiCall('POST', '/api/forms', jafarToken, {
      form: { FORM_NAME: `Edit Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    });
    globalFormId = create.body.form.FORM_ID;
  });

  it('JAFAR can edit a global template + audit row is written', async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const newName = `Edited ${Date.now()}`;
    const res = await apiCall('PUT', `/api/forms/${globalFormId}`, jafarToken, {
      name: newName,
      description: 'edited by smoke',
      formFields: [],
    });
    expect(res.status).toBe(200);

    const audit = await prisma.$queryRawUnsafe(
      `SELECT TOP 1 EVENT_TYPE, TARGET_ID, COMPANY_ID FROM GUARDIAN.AUDIT_LOG
       WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_MODIFIED' AND TARGET_ID = @P1
       ORDER BY ENTRY_ID DESC`,
      String(globalFormId)
    );
    expect(audit.length).toBe(1);
    expect(audit[0].COMPANY_ID).toBeNull();
  });

  it('non-JAFAR (role 1) gets 403 when editing a global template', async () => {
    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const res = await apiCall('PUT', `/api/forms/${globalFormId}`, adminToken, {
      name: 'should-not-apply',
      description: '',
      formFields: [],
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: the new tests fail — the existing PUT lets role 6 edit a global but doesn't write an audit row, and doesn't currently 403 a role-1 user on a global (the existing `existingForm` lookup returns empty for role 1 against a global so they get 404; the spec says 403). Confirm the failure modes before proceeding.

- [ ] **Step 3: Replace the permission/lookup block of PUT**

Locate `server.cjs:7500-7538` (the user-roles fetch + the `if (isAdmin) { ... } else { ... }` block + the `if (!existingForm.length)` check). Replace lines 7500-7538 with:

```js
        // Load the target row (no company filter yet — we need to know if it's global).
        const targetRow = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC, IS_DELETED
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId}
        `;

        if (!targetRow.length || targetRow[0].IS_DELETED) {
            console.log(`❌ Form ${formId} not found`);
            return res.status(404).json({ error: 'Form not found' });
        }

        const target = targetRow[0];
        const targetIsGlobal = isGlobalForm(target);

        const userRoleIds = Array.isArray(req.userRoleIds) ? req.userRoleIds : [];
        const isJafar = userRoleIds.includes(6);

        if (targetIsGlobal) {
            // Only JAFAR can mutate a global template.
            if (!isJafar) {
                console.log(`❌ User ${req.userId} (roles ${userRoleIds.join(',')}) tried to edit global form ${formId}`);
                return res.status(403).json({ error: 'JAFAR access required to edit global templates' });
            }
        } else {
            // Non-global: caller must own the row's company.
            if (target.COMPANY_ID !== req.companyId && target.ORGANIZATION_ID !== req.companyId) {
                console.log(`❌ Form ${formId} not accessible to company ${req.companyId}`);
                return res.status(404).json({ error: 'Form not found or access denied' });
            }
        }

        // Used below by the rest of the existing handler.
        const existingForm = targetRow;
```

This block:
- Loads the row once (without an `ORGANIZATION_ID` filter, so we can decide based on the row itself)
- Computes `targetIsGlobal` via the shared helper
- Returns 403 for non-JAFAR editing a global (the spec's behavior)
- Returns 404 for non-globals not owned by caller's company (same as before)
- Re-binds `existingForm` so the rest of the existing handler (the field-update logic from line 7553 onward) continues to work unchanged

- [ ] **Step 4: Add audit write after the basic-update SQL**

Locate `server.cjs:7548` (`console.log('✅ Form ${formId} basic details updated successfully');`). Immediately after that line, insert:

```js
        if (targetIsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.MODIFIED,
                actorUserId: req.userId,
                actorRoleId: 6,
                formId,
                companyId: null,
                detail: { prevName: target.FORM_NAME, newName: name.trim() },
            });
        }
```

- [ ] **Step 5: Run — expect pass**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS for the two new tests AND the existing earlier tests.

- [ ] **Step 6: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-templates): PUT /api/forms/:id requires role 6 for globals + audit"
```

---

### Task 7: Tighten `DELETE /api/forms/:id` for global rows

**Files:**
- Modify: `server.cjs:8946-8989` (the existence + permission block of DELETE)

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/global-templates.smoke.test.ts`:

```ts
describe('Global Workflow Templates — JAFAR delete', () => {
  it('JAFAR can soft-delete a global template + audit row is written', async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const create = await apiCall('POST', '/api/forms', jafarToken, {
      form: { FORM_NAME: `Delete Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    });
    const id = create.body.form.FORM_ID;

    const del = await apiCall('DELETE', `/api/forms/${id}`, jafarToken);
    expect(del.status).toBe(200);

    const audit = await prisma.$queryRawUnsafe(
      `SELECT TOP 1 EVENT_TYPE FROM GUARDIAN.AUDIT_LOG
       WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_DELETED' AND TARGET_ID = @P1`,
      String(id)
    );
    expect(audit.length).toBe(1);
  });

  it('role-1 admin gets 403 when deleting a global template', async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const create = await apiCall('POST', '/api/forms', jafarToken, {
      form: { FORM_NAME: `Delete Forbidden ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    });
    const id = create.body.form.FORM_ID;

    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const del = await apiCall('DELETE', `/api/forms/${id}`, adminToken);
    expect(del.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: the new tests fail. The existing DELETE allows role 1 to delete globals (because role 1 is in the `canDelete` set and `COMPANY_ID IS NULL` is in the existence query). Confirm before proceeding.

- [ ] **Step 3: Replace the permission/lookup block of DELETE**

Locate `server.cjs:8957-8989` (from `// Check if user has permission to delete` down through `console.log('📋 Found form to delete: ...');`). Replace lines 8957-8989 with:

```js
        const userRoleIds = Array.isArray(req.userRoleIds) ? req.userRoleIds : [];
        const isJafar = userRoleIds.includes(6);
        const isAdminRole1 = userRoleIds.includes(1);

        if (!isJafar && !isAdminRole1) {
            console.log(`❌ User ${req.userId} lacks permission to delete forms`);
            return res.status(403).json({ error: 'You do not have permission to delete forms' });
        }

        const targetRow = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC, IS_DELETED
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId}
        `;

        if (!targetRow.length || targetRow[0].IS_DELETED) {
            console.log(`❌ Form ${formId} not found`);
            return res.status(404).json({ error: 'Form not found' });
        }

        const target = targetRow[0];
        const targetIsGlobal = isGlobalForm(target);

        if (targetIsGlobal && !isJafar) {
            console.log(`❌ User ${req.userId} cannot delete global form ${formId} (not JAFAR)`);
            return res.status(403).json({ error: 'JAFAR access required to delete global templates' });
        }
        if (!targetIsGlobal && target.COMPANY_ID !== req.companyId) {
            console.log(`❌ Form ${formId} not in company ${req.companyId}`);
            return res.status(404).json({ error: 'Form not found or access denied' });
        }

        const existingForm = targetRow;
        const form = existingForm[0];
        console.log(`📋 Found form to delete: ${form.FORM_NAME} (global=${targetIsGlobal})`);
```

- [ ] **Step 4: Add audit write after the soft-delete completes**

Find the line in the existing DELETE handler that performs the soft-delete UPDATE on `GUARDIAN.FORMS` (search for `UPDATE GUARDIAN.FORMS SET IS_DELETED = 1` or similar, after the cascading cleanup). Immediately after that statement's `await`, insert:

```js
        if (targetIsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.DELETED,
                actorUserId: req.userId,
                actorRoleId: 6,
                formId,
                companyId: null,
                detail: { formName: form.FORM_NAME },
            });
        }
```

- [ ] **Step 5: Run — expect pass**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-templates): DELETE /api/forms/:id requires role 6 for globals + audit"
```

---

### Task 8: Add `POST /api/forms/:id/clone`

**Files:**
- Modify: `server.cjs` (add new endpoint after the existing DELETE handler, before the next route declaration)

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/global-templates.smoke.test.ts`:

```ts
describe('Global Workflow Templates — clone', () => {
  let globalFormId: number;

  beforeAll(async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const create = await apiCall('POST', '/api/forms', jafarToken, {
      form: { FORM_NAME: `Clone Source ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [
        { FIELD_NAME: 'fieldA', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
        { FIELD_NAME: 'fieldB', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
      ],
    });
    globalFormId = create.body.form.FORM_ID;
  });

  it('company admin clones a global into their company as an independent copy', async () => {
    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const res = await apiCall('POST', `/api/forms/${globalFormId}/clone`, adminToken, {});
    expect(res.status).toBe(200);
    expect(res.body.FORM_ID).toBeGreaterThan(0);
    expect(res.body.FORM_ID).not.toBe(globalFormId);
    expect(res.body.fields.length).toBe(2);

    const cloneRow = await prisma.$queryRawUnsafe(
      `SELECT COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`,
      res.body.FORM_ID
    );
    expect(cloneRow[0].COMPANY_ID).not.toBeNull();
    expect(cloneRow[0].IS_PUBLIC).toBe(0);

    const audit = await prisma.$queryRawUnsafe(
      `SELECT TOP 1 EVENT_TYPE, COMPANY_ID FROM GUARDIAN.AUDIT_LOG
       WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_CLONED' AND TARGET_ID = @P1`,
      String(res.body.FORM_ID)
    );
    expect(audit.length).toBe(1);
    expect(audit[0].COMPANY_ID).not.toBeNull();
  });

  it('deleting the global leaves existing clones intact', async () => {
    const adminToken = await loginAs('admin-test-user@example.com', 'TestPass123!');
    const clone = await apiCall('POST', `/api/forms/${globalFormId}/clone`, adminToken, {});
    const cloneId = clone.body.FORM_ID;

    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    await apiCall('DELETE', `/api/forms/${globalFormId}`, jafarToken);

    const survives = await prisma.$queryRawUnsafe(
      `SELECT IS_DELETED FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`,
      cloneId
    );
    expect(survives[0].IS_DELETED).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure (404 route not found)**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

- [ ] **Step 3: Add the endpoint to `server.cjs`**

Insert this endpoint immediately after the closing `});` of the DELETE handler (around the end of the cascading-delete block):

```js
// Any authenticated caller can clone a template they can see, into their own company.
// Visibility predicate matches GET /api/forms.
app.post('/api/forms/:id/clone', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const sourceId = parseInt(req.params.id);
        if (!sourceId || isNaN(sourceId)) {
            return res.status(400).json({ error: 'Valid form ID is required' });
        }

        const userRoleIds = Array.isArray(req.userRoleIds) ? req.userRoleIds : [];
        const callerIsExternal = userRoleIds.includes(5);

        // Load the source row.
        const sourceRows = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, ORGANIZATION_ID,
                   IS_PUBLIC, IS_DELETED, IS_INTERNAL, IS_EXTERNAL, TEMPLATE_TYPE, NOTICE_CATEGORY
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${sourceId}
        `;
        if (!sourceRows.length || sourceRows[0].IS_DELETED) {
            return res.status(404).json({ error: 'Source template not found' });
        }
        const source = sourceRows[0];
        const sourceIsGlobal = isGlobalForm(source);

        // Visibility: globals visible to all; company templates visible only to that company.
        // External users (role 5) face the same allowlist as GET /api/forms — defer to it via canViewForm.
        const ownedByCaller = source.COMPANY_ID === req.companyId || source.ORGANIZATION_ID === req.companyId;
        if (!sourceIsGlobal && !ownedByCaller) {
            return res.status(404).json({ error: 'Source template not visible to your company' });
        }
        if (typeof canViewForm === 'function' && !canViewForm(req, sourceId)) {
            return res.status(403).json({ error: 'You do not have permission to clone this template' });
        }

        // External users (role 5) can't clone into a company they don't admin; restrict for MVP.
        if (callerIsExternal) {
            return res.status(403).json({ error: 'External users cannot clone templates' });
        }

        // Load source fields via the junction table.
        const sourceFields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.IS_REQUIRED, f.IS_ACTIVE, f.[OPTIONS],
                   ff.SORT_ORDER, ff.IS_REQUIRED AS FF_IS_REQUIRED
            FROM GUARDIAN.FORMS_FIELDS ff
            INNER JOIN GUARDIAN.FIELDS f ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${sourceId}
            ORDER BY ff.SORT_ORDER
        `;

        // Resolve a non-colliding name in the caller's company.
        let cloneName = source.FORM_NAME;
        const nameCheck = await prisma.$queryRaw`
            SELECT COUNT(*) AS HITS FROM GUARDIAN.FORMS
            WHERE FORM_NAME = ${cloneName} AND IS_DELETED = 0
              AND (COMPANY_ID = ${req.companyId} OR ORGANIZATION_ID = ${req.companyId})
        `;
        if (nameCheck[0].HITS > 0) {
            cloneName = `${source.FORM_NAME} (Copy)`;
        }

        const escapedName = cloneName.replace(/'/g, "''");
        const escapedDesc = (source.FORM_DESCRIPTION || '').replace(/'/g, "''");
        const noticeCategorySql = source.NOTICE_CATEGORY
            ? `'${String(source.NOTICE_CATEGORY).replace(/'/g, "''")}'`
            : 'NULL';
        const templateType = source.TEMPLATE_TYPE === 'notice' ? 'notice' : 'request';

        const inserted = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                IS_INTERNAL, IS_EXTERNAL, TEMPLATE_TYPE, NOTICE_CATEGORY,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                '${escapedName}', '${escapedDesc}', ${req.companyId}, ${req.companyId}, 0, 1, 0,
                ${source.IS_INTERNAL ? 1 : 0}, ${source.IS_EXTERNAL ? 1 : 0}, '${templateType}', ${noticeCategorySql},
                GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `);
        const cloneId = inserted[0].FORM_ID;

        const clonedFields = [];
        for (let i = 0; i < sourceFields.length; i++) {
            const f = sourceFields[i];
            const escapedFieldName = f.FIELD_NAME.replace(/'/g, "''");
            const escapedOptions = f.OPTIONS != null ? `'${String(f.OPTIONS).replace(/'/g, "''")}'` : 'NULL';

            const newField = await prisma.$queryRawUnsafe(`
                INSERT INTO GUARDIAN.FIELDS (
                    FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED, [OPTIONS],
                    CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID, ORGANIZATION_ID
                )
                OUTPUT INSERTED.FIELD_ID
                VALUES (
                    '${escapedFieldName}', ${f.FIELD_TYPE_ID}, ${f.IS_REQUIRED ? 1 : 0}, ${f.IS_ACTIVE ? 1 : 0}, 0, ${escapedOptions},
                    GETDATE(), GETDATE(), ${req.userId}, ${req.userId}, ${req.companyId}
                )
            `);
            const newFieldId = newField[0].FIELD_ID;

            await prisma.$queryRawUnsafe(`
                INSERT INTO GUARDIAN.FORMS_FIELDS (
                    FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
                    CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                )
                VALUES (
                    ${cloneId}, ${newFieldId}, ${f.FF_IS_REQUIRED ? 1 : 0}, ${f.SORT_ORDER || i + 1}, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                )
            `);
            clonedFields.push({ FIELD_ID: newFieldId, FIELD_NAME: f.FIELD_NAME, FIELD_TYPE_ID: f.FIELD_TYPE_ID, SORT_ORDER: f.SORT_ORDER });
        }

        // Audit only when source is global. Cloning a company-owned template is silent.
        if (sourceIsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.CLONED,
                actorUserId: req.userId,
                actorRoleId: userRoleIds[0] || null,
                formId: cloneId,
                companyId: req.companyId,
                detail: { sourceFormId: sourceId, sourceFormName: source.FORM_NAME, cloneFormName: cloneName },
            });
        }

        res.json({ FORM_ID: cloneId, FORM_NAME: cloneName, TEMPLATE_TYPE: templateType, fields: clonedFields });
    } catch (error) {
        console.error('❌ Error cloning form:', error);
        res.status(500).json({ error: 'Failed to clone form', message: error.message });
    }
});
```

- [ ] **Step 4: Run — expect pass**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-templates): add POST /api/forms/:id/clone endpoint"
```

---

### Task 9: Cross-company isolation regression test

**Files:**
- Modify: `src/tests/global-templates.smoke.test.ts`

- [ ] **Step 1: Write the test**

Append:

```ts
describe('Global Workflow Templates — cross-company isolation', () => {
  it('Company A and Company B both see the same global, neither sees the other\'s private templates', async () => {
    const jafarToken = await loginAs('jafar-test-user@example.com', 'TestPass123!');
    const adminAToken = await loginAs('admin-company-a@example.com', 'TestPass123!');
    const adminBToken = await loginAs('admin-company-b@example.com', 'TestPass123!');

    // JAFAR creates a global
    const g = await apiCall('POST', '/api/forms', jafarToken, {
      form: { FORM_NAME: `Iso Global ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    });
    const globalId = g.body.form.FORM_ID;

    // Each admin creates a private company template
    const a = await apiCall('POST', '/api/forms', adminAToken, {
      form: { FORM_NAME: `Iso A ${Date.now()}`, TEMPLATE_TYPE: 'request' },
      fields: [],
    });
    const b = await apiCall('POST', '/api/forms', adminBToken, {
      form: { FORM_NAME: `Iso B ${Date.now()}`, TEMPLATE_TYPE: 'request' },
      fields: [],
    });

    const listA = await apiCall('GET', '/api/forms', adminAToken);
    const listB = await apiCall('GET', '/api/forms', adminBToken);
    const idsA = listA.body.map((f: any) => f.FORM_ID);
    const idsB = listB.body.map((f: any) => f.FORM_ID);

    expect(idsA).toContain(globalId);
    expect(idsB).toContain(globalId);
    expect(idsA).toContain(a.body.form.FORM_ID);
    expect(idsB).not.toContain(a.body.form.FORM_ID);
    expect(idsB).toContain(b.body.form.FORM_ID);
    expect(idsA).not.toContain(b.body.form.FORM_ID);
  });
});
```

- [ ] **Step 2: Run and verify pass**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: PASS. The test exercises behavior already implemented by earlier tasks; this is purely a regression net.

- [ ] **Step 3: Commit**

```bash
git add src/tests/global-templates.smoke.test.ts
git commit -m "test(global-templates): cross-company isolation regression"
```

---

### Task 10: Mirror all backend changes into `server-production.js` and `server.js`

**Files:**
- Modify: `server-production.js`
- Modify: `server.js`

- [ ] **Step 1: Identify the four mirror points in each file**

For each of `server-production.js` and `server.js`, locate:
1. The header `require()` block — to add `require('./lib/globalForms.cjs')`
2. The existing `POST /api/forms` handler — to replace with the version from Task 4
3. The existing `GET /api/forms` handler — to add the new `GET /api/forms/global` immediately after
4. The existing `PUT /api/forms/:formId` handler — to apply the Task 6 changes
5. The existing `DELETE /api/forms/:id` handler — to apply the Task 7 changes
6. The end of the DELETE handler — to add the new `POST /api/forms/:id/clone` from Task 8
7. The platform-audit helpers area — to add `__writeGlobalTemplateAudit` from Task 2

The line numbers in these files differ from `server.cjs` — find the same patterns by name. Grep:

```bash
grep -n "app.post('/api/forms'\|app.get('/api/forms'\|app.put('/api/forms/:formId'\|app.delete('/api/forms/:id'\|__writePlatformAudit" server-production.js
grep -n "app.post('/api/forms'\|app.get('/api/forms'\|app.put('/api/forms/:formId'\|app.delete('/api/forms/:id'\|__writePlatformAudit" server.js
```

- [ ] **Step 2: Apply the same edits to both files**

For each mirror point, copy the corresponding code block from the matching section of `server.cjs` (which is now the post-Task-2-through-8 source of truth). Use the exact same handlers — these files are intentional copies of `server.cjs` with only static-serving differences.

- [ ] **Step 3: Test `server.js` runs with Node.js**

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" node server.js &
SERVER_PID=$!
sleep 5
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/forms/global -H "Authorization: Bearer <jafar-jwt>"
kill $SERVER_PID
```

Expected: `/api/health` returns OK with Node.js version; `/api/forms/global` returns 200 + JSON array (when called with a valid JAFAR JWT) or 401 (no token). If `node server.js` fails on CommonJS / ES Module issues, see CLAUDE.md's "Emergency Recovery Protocol" section.

- [ ] **Step 4: Commit**

```bash
git add server-production.js server.js
git commit -m "feat(global-templates): mirror global-template endpoints into server.js + server-production.js"
```

---

## Frontend — Service Layer

### Task 11: Extend `formService.ts` with global-template methods

**Files:**
- Modify: `src/services/formService.ts`

- [ ] **Step 1: Open the file and locate the `DbForm` interface and the exports**

```bash
grep -n "interface DbForm\|export const formService\|createForm\b\|getAllForms\b" src/services/formService.ts | head -20
```

- [ ] **Step 2: Add two new methods + extend `createForm`**

In the same file, add (or modify) these methods on whatever object/class is exported. Use the same fetch / auth pattern the existing methods use (token from `localStorage`, `Authorization: Bearer ...`, error handling):

```ts
// New: List all global workflow templates (JAFAR only — server returns 403 otherwise).
export async function getGlobalForms(): Promise<DbForm[]> {
  const token = localStorage.getItem('token');
  if (!token || token === 'null' || token === 'invalid_token') {
    throw new Error('Authentication required');
  }
  const res = await fetch('/api/forms/global', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 403) throw new Error('JAFAR access required');
  if (!res.ok) throw new Error(`Failed to load global templates (${res.status})`);
  return res.json();
}

// New: Clone a template (global or company-owned) into the caller's company.
export async function cloneForm(formId: number): Promise<{
  FORM_ID: number;
  FORM_NAME: string;
  TEMPLATE_TYPE: string;
  fields: Array<{ FIELD_ID: number; FIELD_NAME: string; FIELD_TYPE_ID: number; SORT_ORDER: number }>;
}> {
  const token = localStorage.getItem('token');
  if (!token || token === 'null' || token === 'invalid_token') {
    throw new Error('Authentication required');
  }
  const res = await fetch(`/api/forms/${formId}/clone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Failed to clone template (${res.status})`);
  return res.json();
}
```

For `createForm`, locate its existing signature. Wherever it builds the POST body, allow an `IS_GLOBAL` flag through:

```ts
// Inside the existing createForm implementation, when constructing the body:
const body = {
  form: {
    FORM_NAME: input.name,
    FORM_DESCRIPTION: input.description,
    TEMPLATE_TYPE: input.templateType,
    IS_INTERNAL: input.isInternal,
    IS_EXTERNAL: input.isExternal,
    ...(input.isGlobal ? { IS_GLOBAL: true } : {}),
  },
  fields: input.fields,
};
```

Also extend whatever input type `createForm` accepts to include `isGlobal?: boolean`. If `createForm` takes a `DbForm`-ish input type, add `IS_GLOBAL?: boolean` to that type's interface in the same file.

- [ ] **Step 3: TypeScript compile check**

```bash
bunx tsc --noEmit
```

Expected: no new errors. Fix any introduced.

- [ ] **Step 4: Commit**

```bash
git add src/services/formService.ts
git commit -m "feat(global-templates): add getGlobalForms/cloneForm services + IS_GLOBAL on createForm"
```

---

## Frontend — Global Templates Card + Modal

### Task 12: Create `GlobalTemplatesCard.tsx`

**Files:**
- Create: `src/components/admin/GlobalTemplatesCard.tsx`

- [ ] **Step 1: Confirm the target directory exists**

```bash
ls src/components/admin/ 2>/dev/null || mkdir -p src/components/admin/
```

- [ ] **Step 2: Create the card**

```tsx
// src/components/admin/GlobalTemplatesCard.tsx
import React, { useEffect, useState } from 'react';
import { FaGlobe, FaCog } from 'react-icons/fa';
import { getGlobalForms } from '../../services/formService';

interface Props {
  onOpenManager: () => void;
}

const GlobalTemplatesCard: React.FC<Props> = ({ onOpenManager }) => {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getGlobalForms();
        if (!cancelled) setCount(list.length);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load count');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card admin-card mb-3" data-testid="global-templates-card">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <FaGlobe size={22} className="me-2 text-primary" />
          <h5 className="card-title mb-0">Global Templates</h5>
        </div>
        <p className="text-muted small mb-2">
          JAFAR access only — visible to all companies
        </p>
        <p className="mb-3">
          {error
            ? <span className="text-danger">{error}</span>
            : count == null
              ? <span className="text-muted">Loading…</span>
              : <span><strong>{count}</strong> active global template{count === 1 ? '' : 's'}</span>}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenManager}
          data-testid="open-global-templates-manager"
        >
          <FaCog className="me-2" />
          Manage Global Templates
        </button>
      </div>
    </div>
  );
};

export default GlobalTemplatesCard;
```

- [ ] **Step 3: TypeScript compile check**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/GlobalTemplatesCard.tsx
git commit -m "feat(global-templates): add GlobalTemplatesCard component"
```

---

### Task 13: Create `GlobalTemplateTypePicker.tsx`

**Files:**
- Create: `src/components/admin/GlobalTemplateTypePicker.tsx`

- [ ] **Step 1: Create the small picker modal**

```tsx
// src/components/admin/GlobalTemplateTypePicker.tsx
import React from 'react';
import Modal from 'react-modal';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  onPick: (templateType: 'request' | 'notice') => void;
}

const GlobalTemplateTypePicker: React.FC<Props> = ({ isOpen, onCancel, onPick }) => (
  <Modal
    isOpen={isOpen}
    onRequestClose={onCancel}
    contentLabel="Pick global template type"
    style={{ content: { maxWidth: 420, margin: 'auto', height: 'fit-content' } }}
    ariaHideApp={false}
  >
    <h5 className="mb-3">New Global Template</h5>
    <p className="text-muted">What kind of template are you creating?</p>
    <div className="d-grid gap-2">
      <button type="button" className="btn btn-outline-primary" onClick={() => onPick('request')}>
        Request Workflow Template
      </button>
      <button type="button" className="btn btn-outline-primary" onClick={() => onPick('notice')}>
        Notice Template
      </button>
      <button type="button" className="btn btn-link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  </Modal>
);

export default GlobalTemplateTypePicker;
```

- [ ] **Step 2: TypeScript compile check + commit**

```bash
bunx tsc --noEmit
git add src/components/admin/GlobalTemplateTypePicker.tsx
git commit -m "feat(global-templates): add template-type picker modal"
```

---

### Task 14: Create `GlobalTemplatesModal.tsx`

**Files:**
- Create: `src/components/admin/GlobalTemplatesModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// src/components/admin/GlobalTemplatesModal.tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { FaEdit, FaTrash, FaPlus, FaSpinner, FaGlobe } from 'react-icons/fa';
import { getGlobalForms, DbForm } from '../../services/formService';
import GlobalTemplateTypePicker from './GlobalTemplateTypePicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateGlobal: (templateType: 'request' | 'notice') => void;
  onEditGlobal: (formId: number) => void;
}

const GlobalTemplatesModal: React.FC<Props> = ({ isOpen, onClose, onCreateGlobal, onEditGlobal }) => {
  const [globals, setGlobals] = useState<DbForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'request' | 'notice'>('all');

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await getGlobalForms();
      setGlobals(list);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load global templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]);

  const handleDelete = async (form: DbForm) => {
    const confirm = await Swal.fire({
      title: 'Delete Global Template?',
      html: `<p>Delete <strong>${form.FORM_NAME}</strong>?</p>
             <div class="alert alert-warning text-start">
               This will delete the global template for all companies.
               Existing clones in companies are not affected.
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc3545',
    });
    if (!confirm.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/forms/${form.FORM_ID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success('Global template deleted');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const visible = globals.filter((f) => filterType === 'all' || f.TEMPLATE_TYPE === filterType);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Manage Global Templates"
        style={{ content: { maxWidth: 900, margin: 'auto' } }}
        ariaHideApp={false}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0"><FaGlobe className="me-2" />Global Templates</h4>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <select className="form-select w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="all">All template types</option>
            <option value="request">Request</option>
            <option value="notice">Notice</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)} data-testid="new-global-template">
            <FaPlus className="me-2" />New Global Template
          </button>
        </div>

        {loading ? (
          <div className="text-center p-4"><FaSpinner className="fa-spin" /> Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center p-4 text-muted">No global templates yet — create your first one.</div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Audience</th>
                <th>Created</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.FORM_ID}>
                  <td>{f.FORM_NAME}</td>
                  <td><span className={`badge bg-${f.TEMPLATE_TYPE === 'notice' ? 'info' : 'secondary'}`}>{f.TEMPLATE_TYPE}</span></td>
                  <td>
                    {f.IS_INTERNAL ? <span className="badge bg-light text-dark me-1">Internal</span> : null}
                    {f.IS_EXTERNAL ? <span className="badge bg-light text-dark">External</span> : null}
                  </td>
                  <td>{f.CREATE_DATE ? new Date(f.CREATE_DATE).toLocaleDateString() : '—'}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => { onClose(); onEditGlobal(f.FORM_ID!); }}>
                      <FaEdit />
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(f)}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <GlobalTemplateTypePicker
        isOpen={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onPick={(t) => {
          setPickerOpen(false);
          onClose();
          onCreateGlobal(t);
        }}
      />
    </>
  );
};

export default GlobalTemplatesModal;
```

- [ ] **Step 2: TypeScript compile check + commit**

```bash
bunx tsc --noEmit
git add src/components/admin/GlobalTemplatesModal.tsx
git commit -m "feat(global-templates): add GlobalTemplatesModal management UI"
```

---

### Task 15: Wire `GlobalTemplatesCard` + `GlobalTemplatesModal` into `AdminDashboard.tsx`

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Locate the JAFAR-check helper and the existing card layout**

```bash
grep -n "WorkflowManagementModal\|isJafarUser\|user.roles\|admin-card\|hasAdminRole" src/pages/AdminDashboard.tsx | head -20
```

- [ ] **Step 2: Add imports**

Near the other `import` lines at the top of `AdminDashboard.tsx`:

```tsx
import GlobalTemplatesCard from '../components/admin/GlobalTemplatesCard';
import GlobalTemplatesModal from '../components/admin/GlobalTemplatesModal';
```

- [ ] **Step 3: Add state and JAFAR detector**

Inside the `AdminDashboard` component body, near the other `useState` declarations:

```tsx
  const [globalTemplatesModalOpen, setGlobalTemplatesModalOpen] = useState(false);

  const isJafarUser = (): boolean => {
    if (!user) return false;
    if (user.roles && user.roles.some((r: any) => r.id === 6)) return true;
    if (user.role === '6') return true;
    return false;
  };
```

If `AdminDashboard` already has an `isJafarUser` or equivalent, reuse it instead of duplicating.

- [ ] **Step 4: Render the card conditionally**

Find the JSX block where existing admin cards are laid out (look for the `WorkflowManagementModal` open button, around line 418 per CLAUDE.md). Just above (or beside) it, add:

```tsx
        {isJafarUser() && (
          <GlobalTemplatesCard
            onOpenManager={() => setGlobalTemplatesModalOpen(true)}
          />
        )}
```

- [ ] **Step 5: Render the modal and wire create/edit callbacks**

Near the bottom of the component, where other modals are rendered (e.g. next to `WorkflowManagementModal`), add:

```tsx
      <GlobalTemplatesModal
        isOpen={globalTemplatesModalOpen}
        onClose={() => setGlobalTemplatesModalOpen(false)}
        onCreateGlobal={(templateType) => {
          navigate('/admin/form-builder', {
            state: { isGlobalTemplate: true, templateType, mode: 'create' },
          });
        }}
        onEditGlobal={(formId) => {
          navigate(`/admin/form-builder/${formId}`, {
            state: { isGlobalTemplate: true, mode: 'edit' },
          });
        }}
      />
```

`navigate` should already be in scope via `useNavigate()` from `react-router-dom` — if not, import it and add `const navigate = useNavigate();` at the top of the component. The exact route paths (`/admin/form-builder` and `/admin/form-builder/:id`) must match the existing FormBuilderPage routes — confirm with:

```bash
grep -n "form-builder" src/App.tsx src/AppRoutes.tsx 2>/dev/null | head -10
```

If the routes differ, use the actual paths.

- [ ] **Step 6: TypeScript compile + manual click-through**

```bash
bunx tsc --noEmit
bun run dev   # in one terminal
# In another terminal, start the backend with the DATABASE_URL command from CLAUDE.md
```

Log in as a JAFAR user → the card appears on the admin dashboard. Click "Manage Global Templates" → modal opens. Log in as a non-JAFAR admin → card is hidden.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(global-templates): render GlobalTemplatesCard on admin dashboard for JAFAR"
```

---

## Frontend — Form Builder Wiring

### Task 16: Wire `IS_GLOBAL` into `FormBuilderPage` + `SimpleFormBuilder`

**Files:**
- Modify: `src/pages/FormBuilderPage.tsx`
- Modify: `src/components/SimpleFormBuilder.tsx`

- [ ] **Step 1: Read route-state in `FormBuilderPage`**

In `FormBuilderPage.tsx`, find where it reads route params / location state (likely uses `useLocation()` or `useParams()`). Add:

```tsx
const location = useLocation();
const isGlobalTemplate = !!(location.state && (location.state as any).isGlobalTemplate);
const preselectedTemplateType =
  (location.state && (location.state as any).templateType) as 'request' | 'notice' | undefined;
```

If `useLocation` isn't imported, import it from `react-router-dom`.

Pass these to `SimpleFormBuilder`:

```tsx
<SimpleFormBuilder
  // ...existing props
  isGlobalTemplate={isGlobalTemplate}
  preselectedTemplateType={preselectedTemplateType}
/>
```

- [ ] **Step 2: Accept the props in `SimpleFormBuilder.tsx`**

In the existing `SimpleFormBuilder` props interface (search for `interface SimpleFormBuilderProps` or the equivalent), add:

```tsx
  isGlobalTemplate?: boolean;
  preselectedTemplateType?: 'request' | 'notice';
```

Destructure them in the component signature.

- [ ] **Step 3: Render the "global mode" banner**

Inside the component's top-level JSX, just before the header / title, add:

```tsx
        {isGlobalTemplate && (
          <div className="alert alert-info d-flex align-items-center mb-3" role="alert" data-testid="global-template-banner">
            <span style={{ fontSize: '1.2rem' }} className="me-2">🌐</span>
            <div>
              <strong>Editing Global Template</strong> — visible to all companies once saved.
            </div>
          </div>
        )}
```

- [ ] **Step 4: Pass `IS_GLOBAL` on save**

Find the save handler in `SimpleFormBuilder.tsx` that calls `formService.createForm(...)` or POSTs to `/api/forms`. Where it builds the payload, add `IS_GLOBAL: isGlobalTemplate || false` to the `form` object:

```tsx
const payload = {
  form: {
    FORM_NAME: name.trim(),
    FORM_DESCRIPTION: description.trim(),
    TEMPLATE_TYPE: preselectedTemplateType || formType || 'request',
    IS_INTERNAL: isInternal,
    IS_EXTERNAL: isExternal,
    ...(isGlobalTemplate ? { IS_GLOBAL: true } : {}),
  },
  fields,
};
```

For edits (PUT), no body change is needed — the server already gates by checking the target row's global status.

- [ ] **Step 5: TypeScript compile + manual smoke**

```bash
bunx tsc --noEmit
```

Manual: log in as JAFAR, open Global Templates Modal, click "New Global Template" → "Request" → form builder opens with the 🌐 banner visible. Save a simple template. Confirm via SQL that `COMPANY_ID IS NULL` on the new row.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FormBuilderPage.tsx src/components/SimpleFormBuilder.tsx
git commit -m "feat(global-templates): SimpleFormBuilder honors isGlobalTemplate prop + banner"
```

---

## Frontend — WorkflowManagementModal Changes

### Task 17: Add Global badge + lock Edit/Delete on globals for non-JAFAR

**Files:**
- Modify: `src/components/WorkflowManagementModal.tsx`

- [ ] **Step 1: Add helpers**

Near the top of the component body (next to the existing `hasAdminRole`):

```tsx
  const isJafarUser = (): boolean => {
    if (!user) return false;
    if (user.roles && user.roles.some((r: any) => r.id === 6)) return true;
    if (user.role === '6') return true;
    return false;
  };

  const isGlobalForm = (form: DbForm): boolean =>
    form.COMPANY_ID == null && form.ORGANIZATION_ID == null && form.IS_PUBLIC === 1;
```

- [ ] **Step 2: Render the badge next to the form name**

Locate the JSX that renders each form's name in the list / table. Wrap or append:

```tsx
              <span className="d-inline-flex align-items-center">
                {form.FORM_NAME}
                {isGlobalForm(form) && (
                  <span className="badge bg-primary ms-2" data-testid={`global-badge-${form.FORM_ID}`}>
                    🌐 Global
                  </span>
                )}
              </span>
```

Replace the existing name render with this snippet, preserving any surrounding click handlers.

- [ ] **Step 3: Disable Edit/Delete on globals for non-JAFAR users**

Find the existing Edit and Delete `<button>` elements for each row. Add the `disabled` + tooltip:

```tsx
              <button
                type="button"
                className="btn btn-sm btn-outline-primary me-2"
                onClick={() => handleEditTemplate(form)}
                disabled={isGlobalForm(form) && !isJafarUser()}
                title={isGlobalForm(form) && !isJafarUser() ? 'Only JAFAR users can edit global templates' : 'Edit'}
              >
                <FaEdit />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger me-2"
                onClick={() => handleDeleteTemplate(form.FORM_ID!, form.FORM_NAME)}
                disabled={isGlobalForm(form) && !isJafarUser()}
                title={isGlobalForm(form) && !isJafarUser() ? 'Only JAFAR users can delete global templates' : 'Delete'}
              >
                <FaTrash />
              </button>
```

Keep the existing Edit / Delete classes if they differ — preserve the existing styling and add only the `disabled` + `title` attributes.

- [ ] **Step 4: TypeScript compile + manual check**

```bash
bunx tsc --noEmit
```

Manual: log in as a non-JAFAR admin (role 1), open the Workflow Management modal, confirm any global template row shows the "🌐 Global" badge and has greyed-out Edit / Delete buttons with the tooltip on hover.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkflowManagementModal.tsx
git commit -m "feat(global-templates): show Global badge + lock Edit/Delete for non-JAFAR"
```

---

### Task 18: Add "Clone to my company" button

**Files:**
- Modify: `src/components/WorkflowManagementModal.tsx`

- [ ] **Step 1: Add the import and handler**

At the top of `WorkflowManagementModal.tsx`:

```tsx
import { cloneForm } from '../services/formService';
import { FaCopy } from 'react-icons/fa';
```

Inside the component, near `handleEditTemplate` and `handleDeleteTemplate`:

```tsx
  const handleCloneTemplate = async (form: DbForm) => {
    try {
      const result = await cloneForm(form.FORM_ID!);
      toast.success(`Template cloned as "${result.FORM_NAME}". Edit it from your company templates.`);
      // Refresh the list so the new clone appears.
      await fetchForms();
    } catch (e: any) {
      toast.error(e.message || 'Failed to clone template');
    }
  };
```

- [ ] **Step 2: Render the Clone button only on global rows**

Immediately after the existing Edit/Delete buttons inside the row template, add:

```tsx
              {isGlobalForm(form) && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => handleCloneTemplate(form)}
                  title="Create an editable copy in your company"
                  data-testid={`clone-global-${form.FORM_ID}`}
                >
                  <FaCopy className="me-1" />Clone
                </button>
              )}
```

- [ ] **Step 3: TypeScript compile + manual smoke**

```bash
bunx tsc --noEmit
```

Manual: as a company admin, open Workflow Management → click Clone on a global row → toast appears → refresh shows the new company-owned clone with " (Copy)" suffix if name collided.

- [ ] **Step 4: Commit**

```bash
git add src/components/WorkflowManagementModal.tsx
git commit -m "feat(global-templates): add Clone-to-my-company button on global rows"
```

---

## Final Verification

### Task 19: End-to-end manual QA checklist

**Files:** none — manual verification per the spec's QA checklist.

- [ ] **Step 1: Run the full smoke-test suite once more**

```bash
bun test src/tests/global-templates.smoke.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run the existing project test suite to catch regressions**

```bash
bun test
```

Expected: no new failures vs. baseline. Investigate any failures before proceeding.

- [ ] **Step 3: Run the seven-step manual QA checklist from the spec**

Execute step-by-step in a real browser, using two distinct company accounts and one JAFAR account:

1. JAFAR login → Global Templates card visible on `/admin`.
2. Company admin (role 1) login → card hidden.
3. JAFAR creates a Request-type global → Company A and Company B admins both see it in their Workflow Management modal with the Global badge, Edit/Delete disabled.
4. Company A admin clicks "Clone to my company" → new editable template appears under their company templates with `COMPANY_ID = A`.
5. JAFAR edits the global → Company A's clone is unchanged; the global reflects the edits for all companies.
6. JAFAR deletes the global → it disappears from all companies' lists; Company A's clone remains visible and editable.
7. JAFAR creates a Notice-type global → it appears in the AddNoticeModal / SelectNoticeModal flows correctly for other companies.

Document any failures and fix before merging.

- [ ] **Step 4: Spot-check the audit log**

```bash
DATABASE_URL="<staging url>" bunx prisma db execute --stdin <<'SQL'
SELECT TOP 20 EVENT_TYPE, ACTOR_USER_ID, ACTOR_ROLE_ID, TARGET_TYPE, TARGET_ID, COMPANY_ID, CREATED_AT
FROM GUARDIAN.AUDIT_LOG
WHERE EVENT_TYPE LIKE 'GLOBAL_TEMPLATE_%'
ORDER BY ENTRY_ID DESC;
SQL
```

Expected: rows present for CREATE / MODIFY / DELETE (with `COMPANY_ID = NULL`) and CLONE (with `COMPANY_ID` = cloning company).

- [ ] **Step 5: Final commit / merge**

If all checks pass, the branch is ready. Per the project's memory: do NOT push origin until production DB has the audit-log migration applied. Verify with the staging migration check from Task 0 then proceed with the standard ship workflow.

---

## Summary of changes

- **Backend (CJS, mirrored across 3 server files):**
  - `lib/globalForms.cjs` — shared `isGlobalForm` helper + event-type constants
  - `__writeGlobalTemplateAudit` helper next to existing `__writePlatformAudit`
  - `POST /api/forms` honors `IS_GLOBAL` flag (JAFAR-gated, audit-logged)
  - `GET /api/forms/global` — new JAFAR-only list endpoint
  - `PUT /api/forms/:formId` — global rows require role 6, audit on modify
  - `DELETE /api/forms/:id` — global rows require role 6 (role 1 cannot delete globals anymore), audit on delete
  - `POST /api/forms/:id/clone` — new endpoint, independent-copy semantics, audit on clone-from-global

- **Frontend (TS/React):**
  - `GlobalTemplatesCard` + `GlobalTemplatesModal` + `GlobalTemplateTypePicker` — new JAFAR-only management UI
  - `AdminDashboard` wires card → modal → form builder
  - `FormBuilderPage` + `SimpleFormBuilder` accept `isGlobalTemplate` prop, render banner, send `IS_GLOBAL: true` on create
  - `WorkflowManagementModal` shows 🌐 badge, locks Edit/Delete on globals for non-JAFAR, adds Clone-to-my-company button

- **Tests:**
  - `src/tests/global-templates.smoke.test.ts` covers all eight scenarios from the spec
