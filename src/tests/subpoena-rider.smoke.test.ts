// Phase 7 / US-SRB-01 + US-SRB-02 — Subpoena rider smoke test.
//
// Standalone ts-node/bun script — no test runner required. Don't run in
// CI yet; we expect Ernest to wire seeded credentials before running.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_ADMIN_EMAIL=<admin@…> \
//   TEST_ADMIN_PASSWORD=<password> \
//   TEST_PROCESSOR_EMAIL=<processor@…> \
//   TEST_PROCESSOR_PASSWORD=<password> \
//   bun src/tests/subpoena-rider.smoke.test.ts
//
// Cases covered:
//   1. Admin creates a SECURITIES_MANIPULATION subpoena language template.
//   2. Admin attempts to save BASE_LANGUAGE containing PII (e.g. "John Doe")
//      → 400 with the spec error message.
//   3. Processor GETs the template for SECURITIES_MANIPULATION → 200.
//   4. Processor generates a rider with a clean token value → 201.
//   5. Processor generates a rider with PII in a token value → 400 with the
//      spec error message.
//   6. Processor requests a rider for a fraud type with no template → 404.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const PROCESSOR_EMAIL = process.env.TEST_PROCESSOR_EMAIL;
const PROCESSOR_PASSWORD = process.env.TEST_PROCESSOR_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !PROCESSOR_EMAIL || !PROCESSOR_PASSWORD) {
  console.error(
    '❌ Missing env. Required: TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_PROCESSOR_EMAIL, TEST_PROCESSOR_PASSWORD',
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

const main = async () => {
  console.log('🔐 Logging in as admin...');
  const adminToken = await login(ADMIN_EMAIL!, ADMIN_PASSWORD!);

  console.log('\n📄 Case 1: Admin creates SECURITIES_MANIPULATION template (clean)');
  const createRes = await fetch(`${API_BASE}/api/templates/subpoena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(adminToken) },
    body: JSON.stringify({
      FRAUD_TYPE: 'SECURITIES_MANIPULATION',
      BASE_LANGUAGE:
        'On [DATE_TIME_RANGE], unusual trading activity in [SECURITY_SYMBOL] was identified across [ACCOUNT_RANGE].',
      TOKENS: [
        { token: 'DATE_TIME_RANGE', description: 'Date/time window', autoPopulateFromIncident: true },
        { token: 'SECURITY_SYMBOL', description: 'Ticker symbol', autoPopulateFromIncident: true },
        { token: 'ACCOUNT_RANGE', description: 'Range of affected accounts', autoPopulateFromIncident: false },
      ],
    }),
  });
  assert('Case 1 status 201', createRes.status === 201, { status: createRes.status });

  console.log('\n📄 Case 2: Admin tries to save BASE_LANGUAGE with PII (John Doe) → 400');
  const piiRes = await fetch(`${API_BASE}/api/templates/subpoena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(adminToken) },
    body: JSON.stringify({
      FRAUD_TYPE: 'ATO',
      BASE_LANGUAGE: 'John Doe was the victim of an account takeover.',
      TOKENS: [],
    }),
  });
  assert('Case 2 status 400', piiRes.status === 400, { status: piiRes.status });
  const piiBody = await piiRes.json().catch(() => ({}));
  assert(
    'Case 2 error message mentions PII',
    typeof piiBody?.error === 'string' && piiBody.error.toLowerCase().includes('pii'),
    piiBody,
  );

  console.log('\n🔐 Logging in as processor...');
  const procToken = await login(PROCESSOR_EMAIL!, PROCESSOR_PASSWORD!);

  console.log('\n📄 Case 3: Processor GETs SECURITIES_MANIPULATION template');
  const getRes = await fetch(`${API_BASE}/api/templates/subpoena/SECURITIES_MANIPULATION`, {
    headers: authed(procToken),
  });
  assert('Case 3 status 200', getRes.status === 200, { status: getRes.status });

  console.log('\n📄 Case 4: Processor generates a rider with clean values → 201');
  const genRes = await fetch(`${API_BASE}/api/subpoena-riders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(procToken) },
    body: JSON.stringify({
      fraudType: 'SECURITIES_MANIPULATION',
      tokenValues: {
        DATE_TIME_RANGE: '2025-05-01 09:30 – 16:00 ET',
        SECURITY_SYMBOL: 'ACME',
        ACCOUNT_RANGE: 'A100-A199',
      },
    }),
  });
  assert('Case 4 status 201', genRes.status === 201, { status: genRes.status });

  console.log('\n📄 Case 5: Processor generates rider with PII token → 400');
  const genPiiRes = await fetch(`${API_BASE}/api/subpoena-riders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(procToken) },
    body: JSON.stringify({
      fraudType: 'SECURITIES_MANIPULATION',
      tokenValues: {
        DATE_TIME_RANGE: 'John Doe',
        SECURITY_SYMBOL: 'ACME',
        ACCOUNT_RANGE: 'A100',
      },
    }),
  });
  assert('Case 5 status 400', genPiiRes.status === 400, { status: genPiiRes.status });

  console.log('\n📄 Case 6: Processor requests rider for unconfigured fraud type → 404');
  const noTmplRes = await fetch(`${API_BASE}/api/subpoena-riders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authed(procToken) },
    body: JSON.stringify({
      fraudType: 'WIRE_FRAUD',
      tokenValues: {},
    }),
  });
  assert('Case 6 status 404', noTmplRes.status === 404, { status: noTmplRes.status });

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});
