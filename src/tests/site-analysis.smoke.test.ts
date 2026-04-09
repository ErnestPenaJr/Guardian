// Site analysis smoke test. Standalone ts-node script — no test runner required.
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<jafar-user-email> \
//   TEST_JAFAR_PASSWORD=<jafar-password> \
//   bun src/tests/site-analysis.smoke.test.ts
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

const fetchSiteAnalysis = async (token: string, range: string, refresh = false) => {
    const url = `${API_BASE}/api/jafar-admin/site-analysis?range=${range}${refresh ? '&refresh=true' : ''}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
};

const main = async () => {
    console.log('🔐 Logging in as Jafar...');
    const token = await login();

    console.log('\n📊 Happy path: GET /api/jafar-admin/site-analysis?range=30d');
    const happy = await fetchSiteAnalysis(token, '30d');
    assert('status is 200', happy.status === 200, happy.status);

    const payload = happy.body as Record<string, unknown>;
    assert('payload has range', payload.range === '30d');
    assert('payload has rangeStart', typeof payload.rangeStart === 'string');
    assert('payload has rangeEnd', typeof payload.rangeEnd === 'string');
    assert('payload has generatedAt', typeof payload.generatedAt === 'string');
    assert('payload has kpis object', typeof payload.kpis === 'object' && payload.kpis !== null);
    assert('payload has trends object', typeof payload.trends === 'object' && payload.trends !== null);
    assert('payload has companies array', Array.isArray(payload.companies));

    const kpis = payload.kpis as Record<string, unknown>;
    const expectedKpiKeys = [
        'totalCompanies', 'totalUsers', 'recentlyActiveUsers',
        'totalRequests', 'requestsInRange', 'tasksInRange',
        'totalCustomFormTemplates', 'totalAttachments'
    ];
    for (const key of expectedKpiKeys) {
        assert(`kpis.${key} is a number`, typeof kpis[key] === 'number');
    }

    const trends = payload.trends as { activityPerDay?: unknown; newAccountsPerDay?: unknown };
    assert('trends.activityPerDay is array', Array.isArray(trends.activityPerDay));
    assert('trends.newAccountsPerDay is array', Array.isArray(trends.newAccountsPerDay));
    if (Array.isArray(trends.activityPerDay) && trends.activityPerDay.length > 0) {
        const sample = trends.activityPerDay[0] as Record<string, unknown>;
        assert('activityPerDay[0] has date', typeof sample.date === 'string');
        assert('activityPerDay[0] has logins', typeof sample.logins === 'number');
        assert('activityPerDay[0] has requests', typeof sample.requests === 'number');
        assert('activityPerDay[0] has tasks', typeof sample.tasks === 'number');
    }

    console.log('\n🔁 Cache behavior: second call should return cached:true');
    const second = await fetchSiteAnalysis(token, '30d');
    assert('second call cached:true',
        (second.body as Record<string, unknown>).cached === true);

    console.log('\n🔄 Refresh: ?refresh=true should return cached:false and a new generatedAt');
    const initialGeneratedAt = (second.body as Record<string, string>).generatedAt;
    await new Promise((r) => setTimeout(r, 50)); // ensure clock tick
    const refreshed = await fetchSiteAnalysis(token, '30d', true);
    const refreshedBody = refreshed.body as Record<string, unknown>;
    assert('refresh returns cached:false', refreshedBody.cached === false);
    assert('refresh has new generatedAt',
        typeof refreshedBody.generatedAt === 'string' && refreshedBody.generatedAt !== initialGeneratedAt);

    console.log('\n🚫 Invalid range: ?range=xyz should return 400');
    const bad = await fetchSiteAnalysis(token, 'xyz');
    assert('invalid range returns 400', bad.status === 400, bad.status);

    console.log('\n🔒 Unauthenticated: no JWT should return 401');
    const unauthed = await fetch(`${API_BASE}/api/jafar-admin/site-analysis?range=30d`);
    assert('unauthenticated returns 401', unauthed.status === 401, unauthed.status);

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
};

main().catch((err) => {
    console.error('💥 Smoke test crashed:', err);
    process.exit(1);
});
