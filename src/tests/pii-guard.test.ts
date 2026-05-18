// Phase 7 / US-SRB-01 — PII guard unit test.
//
// Pure unit test, no DB / no network. Run with:
//   bun src/tests/pii-guard.test.ts
//
// Exit code: 0 if all cases pass, 1 otherwise.

import { scanForPII } from '../../server/lib/piiGuard';

const cases: Array<[string, boolean, string?]> = [
  ['Customer SSN: 123-45-6789', true, 'SSN'],
  ['John Doe was the victim', true, 'CUSTOMER_NAME'],
  ['DOB: 01/02/1980', true, 'DOB'],
  ['Account 12345678 was compromised', true, 'ACCOUNT_NUMBER'],
  ['On [DATE_TIME_RANGE], symbol [SECURITY_SYMBOL] dropped', false, undefined],
];

for (const [input, expected, label] of cases) {
  const r = scanForPII(input);
  if (r.hit !== expected) {
    console.error(`FAIL: ${input}`);
    process.exit(1);
  }
  if (expected && label && r.label !== label) {
    console.error(`FAIL label: ${input} expected=${label} got=${r.label}`);
    process.exit(1);
  }
}

console.log('ok');
