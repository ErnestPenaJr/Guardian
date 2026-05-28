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
  let createdFormId: number | undefined;

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

    if (createBody?.form?.FORM_ID) createdFormId = createBody.form.FORM_ID as number;

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
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: soft-delete the created form so the test is idempotent.
    // Runs in finally so leaks are prevented even if an assertion throws.
    // -------------------------------------------------------------------------
    if (typeof createdFormId === 'number' && createdFormId > 0) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE GUARDIAN.FORMS SET IS_DELETED = 1 WHERE FORM_ID = ${createdFormId}`,
        );
        console.log(`🧹 Soft-deleted fixture FORM_ID=${createdFormId}`);
      } catch (err) {
        console.error(`⚠️  Cleanup failed for FORM_ID=${createdFormId}:`, err);
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
