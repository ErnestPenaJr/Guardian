# JAFAR Global Template Publish / Unpublish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draft → active ↔ deactivated lifecycle to JAFAR global workflow templates, mirroring the user-facing CustomWorkflowTemplateModal. Companies only see globals that are published AND active.

**Architecture:** Extend the existing JAFAR Global Templates feature (legacy CommonJS server, `server.cjs` as source of truth, mirrored to `server.js` and `server-production.js`). Lifecycle is encoded in the existing `GUARDIAN.FORMS.STATUS` (`'draft' | 'active' | 'inactive'`) and `IS_ACTIVE` (boolean) columns — no schema changes. Two new JAFAR-only endpoints (`PUT /api/forms/:id/publish`, `PUT /api/forms/:id/active`) drive state transitions; the existing company-facing `GET /api/forms` predicate is tightened so only Published+Active globals leak to companies. Reuses `GLOBAL_TEMPLATE_MODIFIED` audit event with a `detail.action` discriminator.

**Tech Stack:**
- Backend: Node.js + Express (CommonJS), Prisma raw SQL against SQL Server, existing `isJafarActor()` / `actorUserId()` / `__writeGlobalTemplateAudit()` / `isGlobalForm()` helpers (no new helpers needed)
- Frontend: React 18 + TypeScript, axios via `src/utils/api.ts`, existing `GlobalTemplatesModal.tsx` + `formService.ts` (extended, not rewritten)
- Tests: Bun standalone scripts under `src/tests/`, env-driven creds, hand-rolled `assert(name, condition)` helper — extends existing `src/tests/global-templates.smoke.test.ts`

**Spec:** `docs/superpowers/specs/2026-05-28-jafar-global-template-publish-unpublish-design.md`

**Prior feature (already merged):** `docs/superpowers/specs/2026-05-28-jafar-global-workflow-templates-design.md` — establishes `lib/globalForms.cjs`, `__writeGlobalTemplateAudit`, `GLOBAL_AUDIT_EVENTS`, `isJafarActor`, `actorUserId`, `GET /api/forms/global`, `POST /api/forms` with `IS_GLOBAL`, `PUT /api/forms/:formId`, `DELETE /api/forms/:id`, `POST /api/forms/:id/clone`. All of these are in scope as the foundation.

---

## File Structure

**Modified files (backend, triple-mirrored):**
- `server.cjs` (source of truth):
  - `POST /api/forms` handler — add `STATUS='draft'` stamp on globals
  - `GET /api/forms` handler — tighten globals visibility predicate
  - `GET /api/forms/global` handler — include `STATUS` + `IS_ACTIVE` in SELECT
  - New: `PUT /api/forms/:id/publish` endpoint
  - New: `PUT /api/forms/:id/active` endpoint
- `server.js` — identical mirror
- `server-production.js` — identical mirror

**Modified files (frontend):**
- `src/services/formService.ts`:
  - `DbForm` interface — add `STATUS?: 'draft' | 'active' | 'inactive' | string | null` and ensure `IS_ACTIVE?: boolean`
  - Add `publishGlobal(formId)` method
  - Add `setGlobalActive(formId, isActive)` method
- `src/components/admin/GlobalTemplatesModal.tsx`:
  - Status filter dropdown (All / Draft / Active / Deactivated / Inactive)
  - Stats row gains Draft + Deactivated counts
  - State badge per card
  - Publish / Activate / Deactivate buttons in card actions

**Modified files (tests):**
- `src/tests/global-templates.smoke.test.ts` — append Cases 12–19 covering the new lifecycle

**No new files. No schema changes. No new audit event types.**

---

## Pre-Implementation Verification

### Task 0: Confirm prerequisites + capture current state

**Files:** none — verification only.

- [ ] **Step 1: Verify the predecessor feature is on `main`**

```bash
git log main --oneline | head -40 | grep -E "(global-templates|isJafarActor)"
```

Expected: at least these commits visible — `e88ee38 fix(global-templates): allow JAFAR to access platform endpoints while impersonating`, `abbbc37 fix(global-templates): register GET /api/forms/global before /:id catch-all`, `42ab372 feat(global-templates): add isGlobalForm helper`, `50011c0 feat(global-templates): add __writeGlobalTemplateAudit helper`. If missing, stop — this plan depends on those landing first.

- [ ] **Step 2: Confirm the four helpers + audit infrastructure are present**

```bash
grep -n "function isJafarActor\|function actorUserId\|function __writeGlobalTemplateAudit\|require('./lib/globalForms.cjs')" server.cjs server.js server-production.js | wc -l
```

Expected: 12 hits total (4 helpers × 3 files). If any file is missing a helper, the mirror sync from the prior feature didn't land — stop and resolve.

- [ ] **Step 3: Snapshot current state of globals in dev DB (for after-test sanity)**

```bash
DATABASE_URL='sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false' bun -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.\$queryRawUnsafe(\`
    SELECT FORM_ID, FORM_NAME, TEMPLATE_TYPE, STATUS, IS_ACTIVE, IS_PUBLIC, IS_DELETED
    FROM GUARDIAN.FORMS
    WHERE COMPANY_ID IS NULL AND ORGANIZATION_ID IS NULL AND IS_DELETED = 0
    ORDER BY FORM_ID
  \`);
  console.log(JSON.stringify(rows, null, 2));
  await prisma.\$disconnect();
})();
"
```

Document the result in your scratchpad. Expected to see 4 rows: FIU-Subject (STATUS='active', IS_ACTIVE=true), and 3 with STATUS='inactive', IS_ACTIVE=false. These are the test fixtures that should remain unchanged in shape after this feature lands.

---

## Backend — POST /api/forms STATUS Stamp

### Task 1: Stamp STATUS='draft' on global creates + extend audit detail

**Files:**
- Modify: `server.cjs` (POST /api/forms handler, around lines 8865-9000)

- [ ] **Step 1: Locate the existing handler**

```bash
grep -n "app.post('/api/forms'" server.cjs
```

Read lines 8865-9000 of `server.cjs` to internalize the current structure. You'll be inserting a `statusSql` constant + extending the INSERT column list + extending the audit detail.

- [ ] **Step 2: Add the `statusSql` constant near the other lifecycle constants**

Find this block (currently around line 8898-8901):

```js
        const companyIdSql = wantsGlobal ? 'NULL' : `${req.companyId}`;
        const organizationIdSql = wantsGlobal ? 'NULL' : `${req.companyId}`;
        const isPublicValue = wantsGlobal ? 1 : (form.IS_PUBLIC ? 1 : 0);
        const orgIdForFieldsSql = wantsGlobal ? 'NULL' : `${req.companyId}`;
```

Add immediately after `orgIdForFieldsSql`:

```js
        // Lifecycle defaults: globals start as draft (must be explicitly Published
        // by JAFAR before companies can see them). Non-globals leave STATUS NULL
        // — that's the existing/legacy behavior for company-owned rows.
        const statusSql = wantsGlobal ? `'draft'` : 'NULL';
```

- [ ] **Step 3: Add `STATUS` to the INSERT column list + VALUES**

Find the INSERT (currently around lines 8903-8915):

```js
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
```

Replace with (adds `STATUS` after `NOTICE_CATEGORY` in both lists):

```js
        const formResult = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                IS_INTERNAL, IS_EXTERNAL, TEMPLATE_TYPE, NOTICE_CATEGORY, STATUS,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                '${escapedFormName}', '${escapedFormDescription}', ${companyIdSql}, ${organizationIdSql}, ${isPublicValue}, ${form.IS_ACTIVE !== false ? 1 : 0}, 0,
                ${isInternal}, ${isExternal}, '${templateType}', ${noticeCategorySql}, ${statusSql},
                GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `);
```

- [ ] **Step 4: Extend the audit detail with `status: 'draft'` on global create**

Find the audit-write block (currently around lines 8950-8959 inside `if (wantsGlobal)`):

```js
        if (wantsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.CREATED,
                actorUserId: actorUserId(req),
                actorRoleId: 6,
                formId,
                companyId: null,
                detail: { formName: form.FORM_NAME, templateType, isInternal: !!isInternal, isExternal: !!isExternal },
            });
        }
```

Add `status: 'draft'` to the detail object:

```js
        if (wantsGlobal) {
            await __writeGlobalTemplateAudit({
                eventType: GLOBAL_AUDIT_EVENTS.CREATED,
                actorUserId: actorUserId(req),
                actorRoleId: 6,
                formId,
                companyId: null,
                detail: { formName: form.FORM_NAME, templateType, isInternal: !!isInternal, isExternal: !!isExternal, status: 'draft' },
            });
        }
```

- [ ] **Step 5: Verify the server still boots**

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" bun server.cjs &
SERVER_PID=$!
sleep 5
curl -s http://localhost:3001/api/health
kill $SERVER_PID 2>/dev/null
```

Expected: `/api/health` returns `{"status":"ok",...}`. If it fails (syntax error), fix before committing.

- [ ] **Step 6: Commit**

```bash
git add server.cjs
git commit -m "feat(global-publish): POST /api/forms stamps STATUS=draft on new globals"
```

---

## Backend — Tighten company-facing visibility

### Task 2: Filter Draft + Deactivated globals out of `GET /api/forms`

**Files:**
- Modify: `server.cjs` (GET /api/forms handler, around lines 8759-8860)

- [ ] **Step 1: Locate the existing predicate**

```bash
grep -n "app.get('/api/forms'" server.cjs
sed -n '8770,8810p' server.cjs
```

You're looking for the WHERE clause that includes globals via `(ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)`. Find the exact location.

- [ ] **Step 2: Tighten the predicate**

Replace the existing globals clause:

```sql
            OR (ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)
```

With:

```sql
            OR (
                ORGANIZATION_ID IS NULL
                AND COMPANY_ID IS NULL
                AND IS_PUBLIC = 1
                AND STATUS = 'active'
                AND IS_ACTIVE = 1
            )
```

Make the SAME tightening to the ORDER BY context if needed — the existing `ORDER BY` should still produce sensible results since hidden globals just don't appear in the result set.

- [ ] **Step 3: Smoke-check with a direct DB query that the new predicate matches the right rows**

```bash
DATABASE_URL='sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false' bun -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const visible = await prisma.\$queryRawUnsafe(\`
    SELECT FORM_ID, FORM_NAME, STATUS, IS_ACTIVE
    FROM GUARDIAN.FORMS
    WHERE ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL
      AND IS_PUBLIC = 1 AND STATUS = 'active' AND IS_ACTIVE = 1
      AND IS_DELETED = 0
  \`);
  console.log('Globals visible to companies (post-fix):', JSON.stringify(visible, null, 2));
  await prisma.\$disconnect();
})();
"
```

Expected (in dev DB): just FIU-Subject (FORM_ID 1091). The 3 inactive globals (Address/Vehicle/Financial) should NOT appear.

- [ ] **Step 4: Boot test**

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" bun server.cjs &
SERVER_PID=$!
sleep 5
curl -s http://localhost:3001/api/health
kill $SERVER_PID 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add server.cjs
git commit -m "feat(global-publish): GET /api/forms hides non-published globals from companies"
```

---

## Backend — Extend GET /api/forms/global response

### Task 3: Include STATUS + IS_ACTIVE in the JAFAR list

**Files:**
- Modify: `server.cjs` (GET /api/forms/global handler, around lines 7359-7390)

- [ ] **Step 1: Locate and read the existing handler**

```bash
sed -n '7359,7390p' server.cjs
```

- [ ] **Step 2: Add STATUS and IS_ACTIVE to the SELECT column list**

Find the existing SELECT:

```sql
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE,
                   IS_INTERNAL, IS_EXTERNAL, NOTICE_CATEGORY,
                   ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC,
                   CREATE_DATE, CREATE_USER_ID, UPDATE_DATE
            FROM GUARDIAN.FORMS
```

Replace with (adds `STATUS, IS_ACTIVE`):

```sql
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, TEMPLATE_TYPE,
                   IS_INTERNAL, IS_EXTERNAL, NOTICE_CATEGORY,
                   ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC, STATUS, IS_ACTIVE,
                   CREATE_DATE, CREATE_USER_ID, UPDATE_DATE
            FROM GUARDIAN.FORMS
```

The downstream `.filter(isGlobalForm)` and `res.json(globals)` stay unchanged — they pass through any extra fields.

- [ ] **Step 3: Boot test**

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" bun server.cjs &
SERVER_PID=$!
sleep 5
curl -s http://localhost:3001/api/health
kill $SERVER_PID 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add server.cjs
git commit -m "feat(global-publish): GET /api/forms/global includes STATUS and IS_ACTIVE"
```

---

## Backend — New Publish endpoint

### Task 4: Add PUT /api/forms/:id/publish + failing-first smoke tests

**Files:**
- Modify: `src/tests/global-templates.smoke.test.ts` (append Cases 13 + 17)
- Modify: `server.cjs` (add new endpoint immediately after the existing `PUT /api/forms/:formId` handler, around line 7700)

- [ ] **Step 1: Append the failing-first smoke tests**

Open `src/tests/global-templates.smoke.test.ts`. Inside `main()`'s try block, after the existing last case but before the `finally`, add:

```ts
  // ===== Publish/Unpublish lifecycle (this plan) =====

  // Case 13: JAFAR can publish a draft global; audit row written with action=publish.
  console.log('\n🚀 Case 13: JAFAR PUT /api/forms/:id/publish');
  const draftRes = await fetch(`${API_BASE}/api/forms`, {
    method: 'POST',
    headers: authed(jafarToken),
    body: JSON.stringify({
      form: { FORM_NAME: `Publish Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    }),
  });
  const draftBody = await draftRes.json() as { form?: { FORM_ID?: number } };
  const draftFormId = draftBody?.form?.FORM_ID;
  assert('Created draft global for publish', typeof draftFormId === 'number' && draftFormId > 0, { draftFormId });

  if (typeof draftFormId === 'number' && draftFormId > 0) {
    createdGlobalIds.push(draftFormId);

    // Sanity: confirm the just-created row is STATUS='draft'
    const draftRow = await prisma.$queryRawUnsafe<{ STATUS: string | null; IS_ACTIVE: boolean | number }[]>(
      `SELECT STATUS, IS_ACTIVE FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`, draftFormId);
    assert('New global has STATUS=draft', draftRow[0]?.STATUS === 'draft', { row: draftRow[0] });
    assert('New global has IS_ACTIVE=true', draftRow[0]?.IS_ACTIVE === true || draftRow[0]?.IS_ACTIVE === 1, { row: draftRow[0] });

    const pubRes = await fetch(`${API_BASE}/api/forms/${draftFormId}/publish`, {
      method: 'PUT',
      headers: authed(jafarToken),
    });
    assert('JAFAR publish returns 200', pubRes.status === 200, { status: pubRes.status });

    // Round-trip: confirm DB row was actually updated
    const afterPub = await prisma.$queryRawUnsafe<{ STATUS: string | null; IS_ACTIVE: boolean | number }[]>(
      `SELECT STATUS, IS_ACTIVE FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`, draftFormId);
    assert('Published global now STATUS=active', afterPub[0]?.STATUS === 'active', { row: afterPub[0] });

    const pubAudit = await prisma.$queryRawUnsafe<{ EVENT_DETAIL: string | null }[]>(
      `SELECT TOP 1 EVENT_DETAIL FROM GUARDIAN.AUDIT_LOG
       WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_MODIFIED' AND TARGET_ID = @P1
       ORDER BY ENTRY_ID DESC`,
      String(draftFormId)
    );
    assert('Publish audit row exists', pubAudit.length === 1, { pubAudit });
    const pubDetail = pubAudit[0]?.EVENT_DETAIL ? JSON.parse(pubAudit[0].EVENT_DETAIL) : {};
    assert('Publish audit detail.action = publish', pubDetail.action === 'publish', { pubDetail });

    // Case 17: republishing an already-published global → 409
    console.log('\n🚫 Case 17: re-publish already-active global → 409');
    const dupePubRes = await fetch(`${API_BASE}/api/forms/${draftFormId}/publish`, {
      method: 'PUT',
      headers: authed(jafarToken),
    });
    assert('Republishing returns 409', dupePubRes.status === 409, { status: dupePubRes.status });
  }
```

Note: the test creates a NEW draft global rather than depending on existing state. That keeps it self-contained and re-runnable.

- [ ] **Step 2: Run the test — confirm it FAILS**

Start the dev backend:

```bash
DATABASE_URL="sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c\$;encrypt=true;trustServerCertificate=false;connection_limit=30&pool_timeout=20" bun server.cjs &
```

In another shell (with TEST_JAFAR_EMAIL/PASSWORD in env):

```bash
bun src/tests/global-templates.smoke.test.ts
```

Expected: Case 13's publish call returns 404 (route doesn't exist yet), the assertion `JAFAR publish returns 200` fails. If you can't run live (no creds), code-walk: confirm there's no `app.put('/api/forms/:id/publish'` in server.cjs yet (`grep -n "app.put.*publish" server.cjs`).

- [ ] **Step 3: Add the publish endpoint**

Locate `app.put('/api/forms/:formId'` in server.cjs (around line 7481). Immediately AFTER its closing `});`, insert:

```js
// JAFAR-only: Publish a global template (draft → active or inactive → active).
// Refuses to no-op an already-active global (returns 409 instead). Audits via
// the standard GLOBAL_TEMPLATE_MODIFIED event with detail.action='publish'.
app.put('/api/forms/:id/publish', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        if (!formId || isNaN(formId)) {
            return res.status(400).json({ error: 'Valid form ID is required' });
        }

        const targetRow = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC, IS_DELETED, STATUS
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId}
        `;

        if (!targetRow.length || targetRow[0].IS_DELETED) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const target = targetRow[0];
        if (!isGlobalForm(target)) {
            return res.status(403).json({ error: 'Publish action is only valid on global templates' });
        }
        if (!isJafarActor(req)) {
            return res.status(403).json({ error: 'JAFAR access required to publish global templates' });
        }
        if (target.STATUS === 'active') {
            return res.status(409).json({ error: 'Already published', currentStatus: target.STATUS });
        }

        await prisma.$executeRawUnsafe(
            `UPDATE GUARDIAN.FORMS
             SET STATUS = 'active', IS_ACTIVE = 1, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = @P1
             WHERE FORM_ID = @P2`,
            req.userId,
            formId
        );

        await __writeGlobalTemplateAudit({
            eventType: GLOBAL_AUDIT_EVENTS.MODIFIED,
            actorUserId: actorUserId(req),
            actorRoleId: 6,
            formId,
            companyId: null,
            detail: { action: 'publish', prevStatus: target.STATUS, newStatus: 'active', formName: target.FORM_NAME },
        });

        res.json({ FORM_ID: formId, STATUS: 'active', IS_ACTIVE: true });
    } catch (error) {
        console.error('❌ Error publishing global form:', error);
        res.status(500).json({ error: 'Failed to publish global template', message: error.message });
    }
});

```

- [ ] **Step 4: Re-run the test — confirm Cases 13 + 17 PASS**

```bash
bun src/tests/global-templates.smoke.test.ts
```

Expected: all assertions pass through Case 17. If you can't run live, code-walk each assertion against the new handler.

- [ ] **Step 5: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-publish): add PUT /api/forms/:id/publish endpoint + smoke tests"
```

---

## Backend — New Activate/Deactivate endpoint

### Task 5: Add PUT /api/forms/:id/active + failing-first smoke tests

**Files:**
- Modify: `src/tests/global-templates.smoke.test.ts` (append Cases 14, 15, 18, 19)
- Modify: `server.cjs` (add new endpoint immediately after the publish endpoint from Task 4)

- [ ] **Step 1: Append the failing-first smoke tests**

In `main()`'s try block, after Case 17 from the previous task, add:

```ts
  // Case 14: JAFAR can deactivate a published global; companies stop seeing it.
  console.log('\n🛑 Case 14: JAFAR deactivates published global');
  const c14SrcRes = await fetch(`${API_BASE}/api/forms`, {
    method: 'POST',
    headers: authed(jafarToken),
    body: JSON.stringify({
      form: { FORM_NAME: `Deactivate Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    }),
  });
  const c14SrcBody = await c14SrcRes.json() as { form?: { FORM_ID?: number } };
  const c14Id = c14SrcBody?.form?.FORM_ID;
  if (typeof c14Id === 'number' && c14Id > 0) {
    createdGlobalIds.push(c14Id);

    // Publish first
    const c14Pub = await fetch(`${API_BASE}/api/forms/${c14Id}/publish`, { method: 'PUT', headers: authed(jafarToken) });
    assert('Case 14 publish prereq', c14Pub.status === 200);

    const deactRes = await fetch(`${API_BASE}/api/forms/${c14Id}/active`, {
      method: 'PUT',
      headers: authed(jafarToken),
      body: JSON.stringify({ isActive: false }),
    });
    assert('Deactivate returns 200', deactRes.status === 200, { status: deactRes.status });

    const after = await prisma.$queryRawUnsafe<{ IS_ACTIVE: boolean | number }[]>(
      `SELECT IS_ACTIVE FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`, c14Id);
    assert('Deactivated: IS_ACTIVE=false', after[0]?.IS_ACTIVE === false || after[0]?.IS_ACTIVE === 0, { row: after[0] });

    const deactAudit = await prisma.$queryRawUnsafe<{ EVENT_DETAIL: string | null }[]>(
      `SELECT TOP 1 EVENT_DETAIL FROM GUARDIAN.AUDIT_LOG
       WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_MODIFIED' AND TARGET_ID = @P1
       ORDER BY ENTRY_ID DESC`,
      String(c14Id)
    );
    const deactDetail = deactAudit[0]?.EVENT_DETAIL ? JSON.parse(deactAudit[0].EVENT_DETAIL) : {};
    assert('Deactivate audit detail.action=deactivate', deactDetail.action === 'deactivate', { deactDetail });

    // Case 15: JAFAR reactivates
    console.log('\n♻️  Case 15: JAFAR reactivates deactivated global');
    const reactRes = await fetch(`${API_BASE}/api/forms/${c14Id}/active`, {
      method: 'PUT',
      headers: authed(jafarToken),
      body: JSON.stringify({ isActive: true }),
    });
    assert('Reactivate returns 200', reactRes.status === 200);

    const afterReact = await prisma.$queryRawUnsafe<{ IS_ACTIVE: boolean | number }[]>(
      `SELECT IS_ACTIVE FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`, c14Id);
    assert('Reactivated: IS_ACTIVE=true', afterReact[0]?.IS_ACTIVE === true || afterReact[0]?.IS_ACTIVE === 1);
  }

  // Case 18: active toggle on a draft → 409 (must publish first)
  console.log('\n🚫 Case 18: activate on a draft → 409');
  const c18Src = await fetch(`${API_BASE}/api/forms`, {
    method: 'POST',
    headers: authed(jafarToken),
    body: JSON.stringify({
      form: { FORM_NAME: `Draft No-Toggle ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
      fields: [],
    }),
  });
  const c18Body = await c18Src.json() as { form?: { FORM_ID?: number } };
  const c18Id = c18Body?.form?.FORM_ID;
  if (typeof c18Id === 'number' && c18Id > 0) {
    createdGlobalIds.push(c18Id);
    const wrongActRes = await fetch(`${API_BASE}/api/forms/${c18Id}/active`, {
      method: 'PUT',
      headers: authed(jafarToken),
      body: JSON.stringify({ isActive: true }),
    });
    assert('Activate on draft returns 409', wrongActRes.status === 409, { status: wrongActRes.status });
  }

  // Case 19: active toggle with bad body → 400
  console.log('\n🚫 Case 19: active toggle with non-boolean → 400');
  if (typeof c18Id === 'number' && c18Id > 0) {
    const badBodyRes = await fetch(`${API_BASE}/api/forms/${c18Id}/active`, {
      method: 'PUT',
      headers: authed(jafarToken),
      body: JSON.stringify({ isActive: 'yes' }),
    });
    assert('Bad-body active returns 400', badBodyRes.status === 400, { status: badBodyRes.status });
  }

  // Case 16: non-JAFAR (role 1) → 403 on publish AND active
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    console.log('\n🔒 Case 16: non-JAFAR publish/active → 403');
    if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (typeof c14Id === 'number' && c14Id > 0) {
      const npubRes = await fetch(`${API_BASE}/api/forms/${c14Id}/publish`, {
        method: 'PUT',
        headers: authed(adminToken),
      });
      assert('non-JAFAR publish → 403', npubRes.status === 403, { status: npubRes.status });

      const nactRes = await fetch(`${API_BASE}/api/forms/${c14Id}/active`, {
        method: 'PUT',
        headers: authed(adminToken),
        body: JSON.stringify({ isActive: false }),
      });
      assert('non-JAFAR active → 403', nactRes.status === 403, { status: nactRes.status });
    }
  } else {
    console.log('\n⚠️  Skipping Case 16 (non-JAFAR publish/active) — TEST_ADMIN_EMAIL/PASSWORD not set');
  }

  // Case 12: company-side visibility — published+active globals visible,
  // drafts and deactivated NOT visible. Requires ADMIN creds.
  if (ADMIN_EMAIL && ADMIN_PASSWORD && typeof c14Id === 'number' && c14Id > 0 && typeof c18Id === 'number' && c18Id > 0) {
    console.log('\n👁️  Case 12: company-side visibility filter on globals');
    if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    // Re-activate c14 first so it should be visible
    await fetch(`${API_BASE}/api/forms/${c14Id}/active`, {
      method: 'PUT', headers: authed(jafarToken),
      body: JSON.stringify({ isActive: true }),
    });
    const listRes = await fetch(`${API_BASE}/api/forms`, { headers: authed(adminToken) });
    const listBody = await listRes.json() as Array<{ FORM_ID: number }>;
    const ids = listBody.map(f => f.FORM_ID);
    assert('Published+active global appears in company list', ids.includes(c14Id), { sample: ids.slice(0, 5) });
    assert('Draft global does NOT appear in company list', !ids.includes(c18Id), { c18Id });
  } else {
    console.log('\n⚠️  Skipping Case 12 (visibility) — fixtures or creds missing');
  }
```

- [ ] **Step 2: Run — confirm failures**

```bash
bun src/tests/global-templates.smoke.test.ts
```

Expected: most of the new assertions fail because `/api/forms/:id/active` doesn't exist yet (404) and the company-visibility filter still leaks (Task 2's tightening relies on STATUS being set to 'draft' for new globals, which is done by Task 1 — both should already be in place from prior tasks).

- [ ] **Step 3: Add the active toggle endpoint**

Immediately AFTER the publish endpoint added in Task 4 (in server.cjs), insert:

```js
// JAFAR-only: Activate or deactivate a published global. Requires STATUS='active'
// (drafts must be Published first, legacy 'inactive' rows must also be Published
// to enter the lifecycle). Audits via GLOBAL_TEMPLATE_MODIFIED with detail.action.
app.put('/api/forms/:id/active', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        if (!formId || isNaN(formId)) {
            return res.status(400).json({ error: 'Valid form ID is required' });
        }

        if (!req.body || typeof req.body.isActive !== 'boolean') {
            return res.status(400).json({ error: 'Body must include isActive (boolean)' });
        }
        const isActive = req.body.isActive === true;

        const targetRow = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID, COMPANY_ID, IS_PUBLIC, IS_DELETED, STATUS
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId}
        `;

        if (!targetRow.length || targetRow[0].IS_DELETED) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const target = targetRow[0];
        if (!isGlobalForm(target)) {
            return res.status(403).json({ error: 'Active toggle is only valid on global templates' });
        }
        if (!isJafarActor(req)) {
            return res.status(403).json({ error: 'JAFAR access required to toggle global active state' });
        }
        if (target.STATUS !== 'active') {
            return res.status(409).json({
                error: 'Cannot activate/deactivate a non-published global — publish it first',
                currentStatus: target.STATUS,
            });
        }

        await prisma.$executeRawUnsafe(
            `UPDATE GUARDIAN.FORMS
             SET IS_ACTIVE = @P1, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = @P2
             WHERE FORM_ID = @P3`,
            isActive ? 1 : 0,
            req.userId,
            formId
        );

        await __writeGlobalTemplateAudit({
            eventType: GLOBAL_AUDIT_EVENTS.MODIFIED,
            actorUserId: actorUserId(req),
            actorRoleId: 6,
            formId,
            companyId: null,
            detail: { action: isActive ? 'activate' : 'deactivate', isActive, formName: target.FORM_NAME },
        });

        res.json({ FORM_ID: formId, STATUS: 'active', IS_ACTIVE: isActive });
    } catch (error) {
        console.error('❌ Error toggling global active state:', error);
        res.status(500).json({ error: 'Failed to update global active state', message: error.message });
    }
});

```

- [ ] **Step 4: Re-run the test — confirm Cases 12, 14–19 PASS**

```bash
bun src/tests/global-templates.smoke.test.ts
```

If you can't run live, code-walk every assertion against the new handler + Task 2's tightened predicate.

- [ ] **Step 5: Commit**

```bash
git add server.cjs src/tests/global-templates.smoke.test.ts
git commit -m "feat(global-publish): add PUT /api/forms/:id/active endpoint + smoke tests"
```

---

## Backend — Mirror to server.js + server-production.js

### Task 6: Triple-server sync

**Files:**
- Modify: `server-production.js` (apply Tasks 1, 2, 3, 4, 5 backend changes)
- Modify: `server.js` (apply Tasks 1, 2, 3, 4, 5 backend changes)

- [ ] **Step 1: Inspect the diff from main**

```bash
git diff main..HEAD -- server.cjs > /tmp/server-cjs.diff
wc -l /tmp/server-cjs.diff
```

The diff is your reference for what to apply to the mirror files.

- [ ] **Step 2: For each of server-production.js and server.js, locate matching anchors and apply identical edits**

Use grep to find each anchor point in the mirror files:

```bash
# Find each block in both mirrors:
grep -n "const orgIdForFieldsSql = wantsGlobal" server.js server-production.js
grep -n "OR (ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)" server.js server-production.js
grep -n "app.get('/api/forms/global'" server.js server-production.js
grep -n "app.put('/api/forms/:formId'" server.js server-production.js
```

For each match, apply the same edit shown in Tasks 1-5. Be especially careful with the new `PUT /api/forms/:id/publish` and `PUT /api/forms/:id/active` endpoints — they must be inserted at the matching location in each mirror (immediately after the `app.put('/api/forms/:formId'` closing).

- [ ] **Step 3: Cross-file token check**

```bash
grep -c "publish\|/api/forms/:id/active\|STATUS = 'active'\|status: 'draft'" server.cjs server.js server-production.js
```

The counts should be IDENTICAL across all three files. If they diverge, you missed a hunk in one of the mirrors.

- [ ] **Step 4: Verify both mirrors boot with Node.js**

```bash
node --check server.js 2>&1 | head
node --check server-production.js 2>&1 | head
```

Expected: no syntax errors. (The full `node server.js` run may fail on ES module config per CLAUDE.md, but `node --check` validates syntax.)

- [ ] **Step 5: Commit**

```bash
git add server.js server-production.js
git commit -m "feat(global-publish): mirror publish/active endpoints into server.js + server-production.js"
```

---

## Frontend — Service Layer

### Task 7: formService.publishGlobal + setGlobalActive

**Files:**
- Modify: `src/services/formService.ts` (extend DbForm interface + add 2 new methods)

- [ ] **Step 1: Read the current state of the file**

```bash
grep -n "interface DbForm\|getGlobalForms\|cloneForm" src/services/formService.ts | head -10
```

Confirm the existing `getGlobalForms` and `cloneForm` methods are present on the default export.

- [ ] **Step 2: Extend the DbForm interface**

Locate `interface DbForm` near the top of `src/services/formService.ts`. Add the two fields if not already present:

```ts
  STATUS?: 'draft' | 'active' | 'inactive' | string | null;
  IS_ACTIVE?: boolean;
```

(If `IS_ACTIVE` is already there, leave it. If `STATUS` is already there but typed differently, widen the union to include all four cases.)

- [ ] **Step 3: Add publishGlobal and setGlobalActive methods**

Locate the `cloneForm` method on the `formService` default-export object. Immediately after it, add:

```ts
  publishGlobal: async (formId: number): Promise<{ FORM_ID: number; STATUS: 'active'; IS_ACTIVE: boolean }> => {
    try {
      const response = await api.put(`/api/forms/${formId}/publish`);
      return response.data;
    } catch (error) {
      console.error('Error publishing global template:', error);
      throw error;
    }
  },

  setGlobalActive: async (formId: number, isActive: boolean): Promise<{ FORM_ID: number; STATUS: 'active'; IS_ACTIVE: boolean }> => {
    try {
      const response = await api.put(`/api/forms/${formId}/active`, { isActive });
      return response.data;
    } catch (error) {
      console.error('Error toggling global active state:', error);
      throw error;
    }
  },
```

- [ ] **Step 4: TypeScript compile check**

```bash
bunx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/formService.ts
git commit -m "feat(global-publish): add publishGlobal/setGlobalActive services + STATUS on DbForm"
```

---

## Frontend — GlobalTemplatesModal lifecycle UI

### Task 8: State badges, status filter, Publish/Activate/Deactivate buttons

**Files:**
- Modify: `src/components/admin/GlobalTemplatesModal.tsx`

This is the largest UI change. Read the current file first.

- [ ] **Step 1: Read the existing modal**

```bash
wc -l src/components/admin/GlobalTemplatesModal.tsx
sed -n '1,40p' src/components/admin/GlobalTemplatesModal.tsx
grep -n "GlobalForm\|filterType\|statusFilter\|FaEdit\|formService\." src/components/admin/GlobalTemplatesModal.tsx | head -20
```

Understand: where the state is declared, how filter is wired, how rows are rendered, where action buttons sit.

- [ ] **Step 2: Add additional imports**

At the top of the file, add to the existing react-icons import (or below it):

```tsx
import { FaUpload, FaToggleOn, FaToggleOff } from 'react-icons/fa';
```

(`FaUpload` for Publish, `FaToggleOn` for Activate, `FaToggleOff` for Deactivate.)

- [ ] **Step 3: Extend the local `GlobalForm` type**

Locate the local intersection type (around the top of the file: `type GlobalForm = DbForm & { CREATE_DATE?: string }` or similar). Extend to include the lifecycle fields:

```ts
type GlobalForm = DbForm & {
  CREATE_DATE?: string;
  STATUS?: 'draft' | 'active' | 'inactive' | string | null;
  IS_ACTIVE?: boolean;
};
```

- [ ] **Step 4: Add a status filter state alongside the existing type filter**

Find the existing `useState` declaration for the type filter (probably `const [filterType, setFilterType] = useState<...>('all')`). Add immediately after:

```tsx
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'deactivated' | 'inactive'>('all');
```

- [ ] **Step 5: Extend the `visible` derivation to apply the status filter**

Locate where `visible` is computed (probably `const visible = globals.filter(f => filterType === 'all' || f.TEMPLATE_TYPE === filterType)`). Replace with:

```tsx
  const visible = globals.filter((f) => {
    if (filterType !== 'all' && f.TEMPLATE_TYPE !== filterType) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'draft') return f.STATUS === 'draft';
    if (statusFilter === 'active') return f.STATUS === 'active' && f.IS_ACTIVE === true;
    if (statusFilter === 'deactivated') return f.STATUS === 'active' && f.IS_ACTIVE === false;
    if (statusFilter === 'inactive') return f.STATUS !== 'draft' && f.STATUS !== 'active';
    return true;
  });
```

- [ ] **Step 6: Add the status filter dropdown next to the type filter**

Locate the existing type filter `<select>` in the modal's JSX. Immediately after it (inside the same flex container so they sit side by side), add:

```tsx
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
                <option value="inactive">Inactive (legacy)</option>
              </select>
```

- [ ] **Step 7: Add Draft + Deactivated counts to the stats row**

Locate the stats row in the JSX (look for the existing Total / Request / Notice counts). Add two more colored-dot stats:

```tsx
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-gray-600">Draft: {globals.filter((g) => g.STATUS === 'draft').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Deactivated: {globals.filter((g) => g.STATUS === 'active' && g.IS_ACTIVE === false).length}</span>
                </div>
```

- [ ] **Step 8: Add a status-badge helper inside the component**

Above the `return (` statement, add:

```tsx
  const renderStatusBadge = (g: GlobalForm) => {
    if (g.STATUS === 'draft') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800" title="Draft globals are hidden from companies until published">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5" />
          Draft
        </span>
      );
    }
    if (g.STATUS === 'active' && g.IS_ACTIVE === true) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
          Active
        </span>
      );
    }
    if (g.STATUS === 'active' && g.IS_ACTIVE === false) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5" />
          Deactivated
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5" />
        Inactive
      </span>
    );
  };
```

- [ ] **Step 9: Render the status badge on each card**

Locate the existing TEMPLATE_TYPE badge rendering in the card body. Immediately after it, add:

```tsx
                  {renderStatusBadge(f)}
```

(or wherever fits the existing badge layout — they're typically rendered together on the same row).

- [ ] **Step 10: Add lifecycle action handlers**

Near the existing `handleDelete` function in the component, add:

```tsx
  const handlePublish = async (f: GlobalForm) => {
    if (!f.FORM_ID) return;
    try {
      await formService.publishGlobal(f.FORM_ID);
      toast.success(`"${f.FORM_NAME}" published — companies can now see it`);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed';
      toast.error(msg);
    }
  };

  const handleSetActive = async (f: GlobalForm, isActive: boolean) => {
    if (!f.FORM_ID) return;
    try {
      await formService.setGlobalActive(f.FORM_ID, isActive);
      toast.success(isActive
        ? `"${f.FORM_NAME}" activated`
        : `"${f.FORM_NAME}" deactivated — hidden from companies`);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Status change failed';
      toast.error(msg);
    }
  };
```

- [ ] **Step 11: Add the three buttons to the card actions row**

Locate the existing Edit Fields + Delete buttons in each card's action row. Add the three lifecycle buttons immediately BEFORE the Delete button:

```tsx
                {(f.STATUS === 'draft' || f.STATUS === 'inactive') && (
                  <button
                    type="button"
                    className="flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={() => handlePublish(f)}
                    title="Publish this global to make it visible to all companies"
                    data-testid={`publish-global-${f.FORM_ID}`}
                  >
                    <FaUpload className="me-1" />Publish
                  </button>
                )}
                {f.STATUS === 'active' && f.IS_ACTIVE === true && (
                  <button
                    type="button"
                    className="flex items-center px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={() => handleSetActive(f, false)}
                    title="Hide this global from companies (keeps the template for future reactivation)"
                    data-testid={`deactivate-global-${f.FORM_ID}`}
                  >
                    <FaToggleOff className="me-1" />Deactivate
                  </button>
                )}
                {f.STATUS === 'active' && f.IS_ACTIVE === false && (
                  <button
                    type="button"
                    className="flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={() => handleSetActive(f, true)}
                    title="Show this global to companies again"
                    data-testid={`activate-global-${f.FORM_ID}`}
                  >
                    <FaToggleOn className="me-1" />Activate
                  </button>
                )}
```

The existing Edit Fields and Delete buttons stay as-is.

- [ ] **Step 12: TypeScript compile check**

```bash
bunx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 13: Commit**

```bash
git add src/components/admin/GlobalTemplatesModal.tsx
git commit -m "feat(global-publish): GlobalTemplatesModal gains state badges + Publish/Activate/Deactivate buttons"
```

---

## Final Verification

### Task 9: End-to-end QA + sync verification

**Files:** none — verification only.

- [ ] **Step 1: Final TypeScript compile**

```bash
bunx tsc --noEmit 2>&1 | tail -5
```

Expected: clean exit (no output).

- [ ] **Step 2: Run the full smoke test suite (live, if creds available)**

Start the dev backend, then:

```bash
bun src/tests/global-templates.smoke.test.ts
```

Expected: all Cases (1-19) pass (with env-gated cases skipped if creds not set).

- [ ] **Step 3: Cross-server parity check**

```bash
for f in server.cjs server.js server-production.js; do
  echo "=== $f ==="
  grep -c "/api/forms/:id/publish\|/api/forms/:id/active\|STATUS = 'active'\|status: 'draft'\|statusSql" "$f"
done
```

Expected: identical counts across all three files. Investigate any divergence.

- [ ] **Step 4: Manual click-through QA in the browser**

Start both dev backend and frontend:

```bash
bun run dev   # frontend on 5175
# In another terminal:
DATABASE_URL='...' bun server.cjs   # backend on 3001
```

As JAFAR (Ernest):
1. Open the admin dashboard. Global Templates card visible. Click it.
2. The modal opens. Existing globals visible with state badges (FIU-Subject = Active green; Address/Vehicle/Financial = Inactive gray).
3. Click "Publish" on Address. Toast appears. Address now shows "Active" badge.
4. Click "Deactivate" on Address. Toast appears. Address now shows "Deactivated" badge.
5. Click "Activate" on Address. Toast appears. Active badge back.
6. Click "+ New Global Template" → Request. Form builder opens. Save it. Refresh modal — new template shows as "Draft" badge with a Publish button.
7. Click Publish on the new draft → Active.
8. Log out, log in as a company admin (role 1). Open Workflow Management modal. Verify:
   - FIU-Subject + Address (both active) are visible with the 🌐 Global badge
   - The deactivated state isn't visible (would need to be in deactivated state to test — re-deactivate Address as JAFAR first)
   - Draft global from step 6 is NOT visible

- [ ] **Step 5: Audit log spot-check**

```bash
DATABASE_URL='sqlserver://...' bun -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.\$queryRawUnsafe(\`
    SELECT TOP 20 EVENT_TYPE, ACTOR_USER_ID, TARGET_ID, EVENT_DETAIL, CREATED_AT
    FROM GUARDIAN.AUDIT_LOG
    WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_MODIFIED'
      AND EVENT_DETAIL LIKE '%action%'
    ORDER BY ENTRY_ID DESC
  \`);
  console.log(JSON.stringify(rows, null, 2));
  await prisma.\$disconnect();
})();
"
```

Expected: recent rows with `EVENT_DETAIL` JSON containing `action: 'publish'` / `'activate'` / `'deactivate'` from your manual clicks.

- [ ] **Step 6: Wrap up**

If all checks pass, the feature is shippable. Use `superpowers:finishing-a-development-branch` to decide merge / push / etc.

---

## Summary of changes

- **Backend** (3 CJS files, mirrored):
  - `POST /api/forms` now stamps `STATUS='draft'` on new globals (Task 1)
  - `GET /api/forms` company-facing predicate now requires `STATUS='active' AND IS_ACTIVE=1` for globals (Task 2)
  - `GET /api/forms/global` now returns `STATUS` + `IS_ACTIVE` (Task 3)
  - New `PUT /api/forms/:id/publish` (Task 4)
  - New `PUT /api/forms/:id/active` (Task 5)
  - All mirrored across server.cjs / server.js / server-production.js (Task 6)
- **Frontend (TS/React)**:
  - `formService.publishGlobal()` + `setGlobalActive()` + `DbForm` gets `STATUS` and `IS_ACTIVE` (Task 7)
  - `GlobalTemplatesModal` gains state filter, draft/deactivated counts, state badges, and three new action buttons (Task 8)
- **Tests**:
  - `src/tests/global-templates.smoke.test.ts` Cases 12–19 (interleaved across Tasks 4 + 5)

- **No schema changes. No new audit events. No new helpers.**
