// Permissions matrix unit test. Standalone — no DB, no server.
//
// Verifies the role-access matrix encoded in src/utils/permissions.ts
// matches guardian_roles_access.md. The backend mirror at lib/permissions.cjs
// is exercised separately via a sibling node script.
//
// Usage: bun src/tests/permissions.test.ts

import { can, hasRole, isAdmin, ROLE } from '../utils/permissions';

let passed = 0;
let failed = 0;

const ok = (cond: boolean, msg: string) => {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
};

const u = (...ids: number[]) => ({ roles: ids.map((id) => ({ id })) });

console.log('Matrix: Admin (1)');
ok(can(u(ROLE.ADMIN), 'requests.assign'),     'Admin can assign requests');
ok(can(u(ROLE.ADMIN), 'requests.viewAll'),    'Admin can view all requests');
ok(can(u(ROLE.ADMIN), 'notices.new'),         'Admin can create notices');
ok(can(u(ROLE.ADMIN), 'reports.workflow'),    'Admin can run reports');

console.log('Matrix: General User (2)');
ok(!can(u(ROLE.GENERAL_USER), 'requests.viewAll'),    'General CANNOT view all requests');
ok(!can(u(ROLE.GENERAL_USER), 'requests.assign'),     'General CANNOT assign');
ok(!can(u(ROLE.GENERAL_USER), 'notices.new'),         'General CANNOT create notices');
ok(!can(u(ROLE.GENERAL_USER), 'reports.workflow'),    'General CANNOT run reports');
ok(can(u(ROLE.GENERAL_USER),  'requests.viewMy'),     'General CAN view own requests');
ok(can(u(ROLE.GENERAL_USER),  'notices.respond'),     'General CAN respond to notices');
ok(can(u(ROLE.GENERAL_USER),  'requests.new'),        'General CAN create new requests');

console.log('Matrix: Processor (3)');
ok(can(u(ROLE.PROCESSOR), 'requests.start'),          'Processor can start requests');
ok(can(u(ROLE.PROCESSOR), 'requests.complete'),       'Processor can complete requests');
ok(can(u(ROLE.PROCESSOR), 'requests.tasks'),          'Processor can manage tasks');
ok(can(u(ROLE.PROCESSOR), 'notices.new'),             'Processor can create notices');
ok(!can(u(ROLE.PROCESSOR), 'requests.assign'),        'Processor CANNOT assign');
ok(!can(u(ROLE.PROCESSOR), 'requests.reassign'),      'Processor CANNOT reassign');
ok(!can(u(ROLE.PROCESSOR), 'reports.workflow'),       'Processor CANNOT run reports');

console.log('Matrix: Manager (4)');
ok(can(u(ROLE.MANAGER), 'requests.assign'),           'Manager can assign');
ok(can(u(ROLE.MANAGER), 'requests.reassign'),         'Manager can reassign');
ok(can(u(ROLE.MANAGER), 'reports.workflow'),          'Manager can run reports');
ok(can(u(ROLE.MANAGER), 'notices.viewAll'),           'Manager can view all notices');

console.log('Matrix: External User (5)');
ok(!can(u(ROLE.EXTERNAL_USER), 'requests.viewAll'),   'External CANNOT view all requests');
ok(!can(u(ROLE.EXTERNAL_USER), 'requests.viewAllDetails'), 'External CANNOT view all request details');
ok(!can(u(ROLE.EXTERNAL_USER), 'notices.new'),        'External CANNOT create notices');
ok(!can(u(ROLE.EXTERNAL_USER), 'notices.viewAll'),    'External CANNOT view all notices');
ok(can(u(ROLE.EXTERNAL_USER),  'requests.viewMy'),    'External CAN view own requests');
ok(can(u(ROLE.EXTERNAL_USER),  'notices.respond'),    'External CAN respond to notices');
ok(can(u(ROLE.EXTERNAL_USER),  'requests.new'),       'External CAN create new requests (Phase 2 will restrict by type)');

console.log('Matrix: Super Admin / JAFAR (6)');
ok(can(u(ROLE.SUPER_ADMIN), 'requests.assign'),       'Super Admin can assign');
ok(can(u(ROLE.SUPER_ADMIN), 'reports.workflow'),      'Super Admin can run reports');
ok(can(u(ROLE.SUPER_ADMIN), 'notices.new'),           'Super Admin can create notices');

console.log('Multi-role: ANY granting role wins');
ok(can(u(ROLE.GENERAL_USER, ROLE.MANAGER), 'requests.assign'),
   'General+Manager can assign (via Manager)');
ok(can(u(ROLE.GENERAL_USER, ROLE.PROCESSOR), 'requests.start'),
   'General+Processor can start (via Processor)');

console.log('Edge cases');
ok(!can(null, 'requests.viewMy'),                     'null user denied');
ok(!can(undefined, 'requests.viewMy'),                'undefined user denied');
ok(!can({ roles: [] }, 'requests.viewMy'),            'user with no roles denied');
ok(!can({ roles: [{ id: 999 }] }, 'requests.viewMy'), 'user with unknown role denied');

console.log('Helper functions');
ok(isAdmin(u(ROLE.ADMIN)),                            'isAdmin(1) true');
ok(isAdmin(u(ROLE.SUPER_ADMIN)),                      'isAdmin(6) true');
ok(!isAdmin(u(ROLE.MANAGER)),                         'isAdmin(4) false');
ok(hasRole(u(ROLE.MANAGER), ROLE.MANAGER),            'hasRole exact match');
ok(hasRole(u(ROLE.MANAGER, ROLE.GENERAL_USER), ROLE.GENERAL_USER), 'hasRole multi-role match');
ok(!hasRole(u(ROLE.MANAGER), ROLE.EXTERNAL_USER),     'hasRole no match');

// Backend mirror sanity check — load and verify it agrees
console.log('Backend mirror (lib/permissions.cjs)');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const backend = require('../../lib/permissions.cjs');
ok(backend.can({ userRoleIds: [ROLE.ADMIN] }, 'requests.assign'),
   'Backend: Admin can assign');
ok(!backend.can({ userRoleIds: [ROLE.PROCESSOR] }, 'requests.assign'),
   'Backend: Processor CANNOT assign');
ok(backend.can({ userRoleIds: [ROLE.PROCESSOR] }, 'requests.tasks'),
   'Backend: Processor can manage tasks');
ok(!backend.can({ userRoleIds: [ROLE.GENERAL_USER] }, 'requests.viewAll'),
   'Backend: General CANNOT view all requests');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
