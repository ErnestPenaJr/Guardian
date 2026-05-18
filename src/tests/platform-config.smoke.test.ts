// Platform-config smoke test. Standalone ts-node/bun script — no test runner required.
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<jafar-user-email> \
//   TEST_JAFAR_PASSWORD=<jafar-password> \
//   TEST_NONJAFAR_EMAIL=<regular-user-email> \
//   TEST_NONJAFAR_PASSWORD=<regular-user-password> \
//   bun src/tests/platform-config.smoke.test.ts
//
// Exits 0 on success, 1 if any assertion fails.
//
// This test exercises the five cases in plan Task 3.2 Step 1:
//   1. Anonymous PUT /api/platform/disclaimer → 401
//   2. Non-JAFAR PUT → 403
//   3. JAFAR PUT disclaimer → 200, getDisclaimerText round-trip, audit row exists
//   4. JAFAR PUT field lock → 200, getLockedFields includes SSN, audit row exists
//   5. JAFAR PUT file-types → 200, audit row exists

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';
import { PrismaClient } from '@prisma/client';
import {
  getDisclaimerText,
  getLockedFields,
} from '../../server/lib/jafarConfig';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const JAFAR_EMAIL = process.env.TEST_JAFAR_EMAIL;
const JAFAR_PASSWORD = process.env.TEST_JAFAR_PASSWORD;
const NONJAFAR_EMAIL = process.env.TEST_NONJAFAR_EMAIL;
const NONJAFAR_PASSWORD = process.env.TEST_NONJAFAR_PASSWORD;

if (!JAFAR_EMAIL || !JAFAR_PASSWORD) {
  console.error('❌ TEST_JAFAR_EMAIL and TEST_JAFAR_PASSWORD must be set.');
  process.exit(1);
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

const findLatestAuditRow = async (eventType: string, targetId?: string) => {
  return prisma.aUDIT_LOG.findFirst({
    where: {
      COMPANY_ID: null,
      EVENT_TYPE: eventType,
      ...(targetId ? { TARGET_ID: targetId } : {}),
    },
    orderBy: { CREATED_AT: 'desc' },
  });
};

const main = async () => {
  console.log('🔐 Logging in as JAFAR...');
  const jafarToken = await login(JAFAR_EMAIL, JAFAR_PASSWORD);

  // ---------------------------------------------------------------- Case 1
  console.log('\n🛡  Case 1: anonymous PUT /api/platform/disclaimer → 401');
  const anonRes = await fetch(`${API_BASE}/api/platform/disclaimer`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'should-fail' }),
  });
  assert('anonymous → 401', anonRes.status === 401, { status: anonRes.status });

  // ---------------------------------------------------------------- Case 2
  if (NONJAFAR_EMAIL && NONJAFAR_PASSWORD) {
    console.log('\n🛡  Case 2: non-JAFAR PUT /api/platform/disclaimer → 403');
    const nonJafarToken = await login(NONJAFAR_EMAIL, NONJAFAR_PASSWORD);
    const nonJafarRes = await fetch(`${API_BASE}/api/platform/disclaimer`, {
      method: 'PUT',
      headers: authed(nonJafarToken),
      body: JSON.stringify({ text: 'should-also-fail' }),
    });
    assert('non-JAFAR → 403', nonJafarRes.status === 403, { status: nonJafarRes.status });
  } else {
    console.log('\n⚠️  Case 2 skipped (TEST_NONJAFAR_EMAIL / TEST_NONJAFAR_PASSWORD not set)');
  }

  // ---------------------------------------------------------------- Case 3
  console.log('\n📝 Case 3: JAFAR PUT /api/platform/disclaimer round-trip');
  const newDisclaimer = `new disclaimer ${Date.now()}`;
  const putDisc = await fetch(`${API_BASE}/api/platform/disclaimer`, {
    method: 'PUT',
    headers: authed(jafarToken),
    body: JSON.stringify({ text: newDisclaimer }),
  });
  assert('disclaimer PUT 200', putDisc.status === 200, { status: putDisc.status });
  // Cache may hold a stale value for ≤30s; allow it to expire by reading the
  // underlying table directly. We invalidate the cache by re-importing? No —
  // setJafarConfig clears cache in-process. But this test is a SEPARATE process
  // from the server, so its own cache is fresh.
  const readBack = await getDisclaimerText();
  assert('getDisclaimerText returns new value', readBack === newDisclaimer, {
    got: readBack,
    want: newDisclaimer,
  });
  const auditDisc = await findLatestAuditRow('JAFAR_DISCLAIMER_UPDATED', 'COMPLIANCE_DISCLAIMER_TEXT');
  assert('JAFAR_DISCLAIMER_UPDATED audit row exists', !!auditDisc, auditDisc);

  // ---------------------------------------------------------------- Case 4
  console.log('\n🔒 Case 4: JAFAR PUT /api/platform/fields/SSN/lock');
  const putLock = await fetch(`${API_BASE}/api/platform/fields/SSN/lock`, {
    method: 'PUT',
    headers: authed(jafarToken),
    body: JSON.stringify({ locked: true }),
  });
  assert('field lock PUT 200', putLock.status === 200, { status: putLock.status });
  const locked = await getLockedFields();
  assert("getLockedFields includes 'SSN'", locked.includes('SSN'), locked);
  const auditLock = await findLatestAuditRow('JAFAR_FIELD_LOCKED', 'LOCKED_FIELDS:SSN');
  assert('JAFAR_FIELD_LOCKED audit row exists', !!auditLock, auditLock);

  // ---------------------------------------------------------------- Case 5
  console.log('\n📂 Case 5: JAFAR PUT /api/platform/file-types');
  const putTypes = await fetch(`${API_BASE}/api/platform/file-types`, {
    method: 'PUT',
    headers: authed(jafarToken),
    body: JSON.stringify({ types: ['application/pdf'] }),
  });
  assert('file-types PUT 200', putTypes.status === 200, { status: putTypes.status });
  const auditTypes = await findLatestAuditRow(
    'JAFAR_FILE_TYPES_UPDATED',
    'PERMITTED_SUBPOENA_FILE_TYPES',
  );
  assert('JAFAR_FILE_TYPES_UPDATED audit row exists', !!auditTypes, auditTypes);

  // ---------------------------------------------------------------- GET audit
  console.log('\n📜 Bonus: GET /api/platform/audit returns JAFAR-only entries');
  const auditRes = await fetch(`${API_BASE}/api/platform/audit`, {
    headers: authed(jafarToken),
  });
  assert('audit list 200', auditRes.status === 200, { status: auditRes.status });
  const auditBody = (await auditRes.json()) as { entries: Array<{ EVENT_TYPE: string; COMPANY_ID: number | null }> };
  assert('audit body has entries array', Array.isArray(auditBody.entries));
  if (auditBody.entries.length > 0) {
    const allJafar = auditBody.entries.every((e) => e.EVENT_TYPE.startsWith('JAFAR_'));
    const allPlatform = auditBody.entries.every((e) => e.COMPANY_ID === null);
    assert('all entries are JAFAR_*', allJafar);
    assert('all entries have COMPANY_ID = null', allPlatform);
  }

  await prisma.$disconnect();
  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch(async (err) => {
  console.error('❌ Smoke test crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
