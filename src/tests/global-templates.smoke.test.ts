// Global workflow templates smoke test — Task 3 (pass-gate for Task 4) + Task 4 non-JAFAR 403 case.
// Standalone Bun script — no test runner required.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<jafar-user-email> \
//   TEST_JAFAR_PASSWORD=<jafar-password> \
//   bun src/tests/global-templates.smoke.test.ts
//
// Required env vars:
//   TEST_API_BASE         — default http://localhost:3001
//   TEST_JAFAR_EMAIL      — a user with role 6 (Super Admin / JAFAR)
//   TEST_JAFAR_PASSWORD   — that user's password
//
// Optional env vars (non-JAFAR 403 case):
//   TEST_ADMIN_EMAIL      — a role-1 admin (non-JAFAR) account
//   TEST_ADMIN_PASSWORD   — that user's password
//
// Optional env vars (cross-company isolation case):
//   TEST_ADMIN_B_EMAIL    — a role-1 admin from a DIFFERENT company than TEST_ADMIN_EMAIL
//   TEST_ADMIN_B_PASSWORD — that user's password
//
// Exits 0 if all assertions pass, 1 if any assertion fails.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';
import { PrismaClient } from '@prisma/client';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const JAFAR_EMAIL = process.env.TEST_JAFAR_EMAIL;
const JAFAR_PASSWORD = process.env.TEST_JAFAR_PASSWORD;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const ADMIN_B_EMAIL = process.env.TEST_ADMIN_B_EMAIL;
const ADMIN_B_PASSWORD = process.env.TEST_ADMIN_B_PASSWORD;

if (!JAFAR_EMAIL || !JAFAR_PASSWORD) {
  console.error(
    '❌ TEST_JAFAR_EMAIL and TEST_JAFAR_PASSWORD must be set.\n' +
      '   Example:\n' +
      '     TEST_JAFAR_EMAIL=jafar@example.com \\\n' +
      '     TEST_JAFAR_PASSWORD=secret \\\n' +
      '     bun src/tests/global-templates.smoke.test.ts',
  );
  process.exit(1);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.warn(
    '⚠️  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — non-JAFAR 403 test will be skipped.',
  );
}

if (!ADMIN_B_EMAIL || !ADMIN_B_PASSWORD) {
  console.warn(
    '⚠️  TEST_ADMIN_B_EMAIL / TEST_ADMIN_B_PASSWORD not set — cross-company isolation test will be skipped.',
  );
}

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

const assert = (name: string, condition: unknown, details?: unknown) => {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.error(`  ❌ ${name}`, details ?? '');
    failed += 1;
  }
};

const login = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const body = (await res.json()) as { token: string };
  if (!body.token) throw new Error('Login response had no token');
  return body.token;
};

const authed = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const main = async () => {
  const createdGlobalIds: number[] = [];

  try {
    console.log('🔐 Logging in as JAFAR...');
    const jafarToken = await login(JAFAR_EMAIL, JAFAR_PASSWORD);

    // -------------------------------------------------------------------------
    // Case 1: POST /api/forms with IS_GLOBAL: true as JAFAR
    //   Steps 2-5 from the task spec. The IS_GLOBAL flag is currently ignored by
    //   the server (Task 4 not yet applied), so COMPANY_ID will be the caller's
    //   company id rather than null. Assertion 5 therefore FAILS until Task 4.
    // -------------------------------------------------------------------------
    console.log('\n🌐 Case 1: JAFAR POST /api/forms with IS_GLOBAL=true');

    const formName = `Smoke Global ${Date.now()}`;
    const createRes = await fetch(`${API_BASE}/api/forms`, {
      method: 'POST',
      headers: authed(jafarToken),
      body: JSON.stringify({
        form: {
          FORM_NAME: formName,
          FORM_DESCRIPTION: 'created by smoke test',
          TEMPLATE_TYPE: 'request',
          IS_GLOBAL: true,
          IS_INTERNAL: true,
          IS_EXTERNAL: false,
        },
        fields: [],
      }),
    });

    assert('POST /api/forms returns 200', createRes.status === 200, {
      status: createRes.status,
    });

    const createBody = (await createRes.json().catch(() => ({}))) as {
      success?: boolean;
      form?: { FORM_ID?: number; COMPANY_ID?: number | null };
    };

    assert('Response body has success: true', createBody?.success === true, {
      actualSuccess: createBody?.success,
    });

    assert(
      'Response body has form.FORM_ID > 0',
      typeof createBody.form?.FORM_ID === 'number' && createBody.form.FORM_ID > 0,
      { form: createBody.form },
    );

    if (createBody?.form?.FORM_ID) createdGlobalIds.push(createBody.form.FORM_ID as number);

    assert(
      'Response body says COMPANY_ID is null (global)',
      createBody.form?.COMPANY_ID === null,
      { actualCompanyId: createBody.form?.COMPANY_ID },
    );

    // -------------------------------------------------------------------------
    // Case 2: non-JAFAR (role 1) gets 403 when sending IS_GLOBAL: true
    // -------------------------------------------------------------------------
    let adminToken: string | undefined;
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      console.log('\n🔐 Logging in as non-JAFAR admin...');
      adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
      const forbiddenRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(adminToken),
        body: JSON.stringify({
          form: {
            FORM_NAME: `Smoke Should Fail ${Date.now()}`,
            TEMPLATE_TYPE: 'request',
            IS_GLOBAL: true,
          },
          fields: [],
        }),
      });
      assert('non-JAFAR POST /api/forms with IS_GLOBAL returns 403', forbiddenRes.status === 403, { status: forbiddenRes.status });
      const forbiddenBody = await forbiddenRes.json().catch(() => ({}));
      assert('403 body mentions JAFAR', /jafar/i.test(forbiddenBody?.error || ''), { error: forbiddenBody?.error });
    } else {
      console.log('\n⚠️  Skipping non-JAFAR 403 test (TEST_ADMIN_EMAIL/PASSWORD not set)');
    }

    // -------------------------------------------------------------------------
    // Case 3: JAFAR GET /api/forms/global returns 200 + array of globals
    // -------------------------------------------------------------------------
    console.log('\n📋 Case 3: JAFAR GET /api/forms/global');
    const listRes = await fetch(`${API_BASE}/api/forms/global`, {
      method: 'GET',
      headers: authed(jafarToken),
    });
    assert('GET /api/forms/global returns 200', listRes.status === 200, { status: listRes.status });
    const listBody = await listRes.json().catch(() => null);
    assert('GET /api/forms/global returns array', Array.isArray(listBody), { typeofBody: typeof listBody });
    if (Array.isArray(listBody) && listBody.length > 0) {
      // All returned rows must satisfy the global predicate
      const allGlobal = listBody.every((row: any) => row.COMPANY_ID === null && row.ORGANIZATION_ID === null);
      assert('Every returned row has COMPANY_ID null and ORGANIZATION_ID null', allGlobal);
    }

    // -------------------------------------------------------------------------
    // Case 4: non-JAFAR GET /api/forms/global returns 403
    // -------------------------------------------------------------------------
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      console.log('\n🔒 Case 4: non-JAFAR GET /api/forms/global → 403');
      // Reuse adminToken obtained in Case 2 — avoids a redundant login round-trip.
      const tokenForCase4 = adminToken ?? (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
      const forbiddenListRes = await fetch(`${API_BASE}/api/forms/global`, {
        method: 'GET',
        headers: authed(tokenForCase4),
      });
      assert('non-JAFAR GET /api/forms/global returns 403', forbiddenListRes.status === 403, { status: forbiddenListRes.status });
    } else {
      console.log('\n⚠️  Skipping Case 4 (non-JAFAR GET) — TEST_ADMIN_EMAIL/PASSWORD not set');
    }

    // -------------------------------------------------------------------------
    // Case 5: JAFAR can edit a global template; audit row is written.
    // -------------------------------------------------------------------------
    console.log('\n✏️  Case 5: JAFAR PUT /api/forms/:id (global)');
    // Create a global to edit
    const editSrcRes = await fetch(`${API_BASE}/api/forms`, {
      method: 'POST',
      headers: authed(jafarToken),
      body: JSON.stringify({
        form: { FORM_NAME: `Edit Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
        fields: [],
      }),
    });
    const editSrcBody = await editSrcRes.json() as { form?: { FORM_ID?: number } };
    const editFormId = editSrcBody?.form?.FORM_ID;
    assert('Created global for edit case', typeof editFormId === 'number' && editFormId > 0, { editFormId });

    if (typeof editFormId === 'number' && editFormId > 0) {
      const newName = `Edited ${Date.now()}`;
      const editRes = await fetch(`${API_BASE}/api/forms/${editFormId}`, {
        method: 'PUT',
        headers: authed(jafarToken),
        body: JSON.stringify({ name: newName, description: 'edited by smoke', formFields: [] }),
      });
      assert('JAFAR PUT returns 200 for global', editRes.status === 200, { status: editRes.status });

      // Verify audit row written
      const auditRows = await prisma.$queryRawUnsafe<{ EVENT_TYPE: string; COMPANY_ID: number | null }[]>(
        `SELECT TOP 1 EVENT_TYPE, COMPANY_ID FROM GUARDIAN.AUDIT_LOG WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_MODIFIED' AND TARGET_ID = @P1 ORDER BY ENTRY_ID DESC`,
        String(editFormId)
      );
      assert('GLOBAL_TEMPLATE_MODIFIED audit row exists', auditRows.length === 1, { auditRows });
      assert('Audit row COMPANY_ID is null (platform-level)', auditRows[0]?.COMPANY_ID === null, { actualCompanyId: auditRows[0]?.COMPANY_ID });

      // Track for cleanup
      createdGlobalIds.push(editFormId);

      // -----------------------------------------------------------------------
      // Case 6 (env-gated): non-JAFAR PUT on global → 403
      // -----------------------------------------------------------------------
      if (ADMIN_EMAIL && ADMIN_PASSWORD) {
        console.log('\n🔒 Case 6: non-JAFAR PUT on global → 403');
        if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        const forbiddenEditRes = await fetch(`${API_BASE}/api/forms/${editFormId}`, {
          method: 'PUT',
          headers: authed(adminToken),
          body: JSON.stringify({ name: 'should-not-apply', description: '', formFields: [] }),
        });
        assert('non-JAFAR PUT on global returns 403', forbiddenEditRes.status === 403, { status: forbiddenEditRes.status });
      } else {
        console.log('\n⚠️  Skipping Case 6 (non-JAFAR PUT) — TEST_ADMIN_EMAIL/PASSWORD not set');
      }
    }
    // -------------------------------------------------------------------------
    // Case 7: JAFAR can soft-delete a global; audit row is written.
    // -------------------------------------------------------------------------
    console.log('\n🗑️  Case 7: JAFAR DELETE /api/forms/:id (global)');
    const delSrcRes = await fetch(`${API_BASE}/api/forms`, {
      method: 'POST',
      headers: authed(jafarToken),
      body: JSON.stringify({
        form: { FORM_NAME: `Delete Smoke ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
        fields: [],
      }),
    });
    const delSrcBody = await delSrcRes.json() as { form?: { FORM_ID?: number } };
    const delFormId = delSrcBody?.form?.FORM_ID;
    assert('Created global for delete case', typeof delFormId === 'number' && delFormId > 0, { delFormId });

    if (typeof delFormId === 'number' && delFormId > 0) {
      createdGlobalIds.push(delFormId);  // belt-and-suspenders cleanup if test fails mid-flight
      const delRes = await fetch(`${API_BASE}/api/forms/${delFormId}`, {
        method: 'DELETE',
        headers: authed(jafarToken),
      });
      assert('JAFAR DELETE returns 200 for global', delRes.status === 200, { status: delRes.status });

      const delAuditRows = await prisma.$queryRawUnsafe<{ EVENT_TYPE: string }[]>(
        `SELECT TOP 1 EVENT_TYPE FROM GUARDIAN.AUDIT_LOG WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_DELETED' AND TARGET_ID = @P1`,
        String(delFormId)
      );
      assert('GLOBAL_TEMPLATE_DELETED audit row exists', delAuditRows.length === 1, { delAuditRows });
    }

    // -------------------------------------------------------------------------
    // Case 8: role-1 admin gets 403 when deleting a global template
    // -------------------------------------------------------------------------
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      console.log('\n🔒 Case 8: role-1 admin DELETE on global → 403');
      // Create a fresh global to attempt deletion against
      const forbidSrcRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(jafarToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Delete Forbidden ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
          fields: [],
        }),
      });
      const forbidSrcBody = await forbidSrcRes.json() as { form?: { FORM_ID?: number } };
      const forbidFormId = forbidSrcBody?.form?.FORM_ID;
      assert('Created global for forbidden-delete case', typeof forbidFormId === 'number' && forbidFormId > 0, { forbidFormId });

      if (typeof forbidFormId === 'number' && forbidFormId > 0) {
        createdGlobalIds.push(forbidFormId);
        if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        const forbiddenDelRes = await fetch(`${API_BASE}/api/forms/${forbidFormId}`, {
          method: 'DELETE',
          headers: authed(adminToken),
        });
        assert('role-1 admin DELETE on global returns 403', forbiddenDelRes.status === 403, { status: forbiddenDelRes.status });
      }
    } else {
      console.log('\n⚠️  Skipping Case 8 (role-1 admin DELETE) — TEST_ADMIN_EMAIL/PASSWORD not set');
    }
    // -------------------------------------------------------------------------
    // Case 9: company admin clones a global into their company as an independent copy
    // -------------------------------------------------------------------------
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      console.log('\n📋 Case 9: company admin clones a global');
      // Create a fresh global with two fields to clone
      const cloneSrcRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(jafarToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Clone Source ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
          fields: [
            { FIELD_NAME: 'fieldA', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
            { FIELD_NAME: 'fieldB', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
          ],
        }),
      });
      const cloneSrcBody = await cloneSrcRes.json() as { form?: { FORM_ID?: number } };
      const cloneSourceId = cloneSrcBody?.form?.FORM_ID;
      assert('Created global for clone case', typeof cloneSourceId === 'number' && cloneSourceId > 0, { cloneSourceId });

      if (typeof cloneSourceId === 'number' && cloneSourceId > 0) {
        createdGlobalIds.push(cloneSourceId);

        if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        const cloneRes = await fetch(`${API_BASE}/api/forms/${cloneSourceId}/clone`, {
          method: 'POST',
          headers: authed(adminToken),
          body: '{}',
        });
        assert('clone returns 200', cloneRes.status === 200, { status: cloneRes.status });
        const cloneBody = await cloneRes.json() as { FORM_ID?: number; fields?: any[] };
        assert('clone returns FORM_ID > 0', typeof cloneBody.FORM_ID === 'number' && cloneBody.FORM_ID > 0);
        assert('clone FORM_ID differs from source', cloneBody.FORM_ID !== cloneSourceId);
        assert('clone has both fields', Array.isArray(cloneBody.fields) && cloneBody.fields.length === 2);

        if (cloneBody.FORM_ID) {
          createdGlobalIds.push(cloneBody.FORM_ID);  // also cleanup the clone

          // Verify clone row has caller's COMPANY_ID, IS_PUBLIC = 0
          const cloneRow = await prisma.$queryRawUnsafe<{ COMPANY_ID: number | null; ORGANIZATION_ID: number | null; IS_PUBLIC: number }[]>(
            `SELECT COMPANY_ID, ORGANIZATION_ID, IS_PUBLIC FROM GUARDIAN.FORMS WHERE FORM_ID = @P1`,
            cloneBody.FORM_ID
          );
          assert('Clone has non-null COMPANY_ID', cloneRow[0]?.COMPANY_ID != null, cloneRow[0]);
          assert('Clone has IS_PUBLIC = 0', cloneRow[0]?.IS_PUBLIC === 0, cloneRow[0]);

          // Verify audit row written
          const cloneAudit = await prisma.$queryRawUnsafe<{ COMPANY_ID: number | null }[]>(
            `SELECT TOP 1 COMPANY_ID FROM GUARDIAN.AUDIT_LOG WHERE EVENT_TYPE = 'GLOBAL_TEMPLATE_CLONED' AND TARGET_ID = @P1`,
            String(cloneBody.FORM_ID)
          );
          assert('GLOBAL_TEMPLATE_CLONED audit row exists', cloneAudit.length === 1, { cloneAudit });
          assert('Clone audit COMPANY_ID is non-null (company-scoped)', cloneAudit[0]?.COMPANY_ID != null, cloneAudit[0]);
        }
      }
    } else {
      console.log('\n⚠️  Skipping Case 9 (clone) — TEST_ADMIN_EMAIL/PASSWORD not set');
    }

    // -------------------------------------------------------------------------
    // Case 10: deleting a global leaves existing clones intact
    // -------------------------------------------------------------------------
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      console.log('\n🛡️  Case 10: deleting global leaves clones intact');
      const c10SrcRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(jafarToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Clone Survives ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
          fields: [],
        }),
      });
      const c10SrcBody = await c10SrcRes.json() as { form?: { FORM_ID?: number } };
      const c10SourceId = c10SrcBody?.form?.FORM_ID;

      if (typeof c10SourceId === 'number' && c10SourceId > 0) {
        createdGlobalIds.push(c10SourceId);
        if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        const c10CloneRes = await fetch(`${API_BASE}/api/forms/${c10SourceId}/clone`, {
          method: 'POST',
          headers: authed(adminToken),
          body: '{}',
        });
        const c10CloneBody = await c10CloneRes.json() as { FORM_ID?: number };
        const c10CloneId = c10CloneBody?.FORM_ID;
        assert('Case 10 clone created', typeof c10CloneId === 'number' && c10CloneId > 0);
        if (typeof c10CloneId === 'number' && c10CloneId > 0) {
          createdGlobalIds.push(c10CloneId);
          // JAFAR deletes the global
          const c10DelRes = await fetch(`${API_BASE}/api/forms/${c10SourceId}`, {
            method: 'DELETE',
            headers: authed(jafarToken),
          });
          assert('Delete source global returns 200', c10DelRes.status === 200);
          // Clone should still exist (not deleted)
          const survivor = await prisma.$queryRawUnsafe<{ FORM_ID: number }[]>(
            `SELECT FORM_ID FROM GUARDIAN.FORMS WHERE FORM_ID = @P1 AND IS_DELETED = 0`,
            c10CloneId
          );
          assert('Clone survives after global is deleted', survivor.length === 1, { survivor });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Case 11: Cross-company isolation regression — Company A and Company B both
    // see the same global, neither sees the other's private templates.
    // -------------------------------------------------------------------------
    if (ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_B_EMAIL && ADMIN_B_PASSWORD) {
      console.log('\n🌐 Case 11: cross-company isolation regression');

      // JAFAR creates a global
      const isoGlobalRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(jafarToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Iso Global ${Date.now()}`, TEMPLATE_TYPE: 'request', IS_GLOBAL: true },
          fields: [],
        }),
      });
      const isoGlobalBody = await isoGlobalRes.json() as { form?: { FORM_ID?: number } };
      const isoGlobalId = isoGlobalBody?.form?.FORM_ID;
      assert('Created isolation-test global', typeof isoGlobalId === 'number' && isoGlobalId > 0);
      if (typeof isoGlobalId === 'number' && isoGlobalId > 0) createdGlobalIds.push(isoGlobalId);

      if (!adminToken) adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
      const adminBToken = await login(ADMIN_B_EMAIL, ADMIN_B_PASSWORD);

      // Company A admin creates a private template
      const aPrivRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(adminToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Iso A ${Date.now()}`, TEMPLATE_TYPE: 'request' },
          fields: [],
        }),
      });
      const aPrivBody = await aPrivRes.json() as { form?: { FORM_ID?: number } };
      const aPrivId = aPrivBody?.form?.FORM_ID;
      assert('Created Company A private template', typeof aPrivId === 'number' && aPrivId > 0);
      if (typeof aPrivId === 'number' && aPrivId > 0) createdGlobalIds.push(aPrivId);

      // Company B admin creates a private template
      const bPrivRes = await fetch(`${API_BASE}/api/forms`, {
        method: 'POST',
        headers: authed(adminBToken),
        body: JSON.stringify({
          form: { FORM_NAME: `Iso B ${Date.now()}`, TEMPLATE_TYPE: 'request' },
          fields: [],
        }),
      });
      const bPrivBody = await bPrivRes.json() as { form?: { FORM_ID?: number } };
      const bPrivId = bPrivBody?.form?.FORM_ID;
      assert('Created Company B private template', typeof bPrivId === 'number' && bPrivId > 0);
      if (typeof bPrivId === 'number' && bPrivId > 0) createdGlobalIds.push(bPrivId);

      // Each admin lists /api/forms
      const listARes = await fetch(`${API_BASE}/api/forms`, { headers: authed(adminToken) });
      const listBRes = await fetch(`${API_BASE}/api/forms`, { headers: authed(adminBToken) });
      const listABody = await listARes.json() as Array<{ FORM_ID: number }>;
      const listBBody = await listBRes.json() as Array<{ FORM_ID: number }>;
      const idsA = listABody.map(f => f.FORM_ID);
      const idsB = listBBody.map(f => f.FORM_ID);

      assert('Company A sees the global', idsA.includes(isoGlobalId as number));
      assert('Company B sees the global', idsB.includes(isoGlobalId as number));
      assert('Company A sees its own private template', idsA.includes(aPrivId as number));
      assert('Company B does NOT see Company A\'s private template', !idsB.includes(aPrivId as number));
      assert('Company B sees its own private template', idsB.includes(bPrivId as number));
      assert('Company A does NOT see Company B\'s private template', !idsA.includes(bPrivId as number));
    } else {
      console.log('\n⚠️  Skipping Case 11 (cross-company isolation) — TEST_ADMIN_EMAIL/PASSWORD and/or TEST_ADMIN_B_EMAIL/PASSWORD not set');
    }

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: soft-delete the created form so the test is idempotent.
    // Runs in finally so leaks are prevented even if an assertion throws.
    // -------------------------------------------------------------------------
    for (const id of createdGlobalIds) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE GUARDIAN.FORMS SET IS_DELETED = 1 WHERE FORM_ID = ${id}`);
        console.log(`🧹 Soft-deleted fixture FORM_ID=${id}`);
      } catch (err) {
        console.error(`⚠️  Cleanup failed for FORM_ID=${id}:`, err);
      }
    }
    await prisma.$disconnect();
  }

  console.log(`\nPassed: ${passed}  Failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch(async (err) => {
  console.error('❌ Smoke test crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
