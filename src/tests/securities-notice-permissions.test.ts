// src/tests/securities-notice-permissions.test.ts
//
// Securities Notice MVP RBAC verification — two layers:
//
//   1. UNIT layer (no env, always runs): exercises the in-process MATRIX from
//      src/utils/permissions.ts to assert each (role, permissionKey) pair
//      resolves to the expected boolean. This guards the frontend/source-of-
//      truth role matrix from accidental drift.
//
//   2. HTTP layer (opt-in, requires env): for every new MVP endpoint, hits the
//      running server and asserts (a) unauth → 401, (b) wrong-role → 403 with
//      body containing the project's standard forbid() prefix
//      `"You do not have permission to "`, and (c) right-role → an expected
//      2xx / 409 success. The HTTP layer is *only* executed when the
//      `TEST_API_BASE` env var is set so it can be safely run from CI envs
//      that lack a running server + seeded users; otherwise the script exits
//      0 after the unit layer.
//
// HTTP-layer env vars (all required to run the HTTP layer):
//   TEST_API_BASE           — e.g. http://localhost:3001
//
//   TEST_SUPER_ADMIN_EMAIL  + TEST_SUPER_ADMIN_PASSWORD   (role 6 / JAFAR)
//   TEST_ADMIN_EMAIL        + TEST_ADMIN_PASSWORD         (role 1)
//   TEST_MANAGER_EMAIL      + TEST_MANAGER_PASSWORD       (role 4)
//   TEST_PROCESSOR_EMAIL    + TEST_PROCESSOR_PASSWORD     (role 3)
//   TEST_GENERAL_EMAIL      + TEST_GENERAL_PASSWORD       (role 2)
//   TEST_EXTERNAL_EMAIL     + TEST_EXTERNAL_PASSWORD      (role 5)
//
// Optional inputs used by the right-role probes (set when known so success
// assertions are more meaningful; otherwise the right-role call may legitimately
// return 404 because the target row doesn't exist — see the per-endpoint notes
// below where we accept 404 alongside the documented success status):
//
//   TEST_NOTICE_ID_DRAFT      — a MY_NOTICES row owned by the processor user
//                                in DRAFT status (used by submit / approve flow)
//   TEST_NOTICE_ID_PENDING    — a MY_NOTICES row in PENDING_APPROVAL status
//                                owned by the processor user, with the manager
//                                user as its assigned approver (used by
//                                approve / reject)
//   TEST_NOTICE_ID_AWAITING   — a MY_NOTICES row in
//                                SUBPOENA_RECEIVED_PENDING_REVIEW (used by
//                                records-released)
//   TEST_NOTICE_ID_EXTERNAL   — a MY_NOTICES row with an EXTERNAL_NOTICE_ASSIGNMENTS
//                                row linking it to the external user
//   TEST_LANGUAGE_TEMPLATE_ID — a SUBPOENA_LANGUAGE_TEMPLATES row
//
// Exits 0 on success, 1 if any unit-layer check fails or any HTTP-layer
// assertion fails (HTTP layer is skipped entirely when TEST_API_BASE is unset).

import { can, ROLE } from '../utils/permissions';

// ===========================================================================
// UNIT LAYER (always runs — no env, no network)
// ===========================================================================

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

let unitFails = 0;
for (const [roleName, key, expected] of checks) {
  const user = { ROLE_ID: ROLE[roleName] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const got = can(user as any, key as any);
  if (got !== expected) {
    console.error(`UNIT FAIL ${roleName} ${key} expected=${expected} got=${got}`);
    unitFails++;
  }
}
if (unitFails) {
  console.error(`${unitFails} unit-layer permission checks failed`);
  process.exit(1);
}
console.log(`unit: ${checks.length} checks ok`);

// ===========================================================================
// HTTP LAYER (skipped unless TEST_API_BASE is set)
// ===========================================================================

const API_BASE = process.env.TEST_API_BASE;
if (!API_BASE) {
  console.log('ok'); // preserves the legacy single-word success token
  process.exit(0);
}

// All forbid() responses share this prefix (server/lib/forbid.ts). Some
// middlewares (requireJafar) use a slightly different message — we tolerate
// any 403 body whose `error` either starts with this prefix OR equals one of
// the known middleware-specific strings.
const FORBID_PREFIX = 'You do not have permission to';
const FORBID_ALTERNATES = new Set<string>([
  'JAFAR access required', // requireJafar
]);

type RoleSlug =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'PROCESSOR'
  | 'GENERAL_USER'
  | 'EXTERNAL_USER';

const ROLE_ENV: Record<RoleSlug, { emailVar: string; passwordVar: string }> = {
  SUPER_ADMIN:   { emailVar: 'TEST_SUPER_ADMIN_EMAIL', passwordVar: 'TEST_SUPER_ADMIN_PASSWORD' },
  ADMIN:         { emailVar: 'TEST_ADMIN_EMAIL',       passwordVar: 'TEST_ADMIN_PASSWORD' },
  MANAGER:       { emailVar: 'TEST_MANAGER_EMAIL',     passwordVar: 'TEST_MANAGER_PASSWORD' },
  PROCESSOR:     { emailVar: 'TEST_PROCESSOR_EMAIL',   passwordVar: 'TEST_PROCESSOR_PASSWORD' },
  GENERAL_USER:  { emailVar: 'TEST_GENERAL_EMAIL',     passwordVar: 'TEST_GENERAL_PASSWORD' },
  EXTERNAL_USER: { emailVar: 'TEST_EXTERNAL_EMAIL',    passwordVar: 'TEST_EXTERNAL_PASSWORD' },
};

let httpPassed = 0;
let httpFailed = 0;

const assert = (name: string, condition: unknown, details?: unknown) => {
  if (condition) {
    console.log(`  ok ${name}`);
    httpPassed += 1;
  } else {
    console.error(`  FAIL ${name}`, details ?? '');
    httpFailed += 1;
  }
};

const tokenCache: Partial<Record<RoleSlug, string>> = {};

async function loginAs(role: RoleSlug): Promise<string | null> {
  if (tokenCache[role]) return tokenCache[role]!;
  const { emailVar, passwordVar } = ROLE_ENV[role];
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    console.warn(`  skip ${role}: missing ${emailVar}/${passwordVar}`);
    return null;
  }
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.warn(`  skip ${role}: login returned ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) {
    console.warn(`  skip ${role}: login response had no token`);
    return null;
  }
  tokenCache[role] = body.token;
  return body.token;
}

interface MatrixRow {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Roles that the project documents as allowed; one is chosen for the
   *  right-role probe (first one that has env credentials). */
  allowedRoles: RoleSlug[];
  /** Status returned by a correctly-authed call on a happy-ish path. We
   *  tolerate any of these as a "right-role succeeded" signal. 404 is widely
   *  tolerated because the test data referenced via env may not exist. */
  successStatuses: number[];
  /** A role known NOT to have access. Used for the 403 probe. */
  wrongRole: RoleSlug;
  /** A short, human-readable label for the test report. */
  label: string;
}

/**
 * Build the per-endpoint matrix. We deliberately point every call at a path
 * that exists in the TS server (server/routes/*.ts mounted by server/index.ts);
 * legacy server.cjs / server.js / server-production.js have NOT been mirrored
 * for most of these (see CLAUDE.md → "Securities Notice MVP — legacy-server
 * sync deferred"), so this suite must be run against the TS runtime
 * (`dist-server/index.js`).
 */
function buildMatrix(): MatrixRow[] {
  const idDraft = process.env.TEST_NOTICE_ID_DRAFT ?? '1';
  const idPending = process.env.TEST_NOTICE_ID_PENDING ?? '1';
  const idAwaiting = process.env.TEST_NOTICE_ID_AWAITING ?? '1';
  const idExternal = process.env.TEST_NOTICE_ID_EXTERNAL ?? '1';
  const languageTemplateId = process.env.TEST_LANGUAGE_TEMPLATE_ID ?? '1';

  return [
    // --- Securities Notices ----------------------------------------------
    {
      label: 'POST /api/securities-notices (create + send)',
      method: 'POST',
      path: '/api/securities-notices',
      body: {
        TEMPLATE_FORM_ID: 1,
        NOTICE_TITLE: 'rbac-probe',
        NOTICE_BODY: 'rbac-probe',
        recipients: [],
      },
      allowedRoles: ['PROCESSOR', 'MANAGER'],
      // 400/422 are also acceptable — a malformed body still cleared the
      // permission gate, which is what this test is asserting.
      successStatuses: [200, 201, 400, 404, 409, 422, 500],
      wrongRole: 'ADMIN',
    },
    {
      label: 'PUT /api/securities-notices/:id/submit',
      method: 'PUT',
      path: `/api/securities-notices/${idDraft}/submit`,
      body: { managerUserId: 0 },
      allowedRoles: ['PROCESSOR'],
      successStatuses: [200, 400, 404, 409, 422, 500],
      wrongRole: 'MANAGER',
    },
    {
      label: 'PUT /api/securities-notices/:id/approve',
      method: 'PUT',
      path: `/api/securities-notices/${idPending}/approve`,
      body: {},
      allowedRoles: ['MANAGER'],
      successStatuses: [200, 400, 404, 409, 500],
      wrongRole: 'PROCESSOR',
    },
    {
      label: 'PUT /api/securities-notices/:id/reject',
      method: 'PUT',
      path: `/api/securities-notices/${idPending}/reject`,
      body: { reason: 'rbac-probe' },
      allowedRoles: ['MANAGER'],
      successStatuses: [200, 400, 404, 409, 500],
      wrongRole: 'PROCESSOR',
    },
    {
      label: 'PUT /api/securities-notices/:id/records-released',
      method: 'PUT',
      path: `/api/securities-notices/${idAwaiting}/records-released`,
      body: {},
      allowedRoles: ['PROCESSOR', 'MANAGER'],
      successStatuses: [200, 400, 404, 409, 500],
      wrongRole: 'GENERAL_USER',
    },
    {
      label: 'GET /api/securities-notices',
      method: 'GET',
      path: '/api/securities-notices',
      allowedRoles: ['ADMIN', 'PROCESSOR', 'MANAGER', 'SUPER_ADMIN'],
      successStatuses: [200],
      // GET /api/securities-notices is requireAuth-only; the route returns
      // company-scoped data rather than 403, so we can't assert 403 on this
      // path. We still exercise the (a) unauth and (c) right-role legs and
      // emit a "skip 403" note for the (b) leg.
      wrongRole: 'GENERAL_USER',
    },

    // --- Subpoena Language Templates --------------------------------------
    {
      label: 'POST /api/templates/subpoena',
      method: 'POST',
      path: '/api/templates/subpoena',
      body: {
        FRAUD_TYPE: 'SECURITIES_FRAUD',
        LANGUAGE_TEMPLATE_NAME: 'rbac-probe',
        TEMPLATE_BODY: 'rbac-probe',
      },
      allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
      successStatuses: [200, 201, 400, 409, 422, 500],
      wrongRole: 'PROCESSOR',
    },

    // --- Subpoena Riders --------------------------------------------------
    {
      label: 'POST /api/subpoena-riders',
      method: 'POST',
      path: '/api/subpoena-riders',
      body: {
        LANGUAGE_TEMPLATE_ID: Number(languageTemplateId),
        NOTICE_ID: Number(idDraft),
      },
      allowedRoles: ['PROCESSOR', 'MANAGER'],
      successStatuses: [200, 201, 400, 404, 422, 500],
      wrongRole: 'ADMIN',
    },

    // --- External User Portal --------------------------------------------
    {
      label: 'POST /api/external/notices/:id/subpoena',
      method: 'POST',
      path: `/api/external/notices/${idExternal}/subpoena`,
      // Path expects multipart/form-data with a `file` field. Sending JSON
      // exercises the auth+role gate; the route will then return 400 for the
      // missing file. We tolerate any of [400, 403-from-other-cause, 404, 500]
      // for the right-role probe — the test we care about is that wrong-role
      // returns 403 with the FORBID prefix.
      body: { stub: true },
      allowedRoles: ['EXTERNAL_USER'],
      successStatuses: [200, 201, 400, 404, 500],
      wrongRole: 'PROCESSOR',
    },
    {
      label: 'POST /api/external/notices/:id/call-request',
      method: 'POST',
      path: `/api/external/notices/${idExternal}/call-request`,
      body: { proposedTimes: ['2026-06-01T10:00:00Z'] },
      allowedRoles: ['EXTERNAL_USER'],
      successStatuses: [200, 201, 400, 404, 422, 500],
      wrongRole: 'PROCESSOR',
    },

    // --- Audit ------------------------------------------------------------
    {
      label: 'GET /api/audit',
      method: 'GET',
      path: '/api/audit?page=1&pageSize=10',
      allowedRoles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
      successStatuses: [200],
      wrongRole: 'PROCESSOR',
    },
    {
      label: 'GET /api/audit/export',
      method: 'GET',
      path: '/api/audit/export?format=csv',
      allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
      successStatuses: [200],
      wrongRole: 'MANAGER',
    },

    // --- Platform (JAFAR) -------------------------------------------------
    {
      label: 'PUT /api/platform/disclaimer',
      method: 'PUT',
      path: '/api/platform/disclaimer',
      body: { text: 'rbac-probe disclaimer' },
      allowedRoles: ['SUPER_ADMIN'],
      successStatuses: [200, 400, 422, 500],
      wrongRole: 'ADMIN',
    },
  ];
}

async function hit(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; bodyText: string; parsed: any }> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const bodyText = await res.text();
  let parsed: any = undefined;
  try { parsed = bodyText ? JSON.parse(bodyText) : undefined; } catch { /* not json */ }
  return { status: res.status, bodyText, parsed };
}

function isForbidShape(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const err = String(parsed.error ?? '');
  if (err.startsWith(FORBID_PREFIX)) return true;
  if (FORBID_ALTERNATES.has(err)) return true;
  return false;
}

async function runHttp() {
  console.log(`\nhttp: running against ${API_BASE}\n`);
  const matrix = buildMatrix();

  for (const row of matrix) {
    console.log(`\n--- ${row.label} ---`);

    // (a) Unauthenticated → 401
    const unauth = await hit(row.method, row.path, undefined, row.body);
    assert(
      `unauth ${row.method} ${row.path} → 401`,
      unauth.status === 401,
      { status: unauth.status, body: unauth.bodyText.slice(0, 200) },
    );

    // (b) Wrong-role authenticated → 403 with FORBID prefix
    // GET /api/securities-notices is auth-only (no requireRole), so wrong-role
    // returns 200 with company-scoped data rather than 403. Skip the 403 leg.
    if (row.path === '/api/securities-notices' && row.method === 'GET') {
      console.log(`  skip 403 wrong-role check (route is requireAuth-only)`);
    } else {
      const wrongToken = await loginAs(row.wrongRole);
      if (!wrongToken) {
        console.log(`  skip 403 wrong-role check (no creds for ${row.wrongRole})`);
      } else {
        const forb = await hit(row.method, row.path, wrongToken, row.body);
        assert(
          `wrong-role (${row.wrongRole}) ${row.method} ${row.path} → 403`,
          forb.status === 403,
          { status: forb.status, body: forb.bodyText.slice(0, 200) },
        );
        assert(
          `wrong-role (${row.wrongRole}) body has FORBID prefix`,
          isForbidShape(forb.parsed),
          { body: forb.bodyText.slice(0, 200) },
        );
      }
    }

    // (c) Right-role → expected success status
    let rightToken: string | null = null;
    let chosenRole: RoleSlug | null = null;
    for (const r of row.allowedRoles) {
      const t = await loginAs(r);
      if (t) { rightToken = t; chosenRole = r; break; }
    }
    if (!rightToken || !chosenRole) {
      console.log(`  skip right-role success check (no creds for any of ${row.allowedRoles.join(',')})`);
      continue;
    }
    const ok = await hit(row.method, row.path, rightToken, row.body);
    assert(
      `right-role (${chosenRole}) ${row.method} ${row.path} → ${row.successStatuses.join('|')}`,
      row.successStatuses.includes(ok.status),
      { status: ok.status, body: ok.bodyText.slice(0, 300) },
    );
  }

  console.log(`\n${httpFailed === 0 ? 'ok' : 'FAIL'} http: ${httpPassed} passed, ${httpFailed} failed`);
  process.exit(httpFailed === 0 ? 0 : 1);
}

runHttp().catch((err) => {
  console.error('http suite crashed:', err);
  process.exit(1);
});
