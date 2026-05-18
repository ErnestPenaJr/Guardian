// Phase 7 / US-SRB-03 — External user portal smoke test.
//
// Standalone bun script — no test runner required. Don't run until Ernest
// seeds EXTERNAL_NOTICE_ASSIGNMENTS for a role-5 user in CI.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_EXTERNAL_EMAIL=<external@…> \
//   TEST_EXTERNAL_PASSWORD=<password> \
//   TEST_NON_EXTERNAL_EMAIL=<processor@…> \
//   TEST_NON_EXTERNAL_PASSWORD=<password> \
//   TEST_ASSIGNED_NOTICE_ID=<NOTICE_ID assigned to external user> \
//   TEST_UNASSIGNED_NOTICE_ID=<NOTICE_ID NOT assigned to external user> \
//   bun src/tests/external-user-portal.smoke.test.ts
//
// Cases covered:
//   1. Non-external user → GET /api/external/notices/:id returns 403.
//   2. External user → GET /api/external/notices/:assignedId returns 200 + read-only fields.
//   3. External user → GET /api/external/notices/:unassignedId returns 403.
//   4. External user → POST /api/external/notices/:assignedId/subpoena without file → 400.
//   5. External user → POST /api/external/notices/:assignedId/call-request with no times → 400.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const EXTERNAL_EMAIL = process.env.TEST_EXTERNAL_EMAIL;
const EXTERNAL_PASSWORD = process.env.TEST_EXTERNAL_PASSWORD;
const NON_EXTERNAL_EMAIL = process.env.TEST_NON_EXTERNAL_EMAIL;
const NON_EXTERNAL_PASSWORD = process.env.TEST_NON_EXTERNAL_PASSWORD;
const ASSIGNED_NOTICE_ID = Number(process.env.TEST_ASSIGNED_NOTICE_ID);
const UNASSIGNED_NOTICE_ID = Number(process.env.TEST_UNASSIGNED_NOTICE_ID);

if (
  !EXTERNAL_EMAIL ||
  !EXTERNAL_PASSWORD ||
  !NON_EXTERNAL_EMAIL ||
  !NON_EXTERNAL_PASSWORD ||
  !ASSIGNED_NOTICE_ID ||
  !UNASSIGNED_NOTICE_ID
) {
  console.error(
    '❌ Missing env. Required: TEST_EXTERNAL_EMAIL, TEST_EXTERNAL_PASSWORD, TEST_NON_EXTERNAL_EMAIL, TEST_NON_EXTERNAL_PASSWORD, TEST_ASSIGNED_NOTICE_ID, TEST_UNASSIGNED_NOTICE_ID',
  );
  process.exit(1);
}

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
  if (!res.ok) throw new Error(`Login failed (${email}): ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
};

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const main = async () => {
  console.log('🔐 Logging in as non-external...');
  const nonExtToken = await login(NON_EXTERNAL_EMAIL!, NON_EXTERNAL_PASSWORD!);

  console.log('\n📄 Case 1: non-external → /api/external/notices/:id → 403');
  const c1 = await fetch(`${API_BASE}/api/external/notices/${ASSIGNED_NOTICE_ID}`, {
    headers: authed(nonExtToken),
  });
  assert('Case 1 status 403', c1.status === 403, { status: c1.status });

  console.log('\n🔐 Logging in as external user...');
  const extToken = await login(EXTERNAL_EMAIL!, EXTERNAL_PASSWORD!);

  console.log('\n📄 Case 2: external user → assigned notice → 200');
  const c2 = await fetch(`${API_BASE}/api/external/notices/${ASSIGNED_NOTICE_ID}`, {
    headers: authed(extToken),
  });
  assert('Case 2 status 200', c2.status === 200, { status: c2.status });
  const c2Body = await c2.json().catch(() => ({}));
  assert('Case 2 returns notice payload', !!c2Body?.notice, c2Body);

  console.log('\n📄 Case 3: external user → unassigned notice → 403');
  const c3 = await fetch(`${API_BASE}/api/external/notices/${UNASSIGNED_NOTICE_ID}`, {
    headers: authed(extToken),
  });
  assert('Case 3 status 403', c3.status === 403, { status: c3.status });

  console.log('\n📄 Case 4: external user → POST subpoena without file → 400');
  const c4 = await fetch(`${API_BASE}/api/external/notices/${ASSIGNED_NOTICE_ID}/subpoena`, {
    method: 'POST',
    headers: authed(extToken),
  });
  assert('Case 4 status 400', c4.status === 400, { status: c4.status });

  console.log('\n📄 Case 5: external user → POST call-request with no times → 400');
  const c5 = await fetch(`${API_BASE}/api/external/notices/${ASSIGNED_NOTICE_ID}/call-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(extToken) },
    body: JSON.stringify({ proposedTimes: [] }),
  });
  assert('Case 5 status 400', c5.status === 400, { status: c5.status });

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});
