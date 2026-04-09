# Site Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Jafar-only cross-tenant usage dashboard at `/jafar/site-analysis` showing KPI cards, time-series trend charts, and a per-company breakdown table. Also adds login tracking (new `USER_LOGIN_EVENTS` table) to power the "Recently Active Users" and "Logins per day" metrics.

**Architecture:** New Express route `GET /api/jafar-admin/site-analysis?range=<preset>&refresh=<bool>` added inline in all three legacy server files (`server.cjs`, `server-production.js`, `server.js`), gated by the existing `getAuthenticatedUserCompany, checkJafarRole` middleware chain. Raw SQL aggregation via `prisma.$queryRaw`/`$queryRawUnsafe` with a process-local `Map` cache (5-min TTL, manual refresh). React page `src/pages/SiteAnalysis.tsx` with recharts line charts and an AG Grid company table, reached via a new "Site Analysis" tile on `AdminDashboard` that mirrors the existing "JAFAR Hard Delete" tile pattern.

**Tech Stack:** Express (legacy inline routes in `.cjs`/`.js`), Prisma ORM (raw queries), Microsoft SQL Server, React 18 + TypeScript, recharts (already installed), AG Grid Community (already installed), react-router-dom v7.

---

## Context notes for the engineer

Read these before starting — they explain decisions that will otherwise look wrong.

1. **`server.cjs` is the source of truth for API logic.** The `server/` TypeScript tree exists but is NOT mounted in the running servers (`server/index.ts` does not import `server/routes/jafar-admin.ts`). New Jafar routes go inline in `server.cjs`, then are copied to `server-production.js` and `server.js`. This is the consolidation direction the project is going — see commit `3d643b1 feat: ... consolidate routing to server.cjs`.

2. **No test runner is installed.** `package.json` has no `"test"` script and no `vitest`/`jest`/`@testing-library/react`. The existing `src/tests/*.test.ts` files are standalone `ts-node` scripts that import code, run it, log pass/fail, and `process.exit(1)` on failure. This plan matches that convention — see Tasks 14 and 15. Do NOT introduce a test framework as part of this feature.

3. **Multi-server sync rule.** Per `CLAUDE.md`, any endpoint or middleware change MUST land in all three server files: `server.cjs`, `server-production.js`, `server.js`. Tasks 2-3, 4-5, and 11-13 each include a dedicated sync task to enforce this.

4. **Middleware pattern.** Existing Jafar routes use `app.get('/api/jafar-admin/...', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {...})`. Both middlewares are defined inline in `server.cjs` (`checkJafarRole` at line 13917). Do NOT use the `requireAuth`/`requireJafar` helpers from `server/` — those belong to the unused TS tree.

5. **No FK cascade on `USER_LOGIN_EVENTS`.** The purge transaction pattern in `server.cjs` (see `createEmptyJafarCounts` at line 14119 and `buildJafarUserPreview` at line 14142) requires explicit counts and explicit DELETE statements for every related table. Adding an `ON DELETE CASCADE` would silently bypass the purge count display. Instead, wire `USER_LOGIN_EVENTS` into the existing count + delete pattern — see Tasks 4 and 5.

6. **Schema quirks to watch for in SQL queries:**
   - `REQUESTS.COMPANY_ID` is `Decimal(38,0)`, not `Int`. Use `TRY_CONVERT(INT, COMPANY_ID)` or compare as decimal when joining/filtering.
   - `TASKS` has NO `COMPANY_ID` column. To get per-company task counts, JOIN `TASKS` to `REQUESTS` on `REQUEST_ID` and use `REQUESTS.COMPANY_ID`.
   - `COMPANY.CREATED_AT` is named `CREATED_AT`, not `CREATE_DATE` (inconsistent with other tables).
   - `REQUESTS` has both `SUBMITTED_DATE` and `CREATE_DATE` — use `CREATE_DATE` for "requests created per day".
   - `USERS.COMPANY_ID` is `Int?` and the existing purge helper at line 14113 uses `TRY_CONVERT(INT, COMPANY_ID)` — follow that convention for safety.
   - Custom form templates = `GUARDIAN.FORMS WHERE COMPANY_ID IS NOT NULL` (excludes global Jafar templates).

7. **Cache is process-local.** The `Map` lives as a module-level `const` in each server file. No Redis. Single-user dashboard; cache fragmentation across the three server processes is irrelevant since only one is running at a time for any given environment.

8. **Timezone.** Backend always returns raw UTC (`toISOString()`); frontend uses `new Date(iso).toLocaleString()` and `.toLocaleDateString()` to display. Day buckets in trend data use UTC days (`CONVERT(DATE, LOGIN_AT)` in SQL Server). A UI footnote on the SiteAnalysis page explains this.

9. **Spec.** The approved design spec lives at `docs/superpowers/specs/2026-04-08-site-analysis-design.md`. Every task in this plan maps back to a section in that spec.

## File structure

### Files to create

**Backend:**
- `prisma/migrations/20260408-add-user-login-events.sql` — hand-written DDL for the new table.

**Frontend:**
- `src/components/RequireJafar.tsx` — reusable route guard for role 6.
- `src/components/SiteAnalysis/types.ts` — shared TS types for the API payload.
- `src/components/SiteAnalysis/SiteAnalysisHeader.tsx` — title, range selector, refresh button, "updated X ago" display.
- `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx` — 8-tile grid.
- `src/components/SiteAnalysis/SiteAnalysisActivityChart.tsx` — recharts `LineChart` (logins/requests/tasks per day).
- `src/components/SiteAnalysis/SiteAnalysisNewAccountsChart.tsx` — recharts `LineChart` (new users/new companies per day).
- `src/components/SiteAnalysis/SiteAnalysisCompanyTable.tsx` — AG Grid company breakdown.
- `src/pages/SiteAnalysis.tsx` — page component with fetch, state, error handling.

**Tests:**
- `src/tests/site-analysis.smoke.test.ts` — standalone ts-node script.
- `src/tests/login-tracking.smoke.test.ts` — standalone ts-node script.

### Files to modify

**Schema:**
- `prisma/schema.prisma` — add `USER_LOGIN_EVENTS` model.

**Backend (same edits applied to all three):**
- `server.cjs` — login tracking insert, purge integration, site analysis helpers + route.
- `server-production.js` — same.
- `server.js` — same.

**Frontend:**
- `src/App.tsx` — add `/jafar/site-analysis` route with `RequireJafar` guard.
- `src/pages/AdminDashboard.tsx` — add "Site Analysis" tile + `onShowJafarSiteAnalysis` prop.
- `src/pages/Home.tsx` — add `selectedSection='jafarSiteAnalysis'` branch + callback wiring.
- `src/pages/JafarAdministration.tsx` — refactor to use the new `RequireJafar` guard (delete duplicated inline check at lines 78-80).

---

## Task 1: Add `USER_LOGIN_EVENTS` schema + SQL migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260408-add-user-login-events.sql`

- [ ] **Step 1: Add the Prisma model**

Append this model to `prisma/schema.prisma` immediately after the existing `USERS` model (after line 437):

```prisma
model USER_LOGIN_EVENTS {
  EVENT_ID  Int      @id(map: "PK_USER_LOGIN_EVENTS") @default(autoincrement())
  USER_ID   Int
  LOGIN_AT  DateTime @default(now(), map: "DF__USER_LOGIN_EVENTS__LOGIN_AT") @db.DateTime

  @@index([LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_LOGIN_AT")
  @@index([USER_ID, LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_USER_LOGIN_AT")
  @@schema("GUARDIAN")
}
```

- [ ] **Step 2: Create the SQL migration file**

Create `prisma/migrations/20260408-add-user-login-events.sql`:

```sql
-- Migration: Add USER_LOGIN_EVENTS table for site analysis login tracking
-- Matches convention of 20250428-allow-null-request-relations.sql: hand-written,
-- manually applied to each environment (dev/staging/prod).

CREATE TABLE GUARDIAN.USER_LOGIN_EVENTS (
    EVENT_ID INT IDENTITY(1,1) NOT NULL,
    USER_ID  INT NOT NULL,
    LOGIN_AT DATETIME NOT NULL CONSTRAINT DF__USER_LOGIN_EVENTS__LOGIN_AT DEFAULT (GETDATE()),
    CONSTRAINT PK_USER_LOGIN_EVENTS PRIMARY KEY CLUSTERED (EVENT_ID)
);

CREATE NONCLUSTERED INDEX IX_USER_LOGIN_EVENTS_LOGIN_AT
    ON GUARDIAN.USER_LOGIN_EVENTS (LOGIN_AT);

CREATE NONCLUSTERED INDEX IX_USER_LOGIN_EVENTS_USER_LOGIN_AT
    ON GUARDIAN.USER_LOGIN_EVENTS (USER_ID, LOGIN_AT);
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `bun prisma generate`
Expected output: ends with `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Apply the SQL migration to the dev database**

Run the SQL in your preferred SQL Server client (Azure Data Studio, SSMS, etc.), connected to the `GUARDIAN-DEV` database:

```bash
cat prisma/migrations/20260408-add-user-login-events.sql
```

Then execute the contents against `guardian-dev-db.database.windows.net`. Verify the table exists:

```sql
SELECT TOP 5 * FROM GUARDIAN.USER_LOGIN_EVENTS;
```

Expected: 0 rows, no error.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260408-add-user-login-events.sql
git commit -m "$(cat <<'EOF'
feat(schema): add USER_LOGIN_EVENTS table for login tracking

New table powers the "Recently Active Users" KPI and "Logins per day"
trend chart in the upcoming Site Analysis dashboard. No FK cascade;
the existing Jafar purge transaction explicitly enumerates and deletes
related rows per project convention.
EOF
)"
```

---

## Task 2: Add login tracking to `/api/login` — `server.cjs`

**Files:**
- Modify: `server.cjs:1686` (insert just before the `res.json(...)` that returns the successful login response)

**Context:** The successful-login branch at `server.cjs:1686-1706` currently logs a success message and sends the JWT response. We insert a fire-and-forget write to `USER_LOGIN_EVENTS`. The write MUST NOT be `await`'d — if the DB write fails, the user should still log in successfully. The `.catch()` logs the error so it's visible in server logs.

- [ ] **Step 1: Locate the insertion point**

Open `server.cjs` and find line 1686 (the `console.log` immediately before `res.json(...)` in the `/api/login` handler):

```js
        console.log(`✅ Login successful for: ${email} (User ID: ${user.USER_ID}, Company: ${user.COMPANY_ID})`);

        res.json({
```

- [ ] **Step 2: Insert the fire-and-forget login event write**

Replace the block above with:

```js
        console.log(`✅ Login successful for: ${email} (User ID: ${user.USER_ID}, Company: ${user.COMPANY_ID})`);

        // Fire-and-forget: record login event for site analysis. Failure here
        // MUST NOT block the login response — login availability > analytics.
        prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_LOGIN_EVENTS (USER_ID, LOGIN_AT)
            VALUES (${user.USER_ID}, GETDATE())
        `.catch((err) => {
            console.error('[LOGIN TRACK] Failed to record login event:', err);
        });

        res.json({
```

- [ ] **Step 3: Start the dev server and verify login still works**

Run: `bun run server:dev`
Expected: Server starts, logs `✅ Database connected successfully`.

In a second terminal, POST a login request:

```bash
curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<known-dev-user-email>","password":"<known-dev-password>"}'
```

Expected: HTTP 200 with a `token` in the JSON response. Server logs show `✅ Login successful` and no `[LOGIN TRACK]` error.

- [ ] **Step 4: Verify a row landed in `USER_LOGIN_EVENTS`**

Run against the dev DB:

```sql
SELECT TOP 5 EVENT_ID, USER_ID, LOGIN_AT
FROM GUARDIAN.USER_LOGIN_EVENTS
ORDER BY EVENT_ID DESC;
```

Expected: at least one row with `LOGIN_AT` within the last few seconds and `USER_ID` matching the user you logged in as.

- [ ] **Step 5: Commit**

```bash
git add server.cjs
git commit -m "$(cat <<'EOF'
feat(auth): track successful logins in USER_LOGIN_EVENTS (dev server)

Inserts a USER_LOGIN_EVENTS row on every successful /api/login in
server.cjs. The write is fire-and-forget — if it fails, the error is
logged but the user still gets a valid token. Login availability
strictly wins over analytics accuracy.

Production servers will be updated in the next commit per the
multi-server sync rule in CLAUDE.md.
EOF
)"
```

---

## Task 3: Sync login tracking to `server-production.js` and `server.js`

**Files:**
- Modify: `server-production.js` (find the matching `/api/login` handler)
- Modify: `server.js` (find the matching `/api/login` handler)

**Context:** Per `CLAUDE.md`, all three server files must stay in sync. This task is a pure copy of the change from Task 2 into the other two files.

- [ ] **Step 1: Locate `/api/login` in `server-production.js`**

Run:

```bash
grep -n "app.post('/api/login'" server-production.js
```

Expected: one matching line. Open `server-production.js` and navigate to that handler. Find the line that logs `✅ Login successful for:` immediately before the `res.json(...)`.

- [ ] **Step 2: Insert the same fire-and-forget write**

Apply the identical edit from Task 2 Step 2 — insert the `prisma.$executeRaw` block between the `console.log` and the `res.json(...)`:

```js
        console.log(`✅ Login successful for: ${email} (User ID: ${user.USER_ID}, Company: ${user.COMPANY_ID})`);

        // Fire-and-forget: record login event for site analysis. Failure here
        // MUST NOT block the login response — login availability > analytics.
        prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_LOGIN_EVENTS (USER_ID, LOGIN_AT)
            VALUES (${user.USER_ID}, GETDATE())
        `.catch((err) => {
            console.error('[LOGIN TRACK] Failed to record login event:', err);
        });

        res.json({
```

- [ ] **Step 3: Locate `/api/login` in `server.js` and apply the same edit**

Run:

```bash
grep -n "app.post('/api/login'" server.js
```

Apply the identical insertion.

- [ ] **Step 4: Verify the three files agree on the login tracking block**

Run:

```bash
grep -c "INSERT INTO GUARDIAN.USER_LOGIN_EVENTS" server.cjs server-production.js server.js
```

Expected: each file reports `1`.

- [ ] **Step 5: Commit**

```bash
git add server-production.js server.js
git commit -m "$(cat <<'EOF'
chore(sync): mirror login tracking into production server files

Keeps server.cjs, server-production.js, and server.js aligned per the
multi-server sync rule. No behavioral change beyond matching the dev
server's fire-and-forget USER_LOGIN_EVENTS insert.
EOF
)"
```

---

## Task 4: Wire `USER_LOGIN_EVENTS` into the Jafar purge — `server.cjs`

**Files:**
- Modify: `server.cjs` — the purge helpers at lines 14119 (counts), 14142 (user preview), 14210 (company preview), 14285 (executeJafarUserPurge), and wherever `executeJafarCompanyPurge` lives.

**Context:** The existing purge flow uses `createEmptyJafarCounts()` as the canonical counts shape, then `buildJafarUserPreview` / `buildJafarCompanyPreview` populate counts from database queries, then `executeJafarUserPurge` / `executeJafarCompanyPurge` run explicit `DELETE` statements in a transaction. We add `USER_LOGIN_EVENTS` to all three layers so Jafar sees the count in the preview modal and the rows get cleaned up during purge.

- [ ] **Step 1: Extend `createEmptyJafarCounts()`**

Find `server.cjs:14119`:

```js
const createEmptyJafarCounts = () => ({
    attachments: 0,
    requests: 0,
    tasks: 0,
```

Add a new key at the bottom of the object (just before the closing `});` around line 14140):

```js
    forms: 0,
    formFields: 0,
    formInstances: 0,
    formInstanceValues: 0,
    userLoginEvents: 0
});
```

- [ ] **Step 2: Add the login events count to `buildJafarUserPreview`**

Find `server.cjs:14192` (the line `counts.users = 1;` at the end of the user preview function). Add the login events count just before it:

```js
    counts.userLoginEvents = await countRaw(`
        SELECT COUNT(*) AS count
        FROM GUARDIAN.USER_LOGIN_EVENTS
        WHERE USER_ID = ${userId}
    `);
    counts.users = 1;
```

- [ ] **Step 3: Add the login events count to `buildJafarCompanyPreview`**

Find `buildJafarCompanyPreview` at `server.cjs:14210`. Locate the line `counts.company = 1;` near the end of the function (around line 14271). Add the login events count just before it:

```js
    counts.userLoginEvents = userIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.USER_LOGIN_EVENTS WHERE USER_ID IN (${joinIds(userIds)})`)
        : 0;
    counts.company = 1;
```

- [ ] **Step 4: Add the delete statement to `executeJafarUserPurge`**

Find `executeJafarUserPurge` at `server.cjs:14285`. Inside the `prisma.$transaction` block, find the line that deletes from `GUARDIAN.TASKS`. Add this delete statement immediately before the final user deletion in the transaction (safe order: login events have no FKs so they can be deleted at any point, but keeping it next to other user-scoped deletes keeps the code readable):

```js
        counts.userLoginEvents += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_LOGIN_EVENTS WHERE USER_ID = ${userId}`);
```

Place it immediately after the `counts.tasks += await tx.$executeRawUnsafe(...)` call and before any subsequent deletes. If you can't find the exact spot, search for `DELETE FROM GUARDIAN.USER_ROLES` and add the new line before it.

- [ ] **Step 5: Add the delete statement to `executeJafarCompanyPurge`**

Search for the company-purge execute function:

```bash
grep -n "executeJafarCompanyPurge\|const executeJafarCompanyPurge" server.cjs
```

Open that function and, inside its `prisma.$transaction` block, add a similar delete scoped to the company's users. Place it immediately after the tasks delete:

```js
        counts.userLoginEvents += userIds.length > 0
            ? await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_LOGIN_EVENTS WHERE USER_ID IN (${joinIds(userIds)})`)
            : 0;
```

- [ ] **Step 6: Verify the dev server still starts and the Jafar preview works**

Restart the dev server: `bun run server:dev`.

Then log in as a Jafar user via the app, open JAFAR Administration, search for a test user, and click to preview the purge. The preview modal should show a new "User Login Events" row (or whatever the existing label mapping renders for new count keys). **Note:** the frontend's `countLabelMap` in `src/pages/JafarAdministration.tsx` may not have a friendly label for `userLoginEvents`. That's OK for now — the raw key will show until we update the map. We will NOT update the label map in this task to keep the commit focused; Task 17 (refactor to RequireJafar) will touch that file and we'll add the label there.

- [ ] **Step 7: Commit**

```bash
git add server.cjs
git commit -m "$(cat <<'EOF'
feat(jafar): enumerate USER_LOGIN_EVENTS in purge preview and delete

Add userLoginEvents to createEmptyJafarCounts and query/delete the
table in both the user purge and company wipe flows. Matches the
existing pattern of explicit counts + transactional deletes — no FK
cascade is used for this table.
EOF
)"
```

---

## Task 5: Sync Jafar purge changes to `server-production.js` and `server.js`

**Files:**
- Modify: `server-production.js` (same five edits as Task 4)
- Modify: `server.js` (same five edits as Task 4)

**Context:** Mechanical copy of Task 4 into the other two legacy server files.

- [ ] **Step 1: Apply the Task 4 Step 1 edit (extend `createEmptyJafarCounts`) in `server-production.js`**

```bash
grep -n "createEmptyJafarCounts" server-production.js
```

Navigate to the matching function and add `userLoginEvents: 0` as the last key in the returned object.

- [ ] **Step 2: Apply Task 4 Steps 2-5 in `server-production.js`**

Locate each of `buildJafarUserPreview`, `buildJafarCompanyPreview`, `executeJafarUserPurge`, `executeJafarCompanyPurge`, and apply the matching code blocks from Task 4.

- [ ] **Step 3: Repeat all edits in `server.js`**

Same five edits.

- [ ] **Step 4: Verify sync**

```bash
grep -c "userLoginEvents" server.cjs server-production.js server.js
```

Expected: each file reports `6` (1 in `createEmptyJafarCounts`, 1 in user preview, 1 in company preview, 1 in user delete, 1 in company delete, and 1 as the assignment `counts.userLoginEvents += ...` may match twice — accept either `5` or `6` as long as all three files report the same number).

- [ ] **Step 5: Commit**

```bash
git add server-production.js server.js
git commit -m "$(cat <<'EOF'
chore(sync): mirror Jafar purge USER_LOGIN_EVENTS changes to prod servers
EOF
)"
```

---

## Task 6: Add site analysis cache + range resolver — `server.cjs`

**Files:**
- Modify: `server.cjs` — add a module-level cache `Map` and helper functions near the top of the Jafar section.

**Context:** The cache is process-local. Declaring it at module scope gives it the lifetime of the running server process. TTL is 5 minutes; the `getCachedSiteAnalysis` helper returns `null` for a miss or expired entry.

- [ ] **Step 1: Find a suitable insertion point**

Open `server.cjs` and find the `checkJafarRole` function definition at line 13917. Navigate just below the closing `};` of that function (around line 13948). This is where the other Jafar helpers (`normalizeDeleteCount`, `sqlQuote`, etc.) begin.

- [ ] **Step 2: Insert the site analysis constants, cache, and range resolver**

Add this block immediately before the existing `const normalizeDeleteCount = (value) => {` line:

```js
// ============================================================
// Site Analysis (Jafar-only cross-tenant usage dashboard)
// ============================================================

const SITE_ANALYSIS_RANGE_PRESETS = ['7d', '30d', '90d', '12mo', 'all'];
const SITE_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const siteAnalysisCache = new Map(); // key: range preset -> { data, cachedAt }

const resolveSiteAnalysisRange = (range) => {
    const now = new Date();
    const rangeEnd = new Date(now.getTime());
    rangeEnd.setUTCHours(23, 59, 59, 999);

    let rangeStart;
    if (range === '7d') {
        rangeStart = new Date(now.getTime());
        rangeStart.setUTCDate(rangeStart.getUTCDate() - 6); // last 7 days incl today
    } else if (range === '30d') {
        rangeStart = new Date(now.getTime());
        rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);
    } else if (range === '90d') {
        rangeStart = new Date(now.getTime());
        rangeStart.setUTCDate(rangeStart.getUTCDate() - 89);
    } else if (range === '12mo') {
        rangeStart = new Date(now.getTime());
        rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 12);
    } else if (range === 'all') {
        rangeStart = new Date('1970-01-01T00:00:00.000Z');
    } else {
        throw new Error(`Invalid range preset: ${range}`);
    }
    rangeStart.setUTCHours(0, 0, 0, 0);

    return { rangeStart, rangeEnd };
};

const getCachedSiteAnalysis = (range) => {
    try {
        const entry = siteAnalysisCache.get(range);
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > SITE_ANALYSIS_CACHE_TTL_MS) {
            siteAnalysisCache.delete(range);
            return null;
        }
        return entry.data;
    } catch (err) {
        console.error('[SITE ANALYSIS CACHE] getCached failed:', err);
        return null;
    }
};

const setCachedSiteAnalysis = (range, data) => {
    siteAnalysisCache.set(range, { data, cachedAt: Date.now() });
};

const invalidateSiteAnalysisCache = (range) => {
    siteAnalysisCache.delete(range);
};
```

- [ ] **Step 3: Verify the server still starts**

Run: `bun run server:dev`
Expected: Server starts, no syntax errors. Stop it with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server.cjs
git commit -m "feat(site-analysis): add cache helpers and range resolver to server.cjs"
```

---

## Task 7: Add KPI query function — `server.cjs`

**Files:**
- Modify: `server.cjs` — add `runSiteAnalysisKpiQueries` helper immediately after the cache helpers from Task 6.

**Context:** Single function that runs all 8 KPI queries in parallel via `Promise.all` and returns a flat object matching the `kpis` shape in the spec.

- [ ] **Step 1: Insert the KPI query function**

Immediately after the `invalidateSiteAnalysisCache` function from Task 6, add:

```js
const runSiteAnalysisKpiQueries = async (rangeStart) => {
    const rangeStartIso = rangeStart.toISOString();

    const [
        totalCompaniesRows,
        totalUsersRows,
        recentlyActiveUsersRows,
        totalRequestsRows,
        requestsInRangeRows,
        tasksInRangeRows,
        totalCustomFormTemplatesRows,
        totalAttachmentsRows
    ] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY`),
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM GUARDIAN.USERS WHERE STATUS = 'P'`),
        prisma.$queryRawUnsafe(`
            SELECT COUNT(DISTINCT USER_ID) AS count
            FROM GUARDIAN.USER_LOGIN_EVENTS
            WHERE LOGIN_AT >= '${rangeStartIso}'
        `),
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM GUARDIAN.REQUESTS`),
        prisma.$queryRawUnsafe(`
            SELECT COUNT(*) AS count
            FROM GUARDIAN.REQUESTS
            WHERE CREATE_DATE >= '${rangeStartIso}'
        `),
        prisma.$queryRawUnsafe(`
            SELECT COUNT(*) AS count
            FROM GUARDIAN.TASKS
            WHERE CREATE_DATE >= '${rangeStartIso}'
        `),
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM GUARDIAN.FORMS WHERE COMPANY_ID IS NOT NULL`),
        prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM GUARDIAN.ATTACHMENTS`)
    ]);

    const countOf = (rows) => normalizeDeleteCount(rows?.[0]?.count ?? 0);

    return {
        totalCompanies: countOf(totalCompaniesRows),
        totalUsers: countOf(totalUsersRows),
        recentlyActiveUsers: countOf(recentlyActiveUsersRows),
        totalRequests: countOf(totalRequestsRows),
        requestsInRange: countOf(requestsInRangeRows),
        tasksInRange: countOf(tasksInRangeRows),
        totalCustomFormTemplates: countOf(totalCustomFormTemplatesRows),
        totalAttachments: countOf(totalAttachmentsRows)
    };
};
```

- [ ] **Step 2: Verify the server still starts**

Run: `bun run server:dev`, confirm no syntax errors, stop.

- [ ] **Step 3: Commit**

```bash
git add server.cjs
git commit -m "feat(site-analysis): add KPI query function"
```

---

## Task 8: Add trend query function — `server.cjs`

**Files:**
- Modify: `server.cjs` — add `runSiteAnalysisTrendQueries` immediately after the KPI function from Task 7.

**Context:** Returns two arrays: `activityPerDay` (logins, requests, tasks per day) and `newAccountsPerDay` (new users, new companies per day). Uses `CONVERT(DATE, ...)` to bucket by UTC day and a calendar generator via a recursive CTE so days with zero activity are included as zero rows.

- [ ] **Step 1: Insert the trend query function**

Immediately after `runSiteAnalysisKpiQueries`, add:

```js
const runSiteAnalysisTrendQueries = async (rangeStart, rangeEnd) => {
    const rangeStartIso = rangeStart.toISOString();
    const rangeEndIso = rangeEnd.toISOString();

    // Build a calendar of every day in the range so zero-activity days render as flat-line zero.
    // SQL Server recursive CTE with MAXRECURSION 0 (unlimited) — range='all' (1970→today)
    // generates ~20,000 rows, which would exceed the default 100 limit and a tighter cap like
    // 4000. Unlimited is fine here because the query runs at most once per 5 minutes (cached).
    const calendarSql = `
        WITH DayCalendar AS (
            SELECT CAST('${rangeStartIso}' AS DATE) AS day
            UNION ALL
            SELECT DATEADD(DAY, 1, day) FROM DayCalendar
            WHERE day < CAST('${rangeEndIso}' AS DATE)
        )
        SELECT day FROM DayCalendar OPTION (MAXRECURSION 0)
    `;

    const [
        loginsByDay,
        requestsByDay,
        tasksByDay,
        newUsersByDay,
        newCompaniesByDay,
        calendarRows
    ] = await Promise.all([
        prisma.$queryRawUnsafe(`
            SELECT CONVERT(DATE, LOGIN_AT) AS day, COUNT(*) AS count
            FROM GUARDIAN.USER_LOGIN_EVENTS
            WHERE LOGIN_AT >= '${rangeStartIso}' AND LOGIN_AT <= '${rangeEndIso}'
            GROUP BY CONVERT(DATE, LOGIN_AT)
        `),
        prisma.$queryRawUnsafe(`
            SELECT CONVERT(DATE, CREATE_DATE) AS day, COUNT(*) AS count
            FROM GUARDIAN.REQUESTS
            WHERE CREATE_DATE >= '${rangeStartIso}' AND CREATE_DATE <= '${rangeEndIso}'
            GROUP BY CONVERT(DATE, CREATE_DATE)
        `),
        prisma.$queryRawUnsafe(`
            SELECT CONVERT(DATE, CREATE_DATE) AS day, COUNT(*) AS count
            FROM GUARDIAN.TASKS
            WHERE CREATE_DATE >= '${rangeStartIso}' AND CREATE_DATE <= '${rangeEndIso}'
            GROUP BY CONVERT(DATE, CREATE_DATE)
        `),
        prisma.$queryRawUnsafe(`
            SELECT CONVERT(DATE, CREATE_DATE) AS day, COUNT(*) AS count
            FROM GUARDIAN.USERS
            WHERE CREATE_DATE >= '${rangeStartIso}' AND CREATE_DATE <= '${rangeEndIso}'
            GROUP BY CONVERT(DATE, CREATE_DATE)
        `),
        prisma.$queryRawUnsafe(`
            SELECT CONVERT(DATE, CREATED_AT) AS day, COUNT(*) AS count
            FROM GUARDIAN.COMPANY
            WHERE CREATED_AT >= '${rangeStartIso}' AND CREATED_AT <= '${rangeEndIso}'
            GROUP BY CONVERT(DATE, CREATED_AT)
        `),
        prisma.$queryRawUnsafe(calendarSql)
    ]);

    // Build lookup maps keyed by YYYY-MM-DD (ISO date string).
    const toDateKey = (row) => {
        const value = row.day instanceof Date ? row.day : new Date(row.day);
        return value.toISOString().slice(0, 10);
    };
    const toCount = (row) => normalizeDeleteCount(row.count);

    const loginMap = new Map(loginsByDay.map((row) => [toDateKey(row), toCount(row)]));
    const requestMap = new Map(requestsByDay.map((row) => [toDateKey(row), toCount(row)]));
    const taskMap = new Map(tasksByDay.map((row) => [toDateKey(row), toCount(row)]));
    const newUserMap = new Map(newUsersByDay.map((row) => [toDateKey(row), toCount(row)]));
    const newCompanyMap = new Map(newCompaniesByDay.map((row) => [toDateKey(row), toCount(row)]));

    const activityPerDay = [];
    const newAccountsPerDay = [];

    for (const row of calendarRows) {
        const key = toDateKey(row);
        activityPerDay.push({
            date: key,
            logins: loginMap.get(key) ?? 0,
            requests: requestMap.get(key) ?? 0,
            tasks: taskMap.get(key) ?? 0
        });
        newAccountsPerDay.push({
            date: key,
            newUsers: newUserMap.get(key) ?? 0,
            newCompanies: newCompanyMap.get(key) ?? 0
        });
    }

    return { activityPerDay, newAccountsPerDay };
};
```

- [ ] **Step 2: Verify the server still starts**

Run: `bun run server:dev`, confirm no syntax errors, stop.

- [ ] **Step 3: Commit**

```bash
git add server.cjs
git commit -m "feat(site-analysis): add trend query function with UTC day buckets"
```

---

## Task 9: Add company breakdown query function — `server.cjs`

**Files:**
- Modify: `server.cjs` — add `runSiteAnalysisCompanyQueries` immediately after the trend function from Task 8.

**Context:** Returns an array of companies with all the per-company columns. Uses a single compound SQL query per metric (not one-per-company) for performance. `REQUESTS.COMPANY_ID` is `Decimal` so we `TRY_CONVERT(INT, ...)` to compare. `TASKS` has no `COMPANY_ID` so we JOIN through `REQUESTS`. Custom templates filtered by `COMPANY_ID IS NOT NULL`.

- [ ] **Step 1: Insert the company breakdown query function**

Immediately after `runSiteAnalysisTrendQueries`, add:

```js
const runSiteAnalysisCompanyQueries = async (rangeStart) => {
    const rangeStartIso = rangeStart.toISOString();

    // Pull all companies; LEFT JOIN everything per-company in one shot.
    // Subqueries are simpler to reason about than a giant multi-join here, and
    // the single-digit/hundreds-of-rows scale means the extra passes are cheap.
    const rows = await prisma.$queryRawUnsafe(`
        SELECT
            c.COMPANY_ID AS companyId,
            c.NAME AS companyName,
            c.CREATED_AT AS createdAt,
            (SELECT COUNT(*) FROM GUARDIAN.USERS u WHERE TRY_CONVERT(INT, u.COMPANY_ID) = c.COMPANY_ID AND u.STATUS = 'P') AS totalUsers,
            (
                SELECT COUNT(DISTINCT ule.USER_ID)
                FROM GUARDIAN.USER_LOGIN_EVENTS ule
                INNER JOIN GUARDIAN.USERS u2 ON u2.USER_ID = ule.USER_ID
                WHERE TRY_CONVERT(INT, u2.COMPANY_ID) = c.COMPANY_ID
                  AND ule.LOGIN_AT >= '${rangeStartIso}'
            ) AS activeUsersInRange,
            (SELECT COUNT(*) FROM GUARDIAN.REQUESTS r WHERE TRY_CONVERT(INT, r.COMPANY_ID) = c.COMPANY_ID) AS totalRequests,
            (
                SELECT COUNT(*)
                FROM GUARDIAN.REQUESTS r2
                WHERE TRY_CONVERT(INT, r2.COMPANY_ID) = c.COMPANY_ID
                  AND r2.CREATE_DATE >= '${rangeStartIso}'
            ) AS requestsInRange,
            (
                SELECT COUNT(*)
                FROM GUARDIAN.TASKS t
                INNER JOIN GUARDIAN.REQUESTS rt ON rt.REQUEST_ID = t.REQUEST_ID
                WHERE TRY_CONVERT(INT, rt.COMPANY_ID) = c.COMPANY_ID
            ) AS totalTasks,
            (
                SELECT COUNT(*)
                FROM GUARDIAN.TASKS t2
                INNER JOIN GUARDIAN.REQUESTS rt2 ON rt2.REQUEST_ID = t2.REQUEST_ID
                WHERE TRY_CONVERT(INT, rt2.COMPANY_ID) = c.COMPANY_ID
                  AND t2.CREATE_DATE >= '${rangeStartIso}'
            ) AS tasksInRange,
            (SELECT COUNT(*) FROM GUARDIAN.FORMS f WHERE f.COMPANY_ID = c.COMPANY_ID) AS customFormTemplates,
            (
                SELECT MAX(activity)
                FROM (
                    SELECT MAX(ule3.LOGIN_AT) AS activity
                    FROM GUARDIAN.USER_LOGIN_EVENTS ule3
                    INNER JOIN GUARDIAN.USERS u3 ON u3.USER_ID = ule3.USER_ID
                    WHERE TRY_CONVERT(INT, u3.COMPANY_ID) = c.COMPANY_ID
                    UNION ALL
                    SELECT MAX(r3.CREATE_DATE) AS activity
                    FROM GUARDIAN.REQUESTS r3
                    WHERE TRY_CONVERT(INT, r3.COMPANY_ID) = c.COMPANY_ID
                    UNION ALL
                    SELECT MAX(t3.CREATE_DATE) AS activity
                    FROM GUARDIAN.TASKS t3
                    INNER JOIN GUARDIAN.REQUESTS rt3 ON rt3.REQUEST_ID = t3.REQUEST_ID
                    WHERE TRY_CONVERT(INT, rt3.COMPANY_ID) = c.COMPANY_ID
                ) AS combined
            ) AS lastActivityAt
        FROM GUARDIAN.COMPANY c
        ORDER BY requestsInRange DESC, c.NAME ASC
    `);

    const now = Date.now();
    const companies = rows.map((row) => {
        const createdAt = row.createdAt ? new Date(row.createdAt) : null;
        const accountAgeDays = createdAt
            ? Math.max(0, Math.floor((now - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        return {
            companyId: normalizeDeleteCount(row.companyId),
            companyName: row.companyName || '',
            totalUsers: normalizeDeleteCount(row.totalUsers),
            activeUsersInRange: normalizeDeleteCount(row.activeUsersInRange),
            totalRequests: normalizeDeleteCount(row.totalRequests),
            requestsInRange: normalizeDeleteCount(row.requestsInRange),
            totalTasks: normalizeDeleteCount(row.totalTasks),
            tasksInRange: normalizeDeleteCount(row.tasksInRange),
            customFormTemplates: normalizeDeleteCount(row.customFormTemplates),
            lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : null,
            accountAgeDays,
            percentOfPlatformRequests: 0 // filled in by orchestrator after we know platform total
        };
    });

    // Compute percentOfPlatformRequests using the sum of requestsInRange across all companies.
    const platformRequestsInRange = companies.reduce((sum, c) => sum + c.requestsInRange, 0);
    if (platformRequestsInRange > 0) {
        for (const company of companies) {
            company.percentOfPlatformRequests =
                Math.round((company.requestsInRange / platformRequestsInRange) * 1000) / 10;
        }
    }

    return companies;
};
```

- [ ] **Step 2: Verify the server still starts**

Run: `bun run server:dev`, confirm no syntax errors, stop.

- [ ] **Step 3: Commit**

```bash
git add server.cjs
git commit -m "feat(site-analysis): add company breakdown query function"
```

---

## Task 10: Add orchestrator + HTTP route — `server.cjs`

**Files:**
- Modify: `server.cjs` — add `getSiteAnalysis` orchestrator and the HTTP route handler.

**Context:** The orchestrator is the single entry point. It checks the cache, runs the three query groups in parallel on a miss, assembles the payload, writes the cache, and returns. The HTTP route is thin — validate the `range` param, handle `?refresh=true`, call the orchestrator, send JSON.

- [ ] **Step 1: Insert the orchestrator**

Immediately after `runSiteAnalysisCompanyQueries`, add:

```js
const getSiteAnalysis = async (range, { refresh = false } = {}) => {
    if (!SITE_ANALYSIS_RANGE_PRESETS.includes(range)) {
        const err = new Error(`Invalid range preset: ${range}`);
        err.statusCode = 400;
        throw err;
    }

    if (refresh) invalidateSiteAnalysisCache(range);
    const cached = getCachedSiteAnalysis(range);
    if (cached) {
        return { ...cached, cached: true };
    }

    const { rangeStart, rangeEnd } = resolveSiteAnalysisRange(range);

    const [kpis, trends, companies] = await Promise.all([
        runSiteAnalysisKpiQueries(rangeStart),
        runSiteAnalysisTrendQueries(rangeStart, rangeEnd),
        runSiteAnalysisCompanyQueries(rangeStart)
    ]);

    const payload = {
        range,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        generatedAt: new Date().toISOString(),
        cached: false,
        kpis,
        trends,
        companies
    };

    setCachedSiteAnalysis(range, payload);
    return payload;
};
```

- [ ] **Step 2: Add the HTTP route**

Find the existing Jafar routes section in `server.cjs` starting around line 14427 (`app.get('/api/jafar-admin/users', ...)`). Add the new site-analysis route immediately after the last existing `/api/jafar-admin/*` route (before the workspaces routes at line 14567). The exact insertion point is immediately after the closing `});` of the last purge endpoint (`app.post('/api/jafar-admin/purge/company/:companyId', ...)`):

```js
// Site analysis dashboard — Jafar-only cross-tenant usage metrics
app.get('/api/jafar-admin/site-analysis', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const range = typeof req.query.range === 'string' ? req.query.range : '30d';
        const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

        const payload = await getSiteAnalysis(range, { refresh });
        res.json(payload);
    } catch (error) {
        if (error && error.statusCode === 400) {
            return res.status(400).json({ error: 'Invalid range preset' });
        }
        console.error('❌ [SITE ANALYSIS] Failed to compute site analysis:', error);
        res.status(500).json({ error: 'Failed to compute site analysis' });
    }
});
```

- [ ] **Step 3: Start the dev server and smoke-test the endpoint with curl**

Run: `bun run server:dev`

In a second terminal, log in to get a Jafar JWT:

```bash
JAFAR_TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<jafar-user-email>","password":"<jafar-password>"}' | \
  node -e 'let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>console.log(JSON.parse(d).token))')
echo "$JAFAR_TOKEN"
```

Expected: a long JWT string.

Call the endpoint:

```bash
curl -s "http://localhost:3001/api/jafar-admin/site-analysis?range=30d" \
  -H "Authorization: Bearer $JAFAR_TOKEN" | head -c 500
```

Expected: JSON starting with `{"range":"30d","rangeStart":"...","rangeEnd":"...","generatedAt":"...","cached":false,"kpis":{...`.

- [ ] **Step 4: Verify cache behavior with a second call**

Run the same curl twice in quick succession:

```bash
curl -s "http://localhost:3001/api/jafar-admin/site-analysis?range=30d" \
  -H "Authorization: Bearer $JAFAR_TOKEN" | grep -o '"cached":[^,]*'
```

First call: `"cached":false`. Second call: `"cached":true`.

- [ ] **Step 5: Verify auth rejection**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/jafar-admin/site-analysis?range=30d"
```

Expected: `401`.

- [ ] **Step 6: Verify invalid range rejection**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3001/api/jafar-admin/site-analysis?range=xyz" \
  -H "Authorization: Bearer $JAFAR_TOKEN"
```

Expected: `400`.

- [ ] **Step 7: Commit**

```bash
git add server.cjs
git commit -m "$(cat <<'EOF'
feat(site-analysis): add orchestrator and /api/jafar-admin/site-analysis route

Single GET endpoint accepting ?range=<preset>&refresh=<bool>. Runs
KPI, trend, and company breakdown queries in parallel via Promise.all,
caches the payload for 5 minutes per range, and supports manual
refresh via the refresh query flag. Gated by the existing
getAuthenticatedUserCompany + checkJafarRole middleware chain.
EOF
)"
```

---

## Task 11: Sync site analysis backend to `server-production.js`

**Files:**
- Modify: `server-production.js` — copy all inserts from Tasks 6-10 into the equivalent locations.

**Context:** Mechanical copy. The structure of `server-production.js` mirrors `server.cjs` closely, so the insertion points are analogous.

- [ ] **Step 1: Find the `checkJafarRole` function in `server-production.js`**

```bash
grep -n "checkJafarRole = async" server-production.js
```

- [ ] **Step 2: Insert the Task 6 block (constants + cache helpers + resolveRange)**

Place immediately after the `checkJafarRole` function closing `};`, before the next helper. Copy the entire block from Task 6 Step 2.

- [ ] **Step 3: Insert the Task 7 block (`runSiteAnalysisKpiQueries`)**

Immediately after the Task 6 block. Copy verbatim from Task 7 Step 1.

- [ ] **Step 4: Insert the Task 8 block (`runSiteAnalysisTrendQueries`)**

Immediately after the Task 7 block. Copy verbatim from Task 8 Step 1.

- [ ] **Step 5: Insert the Task 9 block (`runSiteAnalysisCompanyQueries`)**

Immediately after the Task 8 block. Copy verbatim from Task 9 Step 1.

- [ ] **Step 6: Insert the Task 10 block (`getSiteAnalysis` orchestrator)**

Immediately after the Task 9 block. Copy verbatim from Task 10 Step 1.

- [ ] **Step 7: Insert the Task 10 HTTP route**

Find the existing `app.get('/api/jafar-admin/users', ...)` in `server-production.js`:

```bash
grep -n "/api/jafar-admin" server-production.js
```

Insert the new route (from Task 10 Step 2) immediately after the last `/api/jafar-admin/*` route.

- [ ] **Step 8: Verify**

```bash
grep -c "getSiteAnalysis" server.cjs server-production.js
```

Expected: both files report the same count (probably `2` — one definition + one invocation in the route).

- [ ] **Step 9: Commit**

```bash
git add server-production.js
git commit -m "chore(sync): mirror site analysis backend into server-production.js"
```

---

## Task 12: Sync site analysis backend to `server.js`

**Files:**
- Modify: `server.js` — same copy as Task 11.

- [ ] **Step 1: Apply the same 7 inserts in `server.js`**

Follow Task 11 Steps 1-7, using `server.js` instead of `server-production.js`.

- [ ] **Step 2: Verify all three files agree**

```bash
grep -c "getSiteAnalysis" server.cjs server-production.js server.js
```

Expected: all three report the same count.

```bash
grep -c "app.get('/api/jafar-admin/site-analysis'" server.cjs server-production.js server.js
```

Expected: all three report `1`.

- [ ] **Step 3: Verify the route works when the production server file is run**

Stop any running `server:dev`. Run the production-style script:

```bash
bun run server:prod-test
```

Expected: server starts on port 3001, logs DB connection success. Hit the endpoint with curl (re-login first to get a fresh token, then repeat Task 10 Step 3's curl commands). Expected output matches Task 10 Step 3.

Stop the server and restore `package.json` (the `server:prod-test` script does this automatically on exit).

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "chore(sync): mirror site analysis backend into server.js"
```

---

## Task 13: Site analysis smoke test script

**Files:**
- Create: `src/tests/site-analysis.smoke.test.ts`

**Context:** Standalone ts-node script that logs in, calls the endpoint with various params, and asserts the payload shape. Matches the convention of existing `src/tests/*.test.ts` scripts (load env, call APIs, log pass/fail, `process.exit(1)` on failure).

- [ ] **Step 1: Create the smoke test file**

Create `src/tests/site-analysis.smoke.test.ts` with this content:

```ts
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
```

- [ ] **Step 2: Run the smoke test against the running dev server**

Make sure `bun run server:dev` is running in another terminal. Then run:

```bash
TEST_JAFAR_EMAIL="<jafar-user-email>" \
TEST_JAFAR_PASSWORD="<jafar-password>" \
bun src/tests/site-analysis.smoke.test.ts
```

Expected: all assertions log `✅`, final line reads `📈 Results: N passed, 0 failed`, exit code 0.

If any assertion fails, investigate before committing. Common causes:
- Dev server not running → start it
- Wrong credentials → update env vars
- New endpoint returned an unexpected shape → review the orchestrator's payload assembly in Task 10

- [ ] **Step 3: Commit**

```bash
git add src/tests/site-analysis.smoke.test.ts
git commit -m "$(cat <<'EOF'
test: add site analysis smoke test script

Standalone ts-node script following the existing src/tests/*.test.ts
convention. Logs in as a Jafar user, calls the site-analysis endpoint
with happy-path, cache-hit, refresh, invalid-range, and unauthed
scenarios, and exits 1 if any assertion fails.
EOF
)"
```

---

## Task 14: Login tracking smoke test script

**Files:**
- Create: `src/tests/login-tracking.smoke.test.ts`

- [ ] **Step 1: Create the smoke test file**

Create `src/tests/login-tracking.smoke.test.ts`:

```ts
// Login tracking smoke test. Standalone ts-node script.
// Verifies that successful /api/login inserts a USER_LOGIN_EVENTS row
// and that failed logins do not.
//
// Usage:
//   TEST_API_BASE=http://localhost:3001 \
//   TEST_JAFAR_EMAIL=<email> \
//   TEST_JAFAR_PASSWORD=<password> \
//   bun src/tests/login-tracking.smoke.test.ts

import { config as dotenvConfig } from 'dotenv';
import { resolve as pathResolve } from 'path';
import { PrismaClient } from '@prisma/client';

dotenvConfig({ path: pathResolve(__dirname, '../../.env') });

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3001';
const EMAIL = process.env.TEST_JAFAR_EMAIL;
const PASSWORD = process.env.TEST_JAFAR_PASSWORD;

if (!EMAIL || !PASSWORD) {
    console.error('❌ TEST_JAFAR_EMAIL and TEST_JAFAR_PASSWORD must be set.');
    process.exit(1);
}

const prisma = new PrismaClient();
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

const countLoginEvents = async (): Promise<number> => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) AS count FROM GUARDIAN.USER_LOGIN_EVENTS
    `;
    const raw = rows[0]?.count ?? 0;
    return typeof raw === 'bigint' ? Number(raw) : Number(raw);
};

const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return { status: res.status, body: res.ok ? await res.json() : null };
};

const main = async () => {
    console.log('📊 Counting USER_LOGIN_EVENTS rows before...');
    const before = await countLoginEvents();
    console.log(`  Initial row count: ${before}`);

    console.log('\n🔐 Successful login...');
    const good = await login(EMAIL, PASSWORD);
    assert('successful login returns 200', good.status === 200, good.status);
    assert('successful login returns token', !!good.body?.token);

    // Wait a beat for the fire-and-forget insert to land.
    await new Promise((r) => setTimeout(r, 500));

    const afterGood = await countLoginEvents();
    assert('row count incremented by exactly 1',
        afterGood === before + 1,
        `before=${before}, after=${afterGood}`);

    console.log('\n🚫 Failed login...');
    const bad = await login(EMAIL, 'definitely-wrong-password-xyz-12345');
    assert('failed login returns 401', bad.status === 401, bad.status);

    await new Promise((r) => setTimeout(r, 500));

    const afterBad = await countLoginEvents();
    assert('row count unchanged after failed login',
        afterBad === afterGood,
        `expected=${afterGood}, actual=${afterBad}`);

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
};

main().catch(async (err) => {
    console.error('💥 Smoke test crashed:', err);
    await prisma.$disconnect();
    process.exit(1);
});
```

- [ ] **Step 2: Run the smoke test**

With the dev server still running:

```bash
TEST_JAFAR_EMAIL="<email>" \
TEST_JAFAR_PASSWORD="<password>" \
bun src/tests/login-tracking.smoke.test.ts
```

Expected: all assertions pass, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/tests/login-tracking.smoke.test.ts
git commit -m "test: add login tracking smoke test script"
```

---

## Task 15: Create the `RequireJafar` guard component

**Files:**
- Create: `src/components/RequireJafar.tsx`

**Context:** Reusable route guard that checks if the current user has role ID 6. Extracted from the inline check at `src/pages/JafarAdministration.tsx:78-80` and the `isJafarUser` helper in `src/pages/AdminDashboard.tsx:37-51`. Uses the existing `useAuth` hook.

- [ ] **Step 1: Create the guard component**

Create `src/components/RequireJafar.tsx`:

```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireJafarProps {
    children: React.ReactNode;
}

/**
 * Route guard that restricts access to users with Jafar role (role ID 6).
 * Non-Jafar users are redirected to /home. Use this to wrap routes that
 * should only be visible to platform administrators.
 *
 * Example:
 *   <Route path="/jafar/site-analysis" element={
 *     <RequireJafar><SiteAnalysis /></RequireJafar>
 *   } />
 */
const RequireJafar: React.FC<RequireJafarProps> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="container py-4">Loading...</div>;
    }

    const isJafar =
        !!user &&
        (
            (Array.isArray((user as any).roles) && (user as any).roles.some((role: any) => role.id === 6)) ||
            (user as any).role === '6'
        );

    if (!isJafar) {
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};

export default RequireJafar;
```

- [ ] **Step 2: Type-check the file**

Run:

```bash
bunx tsc --noEmit src/components/RequireJafar.tsx 2>&1 | head -20
```

Expected: no errors (ignoring typical project-wide noise from other files not passed in). If there are errors specific to `RequireJafar.tsx`, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add src/components/RequireJafar.tsx
git commit -m "feat(auth): add RequireJafar route guard component"
```

---

## Task 16: Refactor `JafarAdministration` to use `RequireJafar`

**Files:**
- Modify: `src/pages/JafarAdministration.tsx:78-80` and around line 235

**Context:** The existing `JafarAdministration` page checks `isJafar` inline at lines 78-80 and renders a "JAFAR access required" alert at line 235 if not. We keep that behavior as defense-in-depth but the component should no longer be responsible for it when mounted as a route — `RequireJafar` handles that. We also take this opportunity to add `userLoginEvents` to the preview count label map (deferred from Task 4 Step 6).

- [ ] **Step 1: Add `userLoginEvents` to `countLabelMap`**

Find `src/pages/JafarAdministration.tsx:33`:

```ts
const countLabelMap: Record<string, string> = {
    userRoles: 'User Roles',
    userWorkspaces: 'User Workspace Links',
```

Add a new entry at the end of the object (just before the closing `};` around line 54):

```ts
    users: 'Users',
    company: 'Company',
    userLoginEvents: 'Login Events'
}
```

- [ ] **Step 2: Verify the page still works**

The inline `isJafar` check at lines 78-80 is harmless duplication now that `RequireJafar` will wrap the route in Task 24. Leave the inline check in place — it's defense-in-depth and removing it risks exposing data if a future change misroutes the component. **Do not delete the inline check.** Only the label map entry is changing in this task.

- [ ] **Step 3: Commit**

```bash
git add src/pages/JafarAdministration.tsx
git commit -m "feat(jafar): add Login Events label to purge preview counts"
```

---

## Task 17: Create site analysis TypeScript types

**Files:**
- Create: `src/components/SiteAnalysis/types.ts`

- [ ] **Step 1: Create the directory and types file**

Create `src/components/SiteAnalysis/types.ts`:

```ts
// Shared types for the site analysis dashboard payload.
// Mirrors the shape returned by GET /api/jafar-admin/site-analysis.

export type SiteAnalysisRange = '7d' | '30d' | '90d' | '12mo' | 'all';

export interface SiteAnalysisKpis {
    totalCompanies: number;
    totalUsers: number;
    recentlyActiveUsers: number;
    totalRequests: number;
    requestsInRange: number;
    tasksInRange: number;
    totalCustomFormTemplates: number;
    totalAttachments: number;
}

export interface ActivityDayBucket {
    date: string;           // YYYY-MM-DD (UTC day)
    logins: number;
    requests: number;
    tasks: number;
}

export interface NewAccountsDayBucket {
    date: string;           // YYYY-MM-DD (UTC day)
    newUsers: number;
    newCompanies: number;
}

export interface SiteAnalysisTrends {
    activityPerDay: ActivityDayBucket[];
    newAccountsPerDay: NewAccountsDayBucket[];
}

export interface SiteAnalysisCompanyRow {
    companyId: number;
    companyName: string;
    totalUsers: number;
    activeUsersInRange: number;
    totalRequests: number;
    requestsInRange: number;
    totalTasks: number;
    tasksInRange: number;
    customFormTemplates: number;
    lastActivityAt: string | null;
    accountAgeDays: number;
    percentOfPlatformRequests: number;
}

export interface SiteAnalysisPayload {
    range: SiteAnalysisRange;
    rangeStart: string;     // ISO 8601 UTC
    rangeEnd: string;       // ISO 8601 UTC
    generatedAt: string;    // ISO 8601 UTC
    cached: boolean;
    kpis: SiteAnalysisKpis;
    trends: SiteAnalysisTrends;
    companies: SiteAnalysisCompanyRow[];
}

export const SITE_ANALYSIS_RANGE_OPTIONS: Array<{ value: SiteAnalysisRange; label: string }> = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '12mo', label: 'Last 12 months' },
    { value: 'all', label: 'All time' }
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/types.ts
git commit -m "feat(site-analysis): add shared TypeScript types"
```

---

## Task 18: Create `SiteAnalysisHeader` component

**Files:**
- Create: `src/components/SiteAnalysis/SiteAnalysisHeader.tsx`

**Context:** Title, range selector buttons, refresh button, and "updated X ago" display. Uses Bootstrap classes consistent with the rest of the app.

- [ ] **Step 1: Create the component**

Create `src/components/SiteAnalysis/SiteAnalysisHeader.tsx`:

```tsx
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SITE_ANALYSIS_RANGE_OPTIONS, type SiteAnalysisRange } from './types';

interface SiteAnalysisHeaderProps {
    range: SiteAnalysisRange;
    onRangeChange: (range: SiteAnalysisRange) => void;
    onRefresh: () => void;
    loading: boolean;
    generatedAt: string | null;
    cached: boolean;
}

const formatRelative = (iso: string): string => {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
};

const SiteAnalysisHeader: React.FC<SiteAnalysisHeaderProps> = ({
    range,
    onRangeChange,
    onRefresh,
    loading,
    generatedAt,
    cached
}) => {
    return (
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
            <div>
                <h2 className="fw-bold mb-1">Site Analysis</h2>
                <p className="text-muted mb-0">
                    Cross-company platform usage metrics.{' '}
                    {generatedAt && (
                        <span className="small">
                            Updated {formatRelative(generatedAt)}{cached ? ' (cached)' : ''} ·{' '}
                            <span title="Day buckets use UTC; events near local midnight may appear on the adjacent day.">
                                times shown in your local timezone
                            </span>
                        </span>
                    )}
                </p>
            </div>
            <div className="d-flex gap-2 flex-wrap align-items-center">
                <div className="btn-group" role="group" aria-label="Date range">
                    {SITE_ANALYSIS_RANGE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`btn btn-sm ${range === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => onRangeChange(option.value)}
                            disabled={loading}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Bypass cache and re-fetch fresh data"
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    Refresh
                </button>
            </div>
        </div>
    );
};

export default SiteAnalysisHeader;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisHeader.tsx
git commit -m "feat(site-analysis): add header with range selector and refresh button"
```

---

## Task 19: Create `SiteAnalysisKpiCards` component

**Files:**
- Create: `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx`:

```tsx
import React from 'react';
import type { SiteAnalysisKpis } from './types';

interface SiteAnalysisKpiCardsProps {
    kpis: SiteAnalysisKpis;
}

interface TileProps {
    label: string;
    value: string;
    hint?: string;
}

const Tile: React.FC<TileProps> = ({ label, value, hint }) => (
    <div className="col-12 col-sm-6 col-lg-3">
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <div className="small text-muted text-uppercase">{label}</div>
            <div className="fs-3 fw-bold">{value}</div>
            {hint && <div className="small text-muted">{hint}</div>}
        </div>
    </div>
);

const formatNumber = (n: number) => n.toLocaleString();

const SiteAnalysisKpiCards: React.FC<SiteAnalysisKpiCardsProps> = ({ kpis }) => {
    return (
        <div className="row g-3 mb-4">
            <Tile label="Total Companies" value={formatNumber(kpis.totalCompanies)} />
            <Tile label="Total Users" value={formatNumber(kpis.totalUsers)} />
            <Tile
                label="Recently Active Users"
                value={formatNumber(kpis.recentlyActiveUsers)}
                hint="with a login in the selected range"
            />
            <Tile
                label="Total Requests"
                value={formatNumber(kpis.totalRequests)}
                hint="all-time"
            />
            <Tile label="Requests in Range" value={formatNumber(kpis.requestsInRange)} />
            <Tile label="Tasks in Range" value={formatNumber(kpis.tasksInRange)} />
            <Tile
                label="Custom Form Templates"
                value={formatNumber(kpis.totalCustomFormTemplates)}
                hint="excludes global templates"
            />
            <Tile label="Attachments" value={formatNumber(kpis.totalAttachments)} />
        </div>
    );
};

export default SiteAnalysisKpiCards;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx
git commit -m "feat(site-analysis): add KPI cards grid component"
```

---

## Task 20: Create `SiteAnalysisActivityChart` component

**Files:**
- Create: `src/components/SiteAnalysis/SiteAnalysisActivityChart.tsx`

**Context:** Recharts `LineChart` with three lines (logins, requests, tasks). X-axis shows local date from the UTC day bucket.

- [ ] **Step 1: Create the component**

Create `src/components/SiteAnalysis/SiteAnalysisActivityChart.tsx`:

```tsx
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { ActivityDayBucket } from './types';

interface SiteAnalysisActivityChartProps {
    data: ActivityDayBucket[];
}

const formatLocalDate = (isoDay: string) => {
    // isoDay is "YYYY-MM-DD". new Date("YYYY-MM-DD") parses as UTC midnight.
    const d = new Date(`${isoDay}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const SiteAnalysisActivityChart: React.FC<SiteAnalysisActivityChartProps> = ({ data }) => {
    const chartData = data.map((d) => ({
        ...d,
        label: formatLocalDate(d.date)
    }));

    return (
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <h5 className="mb-3">Platform Activity</h5>
            <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="logins" stroke="#0d6efd" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="requests" stroke="#198754" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="tasks" stroke="#fd7e14" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SiteAnalysisActivityChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisActivityChart.tsx
git commit -m "feat(site-analysis): add platform activity trend chart"
```

---

## Task 21: Create `SiteAnalysisNewAccountsChart` component

**Files:**
- Create: `src/components/SiteAnalysis/SiteAnalysisNewAccountsChart.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SiteAnalysis/SiteAnalysisNewAccountsChart.tsx`:

```tsx
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { NewAccountsDayBucket } from './types';

interface SiteAnalysisNewAccountsChartProps {
    data: NewAccountsDayBucket[];
}

const formatLocalDate = (isoDay: string) => {
    const d = new Date(`${isoDay}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const SiteAnalysisNewAccountsChart: React.FC<SiteAnalysisNewAccountsChartProps> = ({ data }) => {
    const chartData = data.map((d) => ({
        ...d,
        label: formatLocalDate(d.date)
    }));

    return (
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <h5 className="mb-3">New Accounts</h5>
            <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="newUsers" stroke="#6610f2" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="newCompanies" stroke="#d63384" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SiteAnalysisNewAccountsChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisNewAccountsChart.tsx
git commit -m "feat(site-analysis): add new accounts trend chart"
```

---

## Task 22: Create `SiteAnalysisCompanyTable` component

**Files:**
- Create: `src/components/SiteAnalysis/SiteAnalysisCompanyTable.tsx`

**Context:** AG Grid Community company breakdown table with sortable columns. Uses `ag-grid-react` which is already installed. Follow the existing pattern from `src/components/TaskTable.tsx` for grid setup conventions if unsure.

- [ ] **Step 1: Create the component**

Create `src/components/SiteAnalysis/SiteAnalysisCompanyTable.tsx`:

```tsx
import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { SiteAnalysisCompanyRow } from './types';

interface SiteAnalysisCompanyTableProps {
    companies: SiteAnalysisCompanyRow[];
}

const formatRelative = (iso: string | null): string => {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    return `${Math.floor(diffMo / 12)}y ago`;
};

const formatInt = (n: number) => n.toLocaleString();

const SiteAnalysisCompanyTable: React.FC<SiteAnalysisCompanyTableProps> = ({ companies }) => {
    const columnDefs = useMemo<ColDef<SiteAnalysisCompanyRow>[]>(() => [
        {
            headerName: 'Company',
            field: 'companyName',
            sortable: true,
            filter: true,
            flex: 2,
            minWidth: 180
        },
        {
            headerName: 'Users (active / total)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.activeUsersInRange ?? 0)} / ${formatInt(params.data?.totalUsers ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.activeUsersInRange ?? 0) - (nodeB.data?.activeUsersInRange ?? 0),
            flex: 1,
            minWidth: 140
        },
        {
            headerName: 'Requests (range / all)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.requestsInRange ?? 0)} / ${formatInt(params.data?.totalRequests ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.requestsInRange ?? 0) - (nodeB.data?.requestsInRange ?? 0),
            sort: 'desc',
            flex: 1,
            minWidth: 150
        },
        {
            headerName: 'Tasks (range / all)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.tasksInRange ?? 0)} / ${formatInt(params.data?.totalTasks ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.tasksInRange ?? 0) - (nodeB.data?.tasksInRange ?? 0),
            flex: 1,
            minWidth: 140
        },
        {
            headerName: 'Templates',
            field: 'customFormTemplates',
            sortable: true,
            valueFormatter: (p) => formatInt(p.value ?? 0),
            flex: 1,
            minWidth: 100
        },
        {
            headerName: 'Last Activity',
            field: 'lastActivityAt',
            sortable: true,
            valueFormatter: (p) => formatRelative(p.value),
            comparator: (a, b) => {
                const ta = a ? new Date(a).getTime() : 0;
                const tb = b ? new Date(b).getTime() : 0;
                return ta - tb;
            },
            flex: 1,
            minWidth: 130
        },
        {
            headerName: 'Account Age',
            field: 'accountAgeDays',
            sortable: true,
            valueFormatter: (p) => `${formatInt(p.value ?? 0)}d`,
            flex: 1,
            minWidth: 110
        },
        {
            headerName: '% Platform Requests',
            field: 'percentOfPlatformRequests',
            sortable: true,
            valueFormatter: (p) => `${(p.value ?? 0).toFixed(1)}%`,
            flex: 1,
            minWidth: 130
        }
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        suppressMovable: true
    }), []);

    return (
        <div className="bg-white border rounded p-3 shadow-sm">
            <h5 className="mb-3">Company Breakdown</h5>
            {companies.length === 0 ? (
                <div className="text-muted">No companies yet.</div>
            ) : (
                <div className="ag-theme-alpine" style={{ width: '100%', height: 500 }}>
                    <AgGridReact<SiteAnalysisCompanyRow>
                        rowData={companies}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        animateRows
                        rowHeight={40}
                    />
                </div>
            )}
        </div>
    );
};

export default SiteAnalysisCompanyTable;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisCompanyTable.tsx
git commit -m "feat(site-analysis): add company breakdown AG Grid table"
```

---

## Task 23: Create `SiteAnalysis` page component

**Files:**
- Create: `src/pages/SiteAnalysis.tsx`

**Context:** Top-level page that owns state, fetches the payload, and renders the header, KPI cards, two charts, and the company table. Uses `AbortController` to cancel in-flight fetches when the range changes mid-request.

- [ ] **Step 1: Create the page**

Create `src/pages/SiteAnalysis.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import SiteAnalysisHeader from '../components/SiteAnalysis/SiteAnalysisHeader';
import SiteAnalysisKpiCards from '../components/SiteAnalysis/SiteAnalysisKpiCards';
import SiteAnalysisActivityChart from '../components/SiteAnalysis/SiteAnalysisActivityChart';
import SiteAnalysisNewAccountsChart from '../components/SiteAnalysis/SiteAnalysisNewAccountsChart';
import SiteAnalysisCompanyTable from '../components/SiteAnalysis/SiteAnalysisCompanyTable';
import type { SiteAnalysisPayload, SiteAnalysisRange } from '../components/SiteAnalysis/types';

const SiteAnalysis: React.FC = () => {
    const [range, setRange] = useState<SiteAnalysisRange>('30d');
    const [data, setData] = useState<SiteAnalysisPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (nextRange: SiteAnalysisRange, refresh = false) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const params: Record<string, string> = { range: nextRange };
            if (refresh) params.refresh = 'true';
            const response = await api.get<SiteAnalysisPayload>('/api/jafar-admin/site-analysis', {
                params,
                signal: controller.signal
            });
            if (!controller.signal.aborted) {
                setData(response.data);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) return;
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load site analysis';
            setError(message);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void fetchData(range);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [range, fetchData]);

    const handleRefresh = () => {
        void fetchData(range, true);
    };

    return (
        <div className="container-fluid py-4">
            <SiteAnalysisHeader
                range={range}
                onRangeChange={setRange}
                onRefresh={handleRefresh}
                loading={loading}
                generatedAt={data?.generatedAt ?? null}
                cached={data?.cached ?? false}
            />

            {error && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Failed to load:</strong> {error}
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={handleRefresh}
                    >
                        Retry
                    </button>
                </div>
            )}

            {loading && !data && (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {data && (
                <>
                    <SiteAnalysisKpiCards kpis={data.kpis} />
                    <div className="row g-3 mb-4">
                        <div className="col-12 col-lg-8">
                            <SiteAnalysisActivityChart data={data.trends.activityPerDay} />
                        </div>
                        <div className="col-12 col-lg-4">
                            <SiteAnalysisNewAccountsChart data={data.trends.newAccountsPerDay} />
                        </div>
                    </div>
                    <SiteAnalysisCompanyTable companies={data.companies} />
                </>
            )}
        </div>
    );
};

export default SiteAnalysis;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SiteAnalysis.tsx
git commit -m "feat(site-analysis): add top-level SiteAnalysis page component"
```

---

## Task 24: Add `/jafar/site-analysis` route to `App.tsx`

**Files:**
- Modify: `src/App.tsx` — add import and route.

- [ ] **Step 1: Add imports**

Find the imports section at the top of `src/App.tsx`. After the `import JafarAdministration from './pages/JafarAdministration';` line (line 33), add:

```tsx
import SiteAnalysis from './pages/SiteAnalysis';
import RequireJafar from './components/RequireJafar';
```

- [ ] **Step 2: Add the route**

Find the existing `/jafar-administration` route at `src/App.tsx:80`:

```tsx
<Route path="/jafar-administration" element={<ProtectedRoute><JafarAdministration /></ProtectedRoute>} />
```

Add the new route immediately after it:

```tsx
<Route path="/jafar-administration" element={<ProtectedRoute><JafarAdministration /></ProtectedRoute>} />
<Route path="/jafar/site-analysis" element={<ProtectedRoute><RequireJafar><SiteAnalysis /></RequireJafar></ProtectedRoute>} />
```

- [ ] **Step 3: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep -E "(App.tsx|SiteAnalysis)" | head -20
```

Expected: no errors from the new lines.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(site-analysis): register /jafar/site-analysis route with RequireJafar guard"
```

---

## Task 25: Add "Site Analysis" tile to `AdminDashboard`

**Files:**
- Modify: `src/pages/AdminDashboard.tsx` — add tile after the existing "JAFAR Hard Delete" tile and add a new callback prop.

- [ ] **Step 1: Add the new callback prop**

Find line 20:

```tsx
const AdminDashboard: React.FC<{ onShowUserManagement?: () => void; onShowJafarAdministration?: () => void }> = ({ onShowUserManagement, onShowJafarAdministration }) => {
```

Replace with:

```tsx
const AdminDashboard: React.FC<{
  onShowUserManagement?: () => void;
  onShowJafarAdministration?: () => void;
  onShowJafarSiteAnalysis?: () => void;
}> = ({ onShowUserManagement, onShowJafarAdministration, onShowJafarSiteAnalysis }) => {
```

- [ ] **Step 2: Add the new tile after the existing "JAFAR Hard Delete" tile**

Find the existing Jafar Hard Delete tile at line 183-206 (ends with `</a>` followed by a blank line and `{/* Style Guide Card - Hidden */}`). Insert a new tile immediately after the closing `</a>` of the Hard Delete tile, before the Style Guide comment:

```tsx
        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-primary"
            style={{
              borderRadius: '6px',
              backgroundColor: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              onShowJafarSiteAnalysis && onShowJafarSiteAnalysis();
            }}
          >
            <FaChartBar className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Site Analysis</h3>
            <ul className="text-gray-600">
              <li>Cross-company usage metrics</li>
              <li>Platform activity trends</li>
              <li>Company breakdown</li>
            </ul>
          </a>
        )}
```

- [ ] **Step 3: Add `FaChartBar` to the imports**

Find line 4:

```tsx
import { FaUsers, FaCog, FaPalette, FaProjectDiagram } from 'react-icons/fa';
```

Replace with:

```tsx
import { FaUsers, FaCog, FaPalette, FaProjectDiagram, FaChartBar } from 'react-icons/fa';
```

- [ ] **Step 4: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "AdminDashboard.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(site-analysis): add Site Analysis tile to AdminDashboard"
```

---

## Task 26: Wire the Site Analysis section into `Home.tsx`

**Files:**
- Modify: `src/pages/Home.tsx` — add import, callback wiring, and section branch.

**Context:** The `Home.tsx` page uses a `selectedSection` state to decide which sub-page to render inline. The existing `jafarAdministration` branch at line 1885-1889 shows the pattern. We add a parallel `jafarSiteAnalysis` branch.

- [ ] **Step 1: Add the `SiteAnalysis` import**

Find the existing import of `JafarAdministration` at `src/pages/Home.tsx:31`:

```tsx
import JafarAdministration from './JafarAdministration';
```

Add immediately after:

```tsx
import SiteAnalysis from './SiteAnalysis';
```

- [ ] **Step 2: Wire the callback from `AdminDashboard`**

Find the `<AdminDashboard ...>` invocation around `src/pages/Home.tsx:1877`:

```tsx
<AdminDashboard
    onShowUserManagement={() => setSelectedSection('adminUserManagement')}
    onShowJafarAdministration={() => setSelectedSection('jafarAdministration')}
/>
```

Add the third callback:

```tsx
<AdminDashboard
    onShowUserManagement={() => setSelectedSection('adminUserManagement')}
    onShowJafarAdministration={() => setSelectedSection('jafarAdministration')}
    onShowJafarSiteAnalysis={() => setSelectedSection('jafarSiteAnalysis')}
/>
```

- [ ] **Step 3: Add the `jafarSiteAnalysis` section branch**

Find the existing `jafarAdministration` branch at `src/pages/Home.tsx:1885-1889`:

```tsx
{selectedSection === 'jafarAdministration' && (
    <div className="mt-4 md:mt-6 mb-6">
        <JafarAdministration />
    </div>
)}
```

Add a parallel branch immediately after:

```tsx
{selectedSection === 'jafarSiteAnalysis' && (
    <div className="mt-4 md:mt-6 mb-6">
        <SiteAnalysis />
    </div>
)}
```

- [ ] **Step 4: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "Home.tsx" | head -20
```

Expected: no errors related to the new lines.

- [ ] **Step 5: Visual check in the browser**

Run the frontend: `bun run dev` (in one terminal) and the backend: `bun run server:dev` (in another).

Open http://localhost:5175, log in as a Jafar user, navigate to the admin dashboard, click the new "Site Analysis" tile. The dashboard should render with real data within a couple of seconds. Toggle the range buttons and watch the data update.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat(site-analysis): wire Site Analysis section into Home page"
```

---

## Task 27: Final manual verification against the spec checklist

**Files:**
- No file changes. Walk through the manual verification checklist from the spec (`docs/superpowers/specs/2026-04-08-site-analysis-design.md` under "Testing plan" → "Manual verification checklist").

- [ ] **Step 1: Re-run both smoke tests end-to-end**

With both `bun run server:dev` and `bun run dev` running:

```bash
TEST_JAFAR_EMAIL="<email>" TEST_JAFAR_PASSWORD="<password>" bun src/tests/site-analysis.smoke.test.ts
TEST_JAFAR_EMAIL="<email>" TEST_JAFAR_PASSWORD="<password>" bun src/tests/login-tracking.smoke.test.ts
```

Expected: both exit 0.

- [ ] **Step 2: Walk the full manual checklist**

Check each of the following against the running app:

- [ ] Log in as Jafar → see new "Site Analysis" tile on AdminDashboard
- [ ] Click tile → dashboard loads within ~2 seconds
- [ ] Toggle through all 5 presets (`7d`, `30d`, `90d`, `12mo`, `all`) → charts + tables update, no crashes
- [ ] Click Refresh → `generatedAt` visibly updates (the "updated X ago" text in the header)
- [ ] Log in as non-Jafar (role 1 admin) → Site Analysis tile is invisible on AdminDashboard
- [ ] While non-Jafar, navigate directly to `/jafar/site-analysis` → redirected to `/home` by `RequireJafar`
- [ ] While non-Jafar, calling the endpoint directly via curl with that user's JWT → 403
- [ ] Create a new request in another browser tab as any user → return to Site Analysis, click Refresh → `requestsInRange` counter increments
- [ ] Log in + log out several times as different users → manually query `SELECT TOP 10 * FROM GUARDIAN.USER_LOGIN_EVENTS ORDER BY EVENT_ID DESC` in the DB → see new rows

- [ ] **Step 3: Fire-and-forget regression test**

Temporarily break the login event INSERT in `server.cjs` — change the table name to `GUARDIAN.USER_LOGIN_EVENTS_BROKEN`. Restart the server. Log in with valid credentials. Expected:
- Login succeeds (HTTP 200, valid token returned)
- Server console logs `[LOGIN TRACK] Failed to record login event: ...`
- The user can still use the app normally

Revert the table name change immediately. Restart the server. Confirm the smoke tests still pass.

- [ ] **Step 4: Run all three server files**

Stop the dev server. Test the production server file:

```bash
bun run server:prod-test
```

Once it starts, re-run the site-analysis smoke test against it. Expected: all assertions pass.

Then manually test `node server.js` (port 3001) the same way.

- [ ] **Step 5: Jafar purge regression test**

Log in as Jafar. Open the existing JAFAR Administration page. Search for a throwaway test user (create one first if needed). Preview the purge. Confirm the preview shows a "Login Events" count line (from the `countLabelMap` update in Task 16). Execute the purge. Confirm the deleted counts include `userLoginEvents`.

Re-query `GUARDIAN.USER_LOGIN_EVENTS` for that user's ID. Expected: zero rows.

- [ ] **Step 6: Final commit (if any manual-test fixes were required)**

If the manual checklist surfaced any bugs that required fixes, commit them now with descriptive messages. If everything passed cleanly, skip this step.

- [ ] **Step 7: Push the branch and open a PR**

```bash
git push -u origin feature/siteAnalysis
```

Open a PR against `main` with a summary referencing `docs/superpowers/specs/2026-04-08-site-analysis-design.md` and `docs/superpowers/plans/2026-04-08-site-analysis.md`.

---

## Self-review checklist (for the plan author)

- [x] **Spec coverage**: Every section of the spec has at least one corresponding task.
  - Overview → Tasks 6-12 (backend) + Tasks 17-26 (frontend)
  - Schema changes → Task 1
  - API contract → Task 10
  - Metrics catalog (KPIs/charts/table) → Tasks 7-9 (backend) + Tasks 19-22 (frontend)
  - Data flow → Task 23 (frontend fetch) + Task 10 (backend orchestrator)
  - Error handling → Task 10 (HTTP errors), Task 23 (frontend error banner), Tasks 2-3 (fire-and-forget)
  - Access control → Tasks 10 + 15 + 24 (3 layers)
  - Testing plan → Tasks 13, 14, 27
  - Login tracking → Tasks 1, 2, 3, 4, 5

- [x] **No placeholders**: No "TBD" / "implement later" / "add appropriate error handling" without code.

- [x] **Type consistency**: `SiteAnalysisPayload` used in types.ts (Task 17) matches the JSON shape assembled by `getSiteAnalysis` in Task 10. Field names (`companies`, `companyId`, `activeUsersInRange`, etc.) are identical in backend and frontend.

- [x] **File paths**: All paths are absolute-from-repo-root and concrete.

- [x] **Commit messages**: Every task ends with a commit. Messages follow the repo's `feat:`/`fix:`/`chore:`/`test:`/`docs:` convention seen in `git log`.
