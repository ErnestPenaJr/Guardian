// Security report smoke test. Standalone ts-node/bun script — no test runner required.
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<jafar-user-email> \
//   TEST_JAFAR_PASSWORD=<jafar-password> \
//   bun src/tests/security-report.smoke.test.ts
//
// Exits 0 on success, 1 if any assertion fails.

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const JAFAR_EMAIL = process.env.TEST_JAFAR_EMAIL;
const JAFAR_PASSWORD = process.env.TEST_JAFAR_PASSWORD;

if (!JAFAR_EMAIL || !JAFAR_PASSWORD) {
    console.error('❌ TEST_JAFAR_EMAIL and TEST_JAFAR_PASSWORD must be set.');
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

const login = async (): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: JAFAR_EMAIL, password: JAFAR_PASSWORD })
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const body = await res.json() as { token: string };
    if (!body.token) throw new Error('Login response had no token');
    return body.token;
};

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const main = async () => {
    console.log('🔐 Logging in as Jafar...');
    const token = await login();

    console.log('\n📄 Happy path: GET /api/jafar-admin/security-reports');
    const listRes = await fetch(`${API_BASE}/api/jafar-admin/security-reports`, { headers: authed(token) });
    assert('list endpoint 200', listRes.status === 200, { status: listRes.status });
    const listBody = await listRes.json() as { reports: Array<{ filename: string; date: string; totals: Record<string, number> }> };
    assert('list body has reports array', Array.isArray(listBody.reports));
    if (listBody.reports.length > 0) {
        assert('first report has filename', typeof listBody.reports[0].filename === 'string');
        assert('first report has totals.critical', typeof listBody.reports[0].totals?.critical === 'number');
    }

    console.log('\n📄 Happy path: GET /api/jafar-admin/security-reports/latest');
    const latestRes = await fetch(`${API_BASE}/api/jafar-admin/security-reports/latest`, { headers: authed(token) });
    if (listBody.reports.length === 0) {
        assert('latest 404 when no reports', latestRes.status === 404, { status: latestRes.status });
    } else {
        assert('latest 200', latestRes.status === 200, { status: latestRes.status });
        const body = await latestRes.json() as { filename: string; report: { findings: unknown[]; totals: Record<string, number> } };
        assert('latest returns a filename', typeof body.filename === 'string');
        assert('latest returns findings[]', Array.isArray(body.report?.findings));
    }

    console.log('\n🛡️  Security: path traversal must be rejected');
    const traversalRes = await fetch(
        `${API_BASE}/api/jafar-admin/security-reports/..%2F..%2F.env`,
        { headers: authed(token) }
    );
    assert('..%2F..%2F.env → 400', traversalRes.status === 400, { status: traversalRes.status });

    const badNameRes = await fetch(
        `${API_BASE}/api/jafar-admin/security-reports/not-a-valid-name.txt`,
        { headers: authed(token) }
    );
    assert('invalid filename → 400', badNameRes.status === 400, { status: badNameRes.status });

    console.log('\n🔒 Auth: unauth caller gets 401');
    const unauthRes = await fetch(`${API_BASE}/api/jafar-admin/security-reports`);
    assert('unauth list → 401', unauthRes.status === 401, { status: unauthRes.status });

    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
};

main().catch((err) => {
    console.error('❌ Smoke test crashed:', err);
    process.exit(1);
});
