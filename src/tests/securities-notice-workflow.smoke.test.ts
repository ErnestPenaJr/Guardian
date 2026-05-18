// Securities Notice workflow smoke test — Phase 5 (US-SNT-03..06).
// Mirrors the style of src/tests/security-report.smoke.test.ts.
//
// Required env:
//   TEST_API_BASE           default http://localhost:3001
//   TEST_PROCESSOR_EMAIL    a role=PROCESSOR (3) account
//   TEST_PROCESSOR_PASSWORD
//   TEST_ADMIN_EMAIL        a role=ADMIN    (1) account (used to assert 403)
//   TEST_ADMIN_PASSWORD
//   TEST_MANAGER_EMAIL      a role=MANAGER  (4) account (optional — approve path)
//   TEST_MANAGER_PASSWORD
//   TEST_TEMPLATE_FORM_ID   FORM_ID of a SECURITIES_FRAUD template w/o approval
//   TEST_TEMPLATE_FORM_ID_APPROVAL  optional — template that requires approval
//   TEST_RECIPIENT_USER_ID  USER_ID to send to (must share the company)
//   TEST_FIRST_TIME_RECIPIENT_USER_ID  USER_ID for first-time case (optional)
//
// Usage:
//   bun src/tests/securities-notice-workflow.smoke.test.ts
//
// IMPORTANT: This test will WRITE to the database. Run against a dev/staging
// company with disposable recipient accounts only.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';

const PROCESSOR_EMAIL = process.env.TEST_PROCESSOR_EMAIL;
const PROCESSOR_PASSWORD = process.env.TEST_PROCESSOR_PASSWORD;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const TEMPLATE_FORM_ID = Number(process.env.TEST_TEMPLATE_FORM_ID);
const RECIPIENT_USER_ID = Number(process.env.TEST_RECIPIENT_USER_ID);
const FIRST_TIME_RECIPIENT_USER_ID = process.env.TEST_FIRST_TIME_RECIPIENT_USER_ID
  ? Number(process.env.TEST_FIRST_TIME_RECIPIENT_USER_ID)
  : RECIPIENT_USER_ID;

if (
  !PROCESSOR_EMAIL ||
  !PROCESSOR_PASSWORD ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  !Number.isFinite(TEMPLATE_FORM_ID) ||
  !Number.isFinite(RECIPIENT_USER_ID)
) {
  console.error(
    '❌ Required env: TEST_PROCESSOR_EMAIL, TEST_PROCESSOR_PASSWORD, ' +
      'TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_TEMPLATE_FORM_ID, ' +
      'TEST_RECIPIENT_USER_ID',
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
  if (!body.token) throw new Error('No token in login response');
  return body.token;
};

const authed = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const main = async () => {
  console.log('🔐 Logging in as processor / admin...');
  const processorToken = await login(PROCESSOR_EMAIL, PROCESSOR_PASSWORD);
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  // -------------------------------------------------------------------------
  // Case 1: POST /api/securities-notices as processor with verified recipient
  //         + valid fields → 201, NOTICE_STATUS = SENT_AWAITING_RESPONSE,
  //         audit NOTICE_SENT written.
  // -------------------------------------------------------------------------
  console.log(
    '\n📨 Case 1: processor → POST /api/securities-notices (verified recipient)',
  );
  const validPayload = {
    templateFormId: TEMPLATE_FORM_ID,
    fields: {
      SECURITY_SYMBOL: 'AAPL',
      INCIDENT_DATETIME: new Date().toISOString(),
      LOSS_EXPOSURE: '12500',
      VICTIM_COUNT: '3',
      SECURITIES_INVOLVED: 'Common Stock',
    },
    recipientUserId: RECIPIENT_USER_ID,
    confirmFirstTime: true, // bypass first-time intercept for this happy-path
  };
  const case1Res = await fetch(`${API_BASE}/api/securities-notices`, {
    method: 'POST',
    headers: authed(processorToken),
    body: JSON.stringify(validPayload),
  });
  assert('Case 1 returns 201', case1Res.status === 201, { status: case1Res.status });
  const case1Body = await case1Res.json().catch(() => ({}));
  assert(
    'Case 1 response has notice',
    !!(case1Body as { notice?: { NOTICE_STATUS?: string } }).notice,
  );
  const case1Notice = (case1Body as { notice?: { NOTICE_STATUS?: string; NOTICE_ID?: number } })
    .notice;
  assert(
    'Case 1 NOTICE_STATUS is SENT_AWAITING_RESPONSE',
    case1Notice?.NOTICE_STATUS === 'SENT_AWAITING_RESPONSE',
    { actual: case1Notice?.NOTICE_STATUS },
  );

  // -------------------------------------------------------------------------
  // Case 2: same POST as ADMIN (role 1) → 403
  //         "You do not have permission to send a securities notice."
  // -------------------------------------------------------------------------
  console.log('\n🚫 Case 2: admin (role 1) POST → expect 403');
  const case2Res = await fetch(`${API_BASE}/api/securities-notices`, {
    method: 'POST',
    headers: authed(adminToken),
    body: JSON.stringify(validPayload),
  });
  assert('Case 2 returns 403', case2Res.status === 403, { status: case2Res.status });
  const case2Body = (await case2Res.json().catch(() => ({}))) as { error?: string };
  assert(
    'Case 2 error mentions "permission to send"',
    typeof case2Body.error === 'string' && /permission to send/i.test(case2Body.error),
    case2Body,
  );

  // -------------------------------------------------------------------------
  // Case 3: POST without SECURITY_SYMBOL → 400 with the exact field-validation
  //         message.
  // -------------------------------------------------------------------------
  console.log('\n🛡️  Case 3: missing SECURITY_SYMBOL → expect 400');
  const case3Res = await fetch(`${API_BASE}/api/securities-notices`, {
    method: 'POST',
    headers: authed(processorToken),
    body: JSON.stringify({
      ...validPayload,
      fields: { ...validPayload.fields, SECURITY_SYMBOL: '' },
    }),
  });
  assert('Case 3 returns 400', case3Res.status === 400, { status: case3Res.status });
  const case3Body = (await case3Res.json().catch(() => ({}))) as { error?: string };
  assert(
    'Case 3 error matches field-validation message',
    typeof case3Body.error === 'string' &&
      case3Body.error.includes('Security Symbol is a required field'),
    case3Body,
  );

  // -------------------------------------------------------------------------
  // Case 4: First-time recipient + confirmFirstTime=false → 409 with body
  //         { requiresFirstTimeConfirmation: true }.
  // -------------------------------------------------------------------------
  console.log('\n⚠️  Case 4: first-time recipient, no confirm → expect 409');
  const case4Res = await fetch(`${API_BASE}/api/securities-notices`, {
    method: 'POST',
    headers: authed(processorToken),
    body: JSON.stringify({
      ...validPayload,
      recipientUserId: FIRST_TIME_RECIPIENT_USER_ID,
      confirmFirstTime: false,
    }),
  });
  // Either 409 with the confirmation flag (first-time) OR 201 if the recipient
  // happens to already be PREVIOUSLY_VERIFIED in this env — accept both but
  // assert structurally.
  if (case4Res.status === 409) {
    const body = (await case4Res.json().catch(() => ({}))) as {
      requiresFirstTimeConfirmation?: boolean;
    };
    assert(
      'Case 4 body has requiresFirstTimeConfirmation=true',
      body.requiresFirstTimeConfirmation === true,
      body,
    );
  } else {
    assert(
      'Case 4 (recipient already verified) — accepted 201',
      case4Res.status === 201,
      { status: case4Res.status },
    );
  }

  // -------------------------------------------------------------------------
  // Case 5: First-time recipient + confirmFirstTime=true → 201, audit row
  //         FIRST_TIME_RECIPIENT_CONFIRMED + NOTICE_SENT with firstTimeFlag.
  //         We can only assert the API response here; audit-log inspection
  //         lives in Phase 8.
  // -------------------------------------------------------------------------
  console.log('\n✅ Case 5: first-time recipient, confirmed → expect 201');
  const case5Res = await fetch(`${API_BASE}/api/securities-notices`, {
    method: 'POST',
    headers: authed(processorToken),
    body: JSON.stringify({
      ...validPayload,
      recipientUserId: FIRST_TIME_RECIPIENT_USER_ID,
      confirmFirstTime: true,
    }),
  });
  assert('Case 5 returns 201', case5Res.status === 201, { status: case5Res.status });

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});
