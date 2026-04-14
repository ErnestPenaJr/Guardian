// Login tracking smoke test. Standalone ts-node script.
// Verifies that successful /api/login inserts a USER_LOGIN_EVENTS row
// (observed via the site analysis trends endpoint, which counts rows
// by day) and that failed logins do not.
//
// Uses the API rather than direct DB access so it works from any
// machine that can reach the dev server, regardless of Azure SQL
// firewall rules.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<email> \
//   TEST_JAFAR_PASSWORD=<password> \
//   bun src/tests/login-tracking.smoke.test.ts

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const EMAIL = process.env.TEST_JAFAR_EMAIL;
const PASSWORD = process.env.TEST_JAFAR_PASSWORD;

if (!EMAIL || !PASSWORD) {
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

const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = res.ok ? await res.json() as { token?: string } : null;
    return { status: res.status, body };
};

// Read today's `logins` count from the site analysis trend endpoint.
// We use ?refresh=true to bypass the 5-minute cache so we always see
// the freshest aggregation. The endpoint returns one bucket per UTC
// day; we find today's bucket by date string match.
const getTodayLoginCount = async (token: string): Promise<number> => {
    const res = await fetch(
        `${API_BASE}/api/jafar-admin/site-analysis?range=7d&refresh=true`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
        throw new Error(`site-analysis fetch failed: ${res.status}`);
    }
    const payload = await res.json() as {
        trends: { activityPerDay: Array<{ date: string; logins: number }> };
    };
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const bucket = payload.trends.activityPerDay.find((b) => b.date === todayUtc);
    return bucket?.logins ?? 0;
};

const main = async () => {
    console.log('🔐 Initial login to get a Jafar token...');
    const initialLogin = await login(EMAIL, PASSWORD);
    if (initialLogin.status !== 200 || !initialLogin.body?.token) {
        console.error('❌ Could not get a Jafar token to verify login tracking.');
        process.exit(1);
    }
    const token = initialLogin.body.token;

    // Wait for the fire-and-forget insert from the initial login to land.
    await new Promise((r) => setTimeout(r, 500));

    console.log('\n📊 Reading today\'s login count from site analysis...');
    const before = await getTodayLoginCount(token);
    console.log(`  Today's logins so far: ${before}`);

    console.log('\n🔐 Successful login...');
    const good = await login(EMAIL, PASSWORD);
    assert('successful login returns 200', good.status === 200, good.status);
    assert('successful login returns token', !!good.body?.token);

    // Wait for the fire-and-forget insert to land.
    await new Promise((r) => setTimeout(r, 500));

    const afterGood = await getTodayLoginCount(token);
    assert(
        'today login count incremented by exactly 1',
        afterGood === before + 1,
        `before=${before}, after=${afterGood}`
    );

    console.log('\n🚫 Failed login...');
    const bad = await login(EMAIL, 'definitely-wrong-password-xyz-12345');
    assert('failed login returns 401', bad.status === 401, bad.status);

    await new Promise((r) => setTimeout(r, 500));

    const afterBad = await getTodayLoginCount(token);
    assert(
        'today login count unchanged after failed login',
        afterBad === afterGood,
        `expected=${afterGood}, actual=${afterBad}`
    );

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
};

main().catch((err) => {
    console.error('💥 Smoke test crashed:', err);
    process.exit(1);
});
