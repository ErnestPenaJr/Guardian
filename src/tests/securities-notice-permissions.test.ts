// src/tests/securities-notice-permissions.test.ts
import { can, ROLE } from '../utils/permissions';

const checks: Array<[keyof typeof ROLE, string, boolean]> = [
  ['ADMIN',         'securitiesNotice.template.create',    true],
  ['SUPER_ADMIN',   'securitiesNotice.template.create',    true],
  ['MANAGER',       'securitiesNotice.template.create',    false],
  ['PROCESSOR',     'securitiesNotice.template.create',    false],
  ['GENERAL_USER',  'securitiesNotice.template.create',    false],
  ['EXTERNAL_USER', 'securitiesNotice.template.create',    false],

  ['PROCESSOR',     'securitiesNotice.send',               true],
  ['MANAGER',       'securitiesNotice.send',               true],
  ['ADMIN',         'securitiesNotice.send',               false],
  ['GENERAL_USER',  'securitiesNotice.send',               false],

  ['MANAGER',       'securitiesNotice.approve',            true],
  ['PROCESSOR',     'securitiesNotice.approve',            false],
  ['ADMIN',         'securitiesNotice.approve',            false],

  ['ADMIN',         'audit.viewFull',                      true],
  ['MANAGER',       'audit.viewScoped',                    true],
  ['PROCESSOR',     'audit.viewFull',                      false],

  ['SUPER_ADMIN',   'platform.config',                     true],
  ['ADMIN',         'platform.config',                     false],

  ['EXTERNAL_USER', 'external.attachSubpoena',             true],
  ['PROCESSOR',     'external.attachSubpoena',             false],
];

let fails = 0;
for (const [roleName, key, expected] of checks) {
  const user = { ROLE_ID: ROLE[roleName] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const got = can(user as any, key as any);
  if (got !== expected) { console.error(`FAIL ${roleName} ${key} expected=${expected} got=${got}`); fails++; }
}
if (fails) { console.error(`${fails} permission checks failed`); process.exit(1); }
console.log('ok');
