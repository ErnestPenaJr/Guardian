// Phase 6 / US-CCL-03 — Recipient verification smoke test. Standalone
// ts-node/bun script — no test runner required.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_PROCESSOR_EMAIL=<processor-email> \
//   TEST_PROCESSOR_PASSWORD=<processor-password> \
//   TEST_RECIPIENT_USER_ID=<a USER_ID in the same company that has NO verification row> \
//   TEST_RESPONDING_USER_EMAIL=<user-email that is a recipient of a notice> \
//   TEST_RESPONDING_USER_PASSWORD=<password> \
//   TEST_RESPONDING_USER_ID=<USER_ID of the responder> \
//   TEST_RESPONDABLE_NOTICE_ID=<MY_NOTICES.NOTICE_ID where responder is a recipient> \
//   TEST_FRESH_USER_ID=<another USER_ID never touched by a notice send/response> \
//   bun src/tests/recipient-verification.smoke.test.ts
//
// Cases (mirrors plan Task 6.1 Step 1):
//   1. New recipient with no row in RECIPIENT_VERIFICATIONS → GET returns FIRST_TIME.
//   2. After a successful response add (acknowledgement), the next GET for the
//      responding user returns PREVIOUSLY_VERIFIED.
//   3. Newly-added recipient (USERS row) without any prior send → still FIRST_TIME.
//
// Exits 0 on success, 1 if any assertion fails.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const PROCESSOR_EMAIL = process.env.TEST_PROCESSOR_EMAIL;
const PROCESSOR_PASSWORD = process.env.TEST_PROCESSOR_PASSWORD;
const RECIPIENT_USER_ID = Number(process.env.TEST_RECIPIENT_USER_ID);
const RESPONDING_USER_EMAIL = process.env.TEST_RESPONDING_USER_EMAIL;
const RESPONDING_USER_PASSWORD = process.env.TEST_RESPONDING_USER_PASSWORD;
const RESPONDING_USER_ID = Number(process.env.TEST_RESPONDING_USER_ID);
const RESPONDABLE_NOTICE_ID = Number(process.env.TEST_RESPONDABLE_NOTICE_ID);
const FRESH_USER_ID = Number(process.env.TEST_FRESH_USER_ID);

if (
  !PROCESSOR_EMAIL ||
  !PROCESSOR_PASSWORD ||
  !RECIPIENT_USER_ID ||
  !RESPONDING_USER_EMAIL ||
  !RESPONDING_USER_PASSWORD ||
  !RESPONDING_USER_ID ||
  !RESPONDABLE_NOTICE_ID ||
  !FRESH_USER_ID
) {
  console.error(
    '❌ Missing env. Required: TEST_PROCESSOR_EMAIL, TEST_PROCESSOR_PASSWORD, TEST_RECIPIENT_USER_ID, TEST_RESPONDING_USER_EMAIL, TEST_RESPONDING_USER_PASSWORD, TEST_RESPONDING_USER_ID, TEST_RESPONDABLE_NOTICE_ID, TEST_FRESH_USER_ID',
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
  if (!body.token) throw new Error(`Login response had no token for ${email}`);
  return body.token;
};

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const getVerification = async (token: string, id: number) => {
  const res = await fetch(`${API_BASE}/api/recipients/${id}/verification`, {
    headers: authed(token),
  });
  return { status: res.status, body: (await res.json()) as { verifiedStatus: string; verifiedAt: string | null } };
};

const main = async () => {
  console.log('🔐 Logging in as processor...');
  const processorToken = await login(PROCESSOR_EMAIL!, PROCESSOR_PASSWORD!);

  console.log('\n📄 Case 1: recipient with no verification row → FIRST_TIME');
  const c1 = await getVerification(processorToken, RECIPIENT_USER_ID);
  assert('Case 1 status 200', c1.status === 200, c1);
  assert('Case 1 verifiedStatus === FIRST_TIME', c1.body.verifiedStatus === 'FIRST_TIME', c1.body);

  console.log('\n📄 Case 2: response add upgrades responding user → PREVIOUSLY_VERIFIED');
  const responderToken = await login(RESPONDING_USER_EMAIL!, RESPONDING_USER_PASSWORD!);
  const form = new FormData();
  form.append('response', `Smoke test acknowledgement ${Date.now()}`);
  const patchRes = await fetch(`${API_BASE}/api/my-notices/${RESPONDABLE_NOTICE_ID}`, {
    method: 'PATCH',
    headers: authed(responderToken),
    body: form,
  });
  assert('Case 2 PATCH response accepted', patchRes.status === 200, { status: patchRes.status });
  const c2 = await getVerification(processorToken, RESPONDING_USER_ID);
  assert('Case 2 status 200', c2.status === 200, c2);
  assert(
    'Case 2 verifiedStatus === PREVIOUSLY_VERIFIED',
    c2.body.verifiedStatus === 'PREVIOUSLY_VERIFIED',
    c2.body,
  );
  assert('Case 2 verifiedAt is populated', typeof c2.body.verifiedAt === 'string' && !!c2.body.verifiedAt, c2.body);

  console.log('\n📄 Case 3: brand-new user with no prior send → still FIRST_TIME');
  const c3 = await getVerification(processorToken, FRESH_USER_ID);
  assert('Case 3 status 200', c3.status === 200, c3);
  assert('Case 3 verifiedStatus === FIRST_TIME', c3.body.verifiedStatus === 'FIRST_TIME', c3.body);

  console.log('\n🔒 Auth: unauth caller gets 401');
  const unauthRes = await fetch(`${API_BASE}/api/recipients/${RECIPIENT_USER_ID}/verification`);
  assert('unauth → 401', unauthRes.status === 401, { status: unauthRes.status });

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});
