# Site Analysis KPI Drill-downs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-drill-down behavior to all 8 KPI tiles on the existing Site Analysis dashboard. Each tile click opens a modal containing the underlying records (capped at 500 most recent) for that KPI, scoped to the dashboard's currently selected range.

**Architecture:** One new parameterized backend endpoint `GET /api/jafar-admin/site-analysis/drilldown?type=<kpi>&range=<preset>` handles all 8 drill-downs via a switch statement. A reusable React modal (`KpiDrilldownModal`) renders the result using AG Grid with per-KPI column configs from a static map. Each KPI tile becomes a `<button>` that sets a page-level state to open the modal.

**Tech Stack:** Express (inline routes in three legacy server files), Prisma raw SQL, react-bootstrap Modal, AG Grid Community, React 18 + TypeScript.

---

## Context notes

Read these before starting. They explain decisions that will otherwise look wrong.

1. **Source of truth is `server.cjs`.** All API logic lives inline in the three legacy server files. The `server/` TypeScript tree is not mounted. New routes go inline, then are mirrored to `server-production.js` and `server.js` per the multi-server sync rule in `CLAUDE.md`. (Same as the parent feature plan from 2026-04-08.)

2. **Middleware pattern.** Existing inline Jafar routes use the pair `getAuthenticatedUserCompany, checkJafarRole`. Both helpers live in `server.cjs` (lines ~13917 and earlier). Use this pair for the new route — do NOT use any helpers from the unused `server/` tree.

3. **No test runner.** The project has no Jest/Vitest. Tests in `src/tests/*.test.ts` are standalone ts-node scripts that hit the live dev server, log pass/fail, and `process.exit(1)` on failure. The drill-down test extends the existing `src/tests/site-analysis.smoke.test.ts` rather than creating a new file.

4. **Schema quirks (carry forward from parent plan):**
   - `REQUESTS.COMPANY_ID` is `Decimal(38,0)` — use `TRY_CONVERT(INT, r.COMPANY_ID)` when comparing to `COMPANY.COMPANY_ID`.
   - `TASKS` has no `COMPANY_ID` — JOIN through `REQUESTS` on `REQUEST_ID`.
   - `COMPANY.CREATED_AT` is named `CREATED_AT`, not `CREATE_DATE`.
   - `USERS.STATUS = 'P'` filters to active users.
   - Custom form templates: `FORMS WHERE COMPANY_ID IS NOT NULL`.

5. **AG Grid v33 theming gotcha (hard-won lesson from commit `b268623`):** Do NOT import `ag-grid.css` or `ag-theme-alpine.css` anywhere. The project uses AG Grid v33's default Theming API (themeQuartz). Importing the legacy CSS triggers AG Grid error #239. The new modal's grid uses the same default theme — no CSS imports.

6. **Spec.** The approved spec is at `docs/superpowers/specs/2026-04-09-site-analysis-kpi-drilldowns-design.md`. Every task in this plan maps back to a section in that spec.

7. **Pre-existing in-progress work.** `src/pages/NewRequestModal.tsx` is unstaged in the working tree — leave it alone, do NOT stage or commit it as part of any task.

## File structure

### Files to create

| File | Responsibility |
|---|---|
| `src/components/SiteAnalysis/drilldownColumns.tsx` | Per-KPI AG Grid column config map + small date formatters. 8 entries, one per KPI. |
| `src/components/SiteAnalysis/KpiDrilldownModal.tsx` | Reusable react-bootstrap Modal that fetches and renders one drill-down. Owns its own loading/error/data state. |

### Files to modify

| File | Change |
|---|---|
| `src/components/SiteAnalysis/types.ts` | Add `KpiDrilldownType` (derived from `keyof SiteAnalysisKpis`) and `KpiDrilldownPayload<TRow>` types. |
| `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx` | Convert each `Tile` from `<div>` to `<button>`; add `onTileClick: (type: KpiDrilldownType) => void` prop; pass `kpiType` to each tile so it knows which key to dispatch. |
| `src/pages/SiteAnalysis.tsx` | Add `drilldownType` state; pass `onTileClick={setDrilldownType}` to `<SiteAnalysisKpiCards>`; render `<KpiDrilldownModal type={drilldownType} range={range} onClose={...} />` at the end of the tree. |
| `server.cjs` | Add `SITE_ANALYSIS_KPI_TYPES` constant + `SITE_ANALYSIS_DRILLDOWN_LIMIT` + `runSiteAnalysisDrilldownQueries(type, rangeStart)` helper + new HTTP route `/api/jafar-admin/site-analysis/drilldown`. |
| `server-production.js` | Mirror all `server.cjs` additions. |
| `server.js` | Mirror all `server.cjs` additions. |
| `src/tests/site-analysis.smoke.test.ts` | Extend the existing script with drill-down assertions for all 8 KPI types + 3 error cases. |

---

## Task 1: Add TypeScript types for drill-downs

**Files:**
- Modify: `src/components/SiteAnalysis/types.ts`

**Context:** The new types need to land first because every other frontend file in this plan imports them. Backend code doesn't use TypeScript so this is frontend-only.

- [ ] **Step 1: Open `src/components/SiteAnalysis/types.ts`**

Read the existing file to confirm it contains `SiteAnalysisKpis` and `SiteAnalysisRange`.

- [ ] **Step 2: Append the new types at the end of the file**

Add these lines after the existing `SITE_ANALYSIS_RANGE_OPTIONS` constant (the file's current last declaration):

```ts

// Drill-down types — derived from SiteAnalysisKpis so they stay in sync
// automatically. Adding a new KPI to SiteAnalysisKpis later will surface
// a TypeScript error wherever a switch is missing the new case.

export type KpiDrilldownType = keyof SiteAnalysisKpis;

export interface KpiDrilldownPayload<TRow = Record<string, unknown>> {
    type: KpiDrilldownType;
    range: SiteAnalysisRange;
    rows: TRow[];
    totalCount: number;
    truncated: boolean;
}
```

- [ ] **Step 3: Type-check the file**

Run:

```bash
bunx tsc --noEmit 2>&1 | grep -E "(types\.ts|SiteAnalysis)" | head -20
```

Expected: no errors mentioning `types.ts` or any SiteAnalysis file. (Other unrelated TS errors elsewhere in the project are fine — those existed before this task.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SiteAnalysis/types.ts
git commit -m "feat(site-analysis): add KpiDrilldownType and KpiDrilldownPayload types"
```

---

## Task 2: Add KPI types constant + drill-down query helper to `server.cjs`

**Files:**
- Modify: `server.cjs` — add a constant array near the existing `SITE_ANALYSIS_RANGE_PRESETS` declaration, and add the `runSiteAnalysisDrilldownQueries` helper function immediately after the existing `runSiteAnalysisCompanyQueries`.

**Context:** This is the biggest task in the plan because the helper contains 8 SQL query pairs (one per KPI type). Each pair runs a `SELECT TOP 500` rows query and a `SELECT COUNT(*)` total query in parallel via `Promise.all`. The helper returns `{ rows, totalCount, truncated }`.

The constant `SITE_ANALYSIS_KPI_TYPES` is also added in this task because the route handler (Task 3) needs it for input validation.

### Step 1: Locate the insertion point for the constants

Find `server.cjs` lines around 13959-13965 — you should see:

```js
const SITE_ANALYSIS_RANGE_PRESETS = ['7d', '30d', '90d', '12mo', 'all'];
const SITE_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const siteAnalysisCache = new Map(); // key: range preset -> { data, cachedAt }
```

- [ ] **Step 2: Add the new constants**

Use Edit to replace:

```js
const SITE_ANALYSIS_RANGE_PRESETS = ['7d', '30d', '90d', '12mo', 'all'];
const SITE_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const siteAnalysisCache = new Map(); // key: range preset -> { data, cachedAt }
```

with:

```js
const SITE_ANALYSIS_RANGE_PRESETS = ['7d', '30d', '90d', '12mo', 'all'];
const SITE_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const siteAnalysisCache = new Map(); // key: range preset -> { data, cachedAt }

const SITE_ANALYSIS_KPI_TYPES = [
    'totalCompanies',
    'totalUsers',
    'recentlyActiveUsers',
    'totalRequests',
    'requestsInRange',
    'tasksInRange',
    'totalCustomFormTemplates',
    'totalAttachments'
];
const SITE_ANALYSIS_DRILLDOWN_LIMIT = 500;
```

- [ ] **Step 3: Locate the insertion point for the helper function**

Find the end of `runSiteAnalysisCompanyQueries` in `server.cjs`. Search for `return companies;` followed by `};` followed by a blank line and `const getSiteAnalysis`. The helper goes between `runSiteAnalysisCompanyQueries`'s closing `};` and `getSiteAnalysis`'s opening line.

- [ ] **Step 4: Insert the drill-down helper function**

Use Edit. The `old_string`:

```js
    return companies;
};

const getSiteAnalysis = async (range, { refresh = false } = {}) => {
```

Replace with the same anchor PLUS the new helper inserted between the two:

```js
    return companies;
};

const runSiteAnalysisDrilldownQueries = async (type, rangeStart) => {
    const rangeStartIso = rangeStart.toISOString();
    let rowsSql;
    let countSql;

    switch (type) {
        case 'totalCompanies':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    c.COMPANY_ID,
                    c.NAME,
                    c.CREATED_AT,
                    (SELECT COUNT(*) FROM GUARDIAN.USERS u WHERE TRY_CONVERT(INT, u.COMPANY_ID) = c.COMPANY_ID AND u.STATUS = 'P') AS userCount,
                    (SELECT COUNT(*) FROM GUARDIAN.REQUESTS r WHERE TRY_CONVERT(INT, r.COMPANY_ID) = c.COMPANY_ID) AS requestCount
                FROM GUARDIAN.COMPANY c
                ORDER BY c.CREATED_AT DESC
            `;
            countSql = `SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY`;
            break;

        case 'totalUsers':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    u.USER_ID,
                    u.EMAIL,
                    u.FIRST_NAME,
                    u.LAST_NAME,
                    u.STATUS,
                    u.CREATE_DATE,
                    u.COMPANY_ID,
                    c.NAME AS companyName,
                    (SELECT MAX(LOGIN_AT) FROM GUARDIAN.USER_LOGIN_EVENTS WHERE USER_ID = u.USER_ID) AS lastLoginAt
                FROM GUARDIAN.USERS u
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = u.COMPANY_ID
                WHERE u.STATUS = 'P'
                ORDER BY u.CREATE_DATE DESC
            `;
            countSql = `SELECT COUNT(*) AS count FROM GUARDIAN.USERS WHERE STATUS = 'P'`;
            break;

        case 'recentlyActiveUsers':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    u.USER_ID,
                    u.EMAIL,
                    u.FIRST_NAME,
                    u.LAST_NAME,
                    c.NAME AS companyName,
                    COUNT(ule.EVENT_ID) AS loginCount,
                    MAX(ule.LOGIN_AT) AS lastLoginAt
                FROM GUARDIAN.USER_LOGIN_EVENTS ule
                INNER JOIN GUARDIAN.USERS u ON u.USER_ID = ule.USER_ID
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = u.COMPANY_ID
                WHERE ule.LOGIN_AT >= '${rangeStartIso}'
                GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, c.NAME
                ORDER BY MAX(ule.LOGIN_AT) DESC
            `;
            countSql = `
                SELECT COUNT(DISTINCT USER_ID) AS count
                FROM GUARDIAN.USER_LOGIN_EVENTS
                WHERE LOGIN_AT >= '${rangeStartIso}'
            `;
            break;

        case 'totalRequests':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    r.REQUEST_ID,
                    r.TRACKINGID,
                    r.REQUEST_NAME,
                    r.STATUS,
                    r.CREATE_DATE,
                    r.COMPANY_ID,
                    c.NAME AS companyName,
                    requestor.EMAIL AS requestorEmail
                FROM GUARDIAN.REQUESTS r
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, r.COMPANY_ID)
                LEFT JOIN GUARDIAN.USERS requestor ON requestor.USER_ID = r.REQUESTOR_ID
                ORDER BY r.CREATE_DATE DESC
            `;
            countSql = `SELECT COUNT(*) AS count FROM GUARDIAN.REQUESTS`;
            break;

        case 'requestsInRange':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    r.REQUEST_ID,
                    r.TRACKINGID,
                    r.REQUEST_NAME,
                    r.STATUS,
                    r.CREATE_DATE,
                    r.COMPANY_ID,
                    c.NAME AS companyName,
                    requestor.EMAIL AS requestorEmail
                FROM GUARDIAN.REQUESTS r
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, r.COMPANY_ID)
                LEFT JOIN GUARDIAN.USERS requestor ON requestor.USER_ID = r.REQUESTOR_ID
                WHERE r.CREATE_DATE >= '${rangeStartIso}'
                ORDER BY r.CREATE_DATE DESC
            `;
            countSql = `
                SELECT COUNT(*) AS count
                FROM GUARDIAN.REQUESTS
                WHERE CREATE_DATE >= '${rangeStartIso}'
            `;
            break;

        case 'tasksInRange':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    t.TASK_ID,
                    t.TRACKINGID,
                    t.DESCRIPTION,
                    t.STATUS,
                    t.CREATE_DATE,
                    t.ASSIGNED_USER_ID,
                    assignee.EMAIL AS assigneeEmail,
                    r.REQUEST_NAME,
                    r.TRACKINGID AS requestTrackingId,
                    c.NAME AS companyName
                FROM GUARDIAN.TASKS t
                LEFT JOIN GUARDIAN.USERS assignee ON assignee.USER_ID = t.ASSIGNED_USER_ID
                LEFT JOIN GUARDIAN.REQUESTS r ON r.REQUEST_ID = t.REQUEST_ID
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, r.COMPANY_ID)
                WHERE t.CREATE_DATE >= '${rangeStartIso}'
                ORDER BY t.CREATE_DATE DESC
            `;
            countSql = `
                SELECT COUNT(*) AS count
                FROM GUARDIAN.TASKS
                WHERE CREATE_DATE >= '${rangeStartIso}'
            `;
            break;

        case 'totalCustomFormTemplates':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    f.FORM_ID,
                    f.FORM_NAME,
                    f.FORM_DESCRIPTION,
                    f.COMPANY_ID,
                    c.NAME AS companyName,
                    (SELECT COUNT(*) FROM GUARDIAN.FORMS_FIELDS ff WHERE ff.FORM_ID = f.FORM_ID) AS fieldCount
                FROM GUARDIAN.FORMS f
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = f.COMPANY_ID
                WHERE f.COMPANY_ID IS NOT NULL
                ORDER BY f.FORM_ID DESC
            `;
            countSql = `SELECT COUNT(*) AS count FROM GUARDIAN.FORMS WHERE COMPANY_ID IS NOT NULL`;
            break;

        case 'totalAttachments':
            rowsSql = `
                SELECT TOP ${SITE_ANALYSIS_DRILLDOWN_LIMIT}
                    a.ATTACHMENT_ID,
                    a.FILE_NAME,
                    a.CREATE_DATE,
                    a.REQUEST_ID,
                    r.REQUEST_NAME,
                    c.NAME AS companyName,
                    uploader.EMAIL AS uploaderEmail
                FROM GUARDIAN.ATTACHMENTS a
                LEFT JOIN GUARDIAN.REQUESTS r ON r.REQUEST_ID = a.REQUEST_ID
                LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, r.COMPANY_ID)
                LEFT JOIN GUARDIAN.USERS uploader ON uploader.USER_ID = a.CREATE_USER_ID
                ORDER BY a.CREATE_DATE DESC
            `;
            countSql = `SELECT COUNT(*) AS count FROM GUARDIAN.ATTACHMENTS`;
            break;

        default:
            throw new Error(`Unknown KPI type: ${type}`);
    }

    const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe(rowsSql),
        prisma.$queryRawUnsafe(countSql)
    ]);

    const totalCount = normalizeDeleteCount(countRows?.[0]?.count ?? 0);
    return {
        rows,
        totalCount,
        truncated: totalCount > SITE_ANALYSIS_DRILLDOWN_LIMIT
    };
};

const getSiteAnalysis = async (range, { refresh = false } = {}) => {
```

- [ ] **Step 5: Verify syntax**

```bash
node --check server.cjs && echo "SYNTAX OK"
```

Expected: `SYNTAX OK`.

- [ ] **Step 6: Verify the constants and helper exist**

```bash
grep -c "SITE_ANALYSIS_KPI_TYPES\|SITE_ANALYSIS_DRILLDOWN_LIMIT\|runSiteAnalysisDrilldownQueries" server.cjs
```

Expected: at least `5` (the constants are referenced inside the helper as well as declared).

- [ ] **Step 7: Commit**

```bash
git add server.cjs
git commit -m "$(cat <<'EOF'
feat(site-analysis): add drill-down query helper for all 8 KPI types

Adds SITE_ANALYSIS_KPI_TYPES constant, SITE_ANALYSIS_DRILLDOWN_LIMIT
(500), and runSiteAnalysisDrilldownQueries(type, rangeStart) which
switches on the KPI type and runs paired SELECT TOP 500 rows + COUNT
queries in parallel via Promise.all. Returns { rows, totalCount,
truncated } where truncated is set when totalCount exceeds the cap.

The HTTP route that calls this helper lands in the next commit.
EOF
)"
```

---

## Task 3: Add the drill-down HTTP route to `server.cjs`

**Files:**
- Modify: `server.cjs` — add a new route immediately after the existing `/api/jafar-admin/site-analysis` route.

**Context:** Thin route handler. Validates `type` against `SITE_ANALYSIS_KPI_TYPES`, validates `range` against `SITE_ANALYSIS_RANGE_PRESETS`, calls `resolveSiteAnalysisRange`, then `runSiteAnalysisDrilldownQueries`. Wraps everything in try/catch with sensible status codes.

- [ ] **Step 1: Locate the existing site-analysis route**

Run:

```bash
grep -n "app.get('/api/jafar-admin/site-analysis'" server.cjs
```

Expected: one match (the route added in Task 10 of the parent plan).

- [ ] **Step 2: Find the closing `});` of that route**

Read the file from that line forward (about 20 lines) to find the `});` that closes the existing route handler. The new route goes immediately after that closing line and before the next route (which is `app.get('/api/workspaces', ...)`).

- [ ] **Step 3: Insert the new route**

Use Edit. The `old_string` (anchor on the existing route's closing + the next route's start):

```js
        console.error('❌ [SITE ANALYSIS] Failed to compute site analysis:', error);
        res.status(500).json({ error: 'Failed to compute site analysis' });
    }
});

// GET /api/workspaces - List all workspaces for company (role_id=6 only)
```

Replace with:

```js
        console.error('❌ [SITE ANALYSIS] Failed to compute site analysis:', error);
        res.status(500).json({ error: 'Failed to compute site analysis' });
    }
});

// Site analysis drill-down — list of underlying records for a single KPI tile
app.get('/api/jafar-admin/site-analysis/drilldown', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const type = typeof req.query.type === 'string' ? req.query.type : '';
        const range = typeof req.query.range === 'string' ? req.query.range : '30d';

        if (!SITE_ANALYSIS_KPI_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Invalid KPI type' });
        }
        if (!SITE_ANALYSIS_RANGE_PRESETS.includes(range)) {
            return res.status(400).json({ error: 'Invalid range preset' });
        }

        const { rangeStart } = resolveSiteAnalysisRange(range);
        const payload = await runSiteAnalysisDrilldownQueries(type, rangeStart);
        res.json({ type, range, ...payload });
    } catch (error) {
        console.error('❌ [SITE ANALYSIS DRILLDOWN] Failed:', error);
        res.status(500).json({ error: 'Failed to load drill-down' });
    }
});

// GET /api/workspaces - List all workspaces for company (role_id=6 only)
```

- [ ] **Step 4: Syntax check**

```bash
node --check server.cjs && echo "SYNTAX OK"
```

- [ ] **Step 5: Verify the route exists exactly once**

```bash
grep -c "'/api/jafar-admin/site-analysis/drilldown'" server.cjs
```

Expected: `1`.

- [ ] **Step 6: Smoke test the route via curl (controller will run this manually)**

The implementer SHOULD test this via curl to verify the route works end-to-end before committing. Make sure the dev server is running (`bun run server:dev`), then:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ernest@shieldlytics.com","password":"MDA268RedDragon$"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')

curl -s "http://localhost:3001/api/jafar-admin/site-analysis/drilldown?type=totalRequests&range=30d" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -30
```

Expected: JSON starting with `{"type":"totalRequests","range":"30d","rows":[{...`. If you get an HTML response (SPA fallback) it means the dev server didn't pick up the new route — restart it.

Also test the error cases:

```bash
# Invalid type → 400
curl -s -o /dev/null -w "type=garbage HTTP %{http_code}\n" \
  "http://localhost:3001/api/jafar-admin/site-analysis/drilldown?type=garbage&range=30d" \
  -H "Authorization: Bearer $TOKEN"

# Invalid range → 400
curl -s -o /dev/null -w "range=xyz HTTP %{http_code}\n" \
  "http://localhost:3001/api/jafar-admin/site-analysis/drilldown?type=totalRequests&range=xyz" \
  -H "Authorization: Bearer $TOKEN"

# No auth → 401
curl -s -o /dev/null -w "no auth HTTP %{http_code}\n" \
  "http://localhost:3001/api/jafar-admin/site-analysis/drilldown?type=totalRequests&range=30d"
```

Expected:
```
type=garbage HTTP 400
range=xyz HTTP 400
no auth HTTP 401
```

- [ ] **Step 7: Commit**

```bash
git add server.cjs
git commit -m "$(cat <<'EOF'
feat(site-analysis): add /api/jafar-admin/site-analysis/drilldown route

GET endpoint accepting ?type=<kpi>&range=<preset>. Validates both
inputs against the existing constant arrays, resolves the range to a
rangeStart, calls runSiteAnalysisDrilldownQueries, and returns the
unified { type, range, rows, totalCount, truncated } payload. Gated
by the existing getAuthenticatedUserCompany + checkJafarRole chain.
EOF
)"
```

---

## Task 4: Sync drill-down backend to `server-production.js`

**Files:**
- Modify: `server-production.js` — mirror the constants, helper, and route from Tasks 2 and 3.

**Context:** Pure copy-sync from `server.cjs`. The two files are byte-identical in the site-analysis section, so the same edits apply at the same line numbers (approximately).

- [ ] **Step 1: Add the new constants to `server-production.js`**

Find:

```bash
grep -n "SITE_ANALYSIS_RANGE_PRESETS = " server-production.js
```

Expected: one match. Use the same Edit operation as Task 2 Step 2 to add `SITE_ANALYSIS_KPI_TYPES` and `SITE_ANALYSIS_DRILLDOWN_LIMIT` immediately after the cache declaration.

- [ ] **Step 2: Add the `runSiteAnalysisDrilldownQueries` helper**

Apply the same Edit operation as Task 2 Step 4 — insert the helper between `runSiteAnalysisCompanyQueries` (closing `};`) and `getSiteAnalysis` (opening `const`).

- [ ] **Step 3: Add the HTTP route**

Apply the same Edit operation as Task 3 Step 3 — insert the new route between the existing site-analysis route's closing `});` and the workspaces route's opening comment.

- [ ] **Step 4: Verify syntax and parity**

```bash
node --check server-production.js && echo "SYNTAX OK"
grep -c "runSiteAnalysisDrilldownQueries" server.cjs server-production.js
grep -c "'/api/jafar-admin/site-analysis/drilldown'" server.cjs server-production.js
```

Expected: `SYNTAX OK`, both files report the same count for `runSiteAnalysisDrilldownQueries` (probably 2: one declaration + one call), and both report `1` for the route.

- [ ] **Step 5: Commit**

```bash
git add server-production.js
git commit -m "chore(sync): mirror site analysis drill-down into server-production.js"
```

---

## Task 5: Sync drill-down backend to `server.js`

**Files:**
- Modify: `server.js` — same three edits as Task 4.

- [ ] **Step 1: Apply Task 2's constant addition to `server.js`**

Same Edit operation as Task 2 Step 2.

- [ ] **Step 2: Apply Task 2's helper function to `server.js`**

Same Edit operation as Task 2 Step 4.

- [ ] **Step 3: Apply Task 3's route insertion to `server.js`**

Same Edit operation as Task 3 Step 3.

- [ ] **Step 4: Verify all three files are in sync**

```bash
node --check server.js && echo "SYNTAX OK"
grep -c "runSiteAnalysisDrilldownQueries" server.cjs server-production.js server.js
grep -c "'/api/jafar-admin/site-analysis/drilldown'" server.cjs server-production.js server.js
grep -c "SITE_ANALYSIS_KPI_TYPES" server.cjs server-production.js server.js
```

Expected: all three files agree on every count.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "chore(sync): mirror site analysis drill-down into server.js"
```

---

## Task 6: Create the per-KPI column config map

**Files:**
- Create: `src/components/SiteAnalysis/drilldownColumns.tsx`

**Context:** A static `Record<KpiDrilldownType, DrilldownConfig>` mapping each KPI to its modal title, empty-state message, and AG Grid column definitions. Date formatters live inline at the top of the file.

- [ ] **Step 1: Create the file**

Create `src/components/SiteAnalysis/drilldownColumns.tsx` with this content:

```tsx
import type { ColDef, ValueFormatterParams } from 'ag-grid-community';
import type { KpiDrilldownType } from './types';

interface DrilldownConfig {
    title: string;
    emptyMessage: string;
    columns: ColDef[];
}

const formatDate = (params: ValueFormatterParams) => {
    if (!params.value) return '—';
    try {
        return new Date(params.value).toLocaleString();
    } catch {
        return String(params.value);
    }
};

const formatRelative = (params: ValueFormatterParams): string => {
    if (!params.value) return 'Never';
    let then: number;
    try {
        then = new Date(params.value).getTime();
    } catch {
        return 'Never';
    }
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

const formatStatus = (params: ValueFormatterParams) => {
    const v = params.value;
    if (v === 'A') return 'Active';
    if (v === 'P') return 'Pending';
    if (v === 'I') return 'Inactive';
    if (v === 'C') return 'Completed';
    if (v === 'X') return 'Cancelled';
    return v ?? '—';
};

const formatName = (params: { data?: { FIRST_NAME?: string; LAST_NAME?: string } }) => {
    const first = params.data?.FIRST_NAME ?? '';
    const last = params.data?.LAST_NAME ?? '';
    const full = `${first} ${last}`.trim();
    return full || '—';
};

export const drilldownColumns: Record<KpiDrilldownType, DrilldownConfig> = {
    totalCompanies: {
        title: 'Companies',
        emptyMessage: 'No companies yet.',
        columns: [
            { headerName: 'Company ID', field: 'COMPANY_ID', sortable: true, width: 120 },
            { headerName: 'Name', field: 'NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Created', field: 'CREATED_AT', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 },
            { headerName: 'Users', field: 'userCount', sortable: true, width: 100 },
            { headerName: 'Requests', field: 'requestCount', sortable: true, width: 110 }
        ]
    },
    totalUsers: {
        title: 'Users',
        emptyMessage: 'No users yet.',
        columns: [
            { headerName: 'Email', field: 'EMAIL', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Name', sortable: false, valueGetter: formatName, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 110 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 },
            { headerName: 'Last Login', field: 'lastLoginAt', sortable: true, valueFormatter: formatRelative, flex: 1, minWidth: 130 }
        ]
    },
    recentlyActiveUsers: {
        title: 'Recently Active Users',
        emptyMessage: 'No users have logged in during the selected range.',
        columns: [
            { headerName: 'Email', field: 'EMAIL', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Name', sortable: false, valueGetter: formatName, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Logins', field: 'loginCount', sortable: true, width: 110 },
            { headerName: 'Last Login', field: 'lastLoginAt', sortable: true, valueFormatter: formatRelative, flex: 1, minWidth: 140 }
        ]
    },
    totalRequests: {
        title: 'All Requests',
        emptyMessage: 'No requests yet.',
        columns: [
            { headerName: 'Tracking ID', field: 'TRACKINGID', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Name', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Requestor', field: 'requestorEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    requestsInRange: {
        title: 'Requests in Range',
        emptyMessage: 'No requests created in the selected range.',
        columns: [
            { headerName: 'Tracking ID', field: 'TRACKINGID', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Name', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Requestor', field: 'requestorEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    tasksInRange: {
        title: 'Tasks in Range',
        emptyMessage: 'No tasks created in the selected range.',
        columns: [
            { headerName: 'Tracking ID', field: 'TRACKINGID', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Description', field: 'DESCRIPTION', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Assignee', field: 'assigneeEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Request', field: 'requestTrackingId', sortable: true, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    totalCustomFormTemplates: {
        title: 'Custom Form Templates',
        emptyMessage: 'No custom form templates yet.',
        columns: [
            { headerName: 'Form Name', field: 'FORM_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Description', field: 'FORM_DESCRIPTION', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Fields', field: 'fieldCount', sortable: true, width: 100 },
            { headerName: 'Form ID', field: 'FORM_ID', sortable: true, width: 100 }
        ]
    },
    totalAttachments: {
        title: 'Attachments',
        emptyMessage: 'No attachments yet.',
        columns: [
            { headerName: 'Filename', field: 'FILE_NAME', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Request', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Uploaded By', field: 'uploaderEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    }
};
```

- [ ] **Step 2: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "drilldownColumns" | head -20
```

Expected: no errors mentioning `drilldownColumns.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SiteAnalysis/drilldownColumns.tsx
git commit -m "feat(site-analysis): add per-KPI drill-down column config map"
```

---

## Task 7: Create the `KpiDrilldownModal` component

**Files:**
- Create: `src/components/SiteAnalysis/KpiDrilldownModal.tsx`

**Context:** Reusable react-bootstrap Modal that owns its own fetch state. When the `type` prop is `null` the modal is hidden. When it changes to a non-null value, the modal fetches the drill-down for that type and renders. Aborts in-flight fetches on prop change or unmount.

- [ ] **Step 1: Create the file**

Create `src/components/SiteAnalysis/KpiDrilldownModal.tsx` with this content:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
import { drilldownColumns } from './drilldownColumns';
import type { KpiDrilldownPayload, KpiDrilldownType, SiteAnalysisRange } from './types';

// Note: AG Grid v33 uses the Theming API default theme (themeQuartz). Do NOT
// import ag-grid.css or ag-theme-alpine.css here — see commit b268623 for the
// hard-won lesson about AG Grid error #239.

interface KpiDrilldownModalProps {
    type: KpiDrilldownType | null;
    range: SiteAnalysisRange;
    onClose: () => void;
}

const KpiDrilldownModal: React.FC<KpiDrilldownModalProps> = ({ type, range, onClose }) => {
    const [data, setData] = useState<KpiDrilldownPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (kpiType: KpiDrilldownType, kpiRange: SiteAnalysisRange) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const response = await api.get<KpiDrilldownPayload>('/api/jafar-admin/site-analysis/drilldown', {
                params: { type: kpiType, range: kpiRange },
                signal: controller.signal
            });
            if (!controller.signal.aborted) {
                setData(response.data);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) return;
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load drill-down';
            setError(message);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!type) {
            setData(null);
            setError(null);
            setLoading(false);
            return;
        }
        void fetchData(type, range);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [type, range, fetchData]);

    const handleRetry = () => {
        if (type) void fetchData(type, range);
    };

    const config = type ? drilldownColumns[type] : null;
    const isOpen = type !== null;

    const subtitle = (() => {
        if (loading) return 'Loading...';
        if (error || !data) return null;
        if (data.truncated) {
            return `Showing the most recent ${data.rows.length} of ${data.totalCount.toLocaleString()} total. Narrow the range to see fewer.`;
        }
        return `Showing all ${data.totalCount.toLocaleString()} ${(config?.title ?? '').toLowerCase()}.`;
    })();

    return (
        <Modal show={isOpen} onHide={onClose} size="xl" scrollable centered>
            <Modal.Header closeButton>
                <div>
                    <Modal.Title>{config?.title ?? 'Drill-down'}</Modal.Title>
                    {subtitle && <div className="small text-muted mt-1">{subtitle}</div>}
                </div>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="alert alert-danger d-flex justify-content-between align-items-center mb-0">
                        <div>
                            <strong>Failed to load:</strong> {error}
                        </div>
                        <Button variant="outline-danger" size="sm" onClick={handleRetry}>
                            Retry
                        </Button>
                    </div>
                )}

                {!loading && !error && data && config && data.rows.length === 0 && (
                    <div className="text-muted text-center py-5">{config.emptyMessage}</div>
                )}

                {!loading && !error && data && config && data.rows.length > 0 && (
                    <div style={{ width: '100%', height: 500 }}>
                        <AgGridReact
                            rowData={data.rows}
                            columnDefs={config.columns}
                            defaultColDef={{ resizable: true, suppressMovable: true }}
                            animateRows
                            rowHeight={40}
                        />
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default KpiDrilldownModal;
```

- [ ] **Step 2: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "KpiDrilldownModal" | head -20
```

Expected: no errors mentioning `KpiDrilldownModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SiteAnalysis/KpiDrilldownModal.tsx
git commit -m "feat(site-analysis): add reusable KpiDrilldownModal component"
```

---

## Task 8: Make KPI tiles clickable in `SiteAnalysisKpiCards`

**Files:**
- Modify: `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx`

**Context:** The current `Tile` sub-component is a `<div>`. Convert each tile to a `<button>` so it's keyboard-accessible (focusable, Enter/Space activation), add hover/focus states, and dispatch a `KpiDrilldownType` to a parent-provided `onTileClick` callback.

- [ ] **Step 1: Read the current file**

```bash
cat src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx
```

You should see a `Tile` component (currently a `<div>`) and 8 invocations of it inside `SiteAnalysisKpiCards`.

- [ ] **Step 2: Replace the entire file**

Use Write to replace `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx` with this new version:

```tsx
import React from 'react';
import type { KpiDrilldownType, SiteAnalysisKpis } from './types';

interface SiteAnalysisKpiCardsProps {
    kpis: SiteAnalysisKpis;
    onTileClick?: (type: KpiDrilldownType) => void;
}

interface TileProps {
    kpiType: KpiDrilldownType;
    label: string;
    value: string;
    hint?: string;
    onClick?: (type: KpiDrilldownType) => void;
}

const Tile: React.FC<TileProps> = ({ kpiType, label, value, hint, onClick }) => {
    const handleClick = () => onClick?.(kpiType);

    return (
        <div className="col-12 col-sm-6 col-lg-3">
            <button
                type="button"
                onClick={handleClick}
                className="bg-white border rounded p-3 h-100 shadow-sm w-100 text-start"
                style={{
                    cursor: onClick ? 'pointer' : 'default',
                    transition: 'background-color 120ms, transform 120ms',
                    border: '1px solid var(--bs-border-color)'
                }}
                onMouseEnter={(e) => {
                    if (onClick) e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                    if (onClick) e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                disabled={!onClick}
                aria-label={`View details for ${label}`}
            >
                <div className="small text-muted text-uppercase">{label}</div>
                <div className="fs-3 fw-bold">{value}</div>
                {hint && <div className="small text-muted">{hint}</div>}
            </button>
        </div>
    );
};

const formatNumber = (n: number) => n.toLocaleString();

const SiteAnalysisKpiCards: React.FC<SiteAnalysisKpiCardsProps> = ({ kpis, onTileClick }) => {
    return (
        <div className="row g-3 mb-4">
            <Tile
                kpiType="totalCompanies"
                label="Total Companies"
                value={formatNumber(kpis.totalCompanies)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalUsers"
                label="Total Users"
                value={formatNumber(kpis.totalUsers)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="recentlyActiveUsers"
                label="Recently Active Users"
                value={formatNumber(kpis.recentlyActiveUsers)}
                hint="with a login in the selected range"
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalRequests"
                label="Total Requests"
                value={formatNumber(kpis.totalRequests)}
                hint="all-time"
                onClick={onTileClick}
            />
            <Tile
                kpiType="requestsInRange"
                label="Requests in Range"
                value={formatNumber(kpis.requestsInRange)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="tasksInRange"
                label="Tasks in Range"
                value={formatNumber(kpis.tasksInRange)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalCustomFormTemplates"
                label="Custom Form Templates"
                value={formatNumber(kpis.totalCustomFormTemplates)}
                hint="excludes global templates"
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalAttachments"
                label="Attachments"
                value={formatNumber(kpis.totalAttachments)}
                onClick={onTileClick}
            />
        </div>
    );
};

export default SiteAnalysisKpiCards;
```

- [ ] **Step 3: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "SiteAnalysisKpiCards" | head -20
```

Expected: no errors mentioning `SiteAnalysisKpiCards.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx
git commit -m "feat(site-analysis): make KPI tiles clickable with onTileClick callback"
```

---

## Task 9: Wire the drill-down modal into the SiteAnalysis page

**Files:**
- Modify: `src/pages/SiteAnalysis.tsx`

**Context:** The page-level component owns the `drilldownType` state. The `SiteAnalysisKpiCards` component calls `setDrilldownType` when a tile is clicked. The modal renders at the end of the tree, listening for state changes.

- [ ] **Step 1: Read the current file**

```bash
cat src/pages/SiteAnalysis.tsx
```

Confirm the imports at the top and the JSX structure (header → kpis → charts → table).

- [ ] **Step 2: Add the new imports**

Use Edit. Replace:

```tsx
import SiteAnalysisCompanyTable from '../components/SiteAnalysis/SiteAnalysisCompanyTable';
import type { SiteAnalysisPayload, SiteAnalysisRange } from '../components/SiteAnalysis/types';
```

with:

```tsx
import SiteAnalysisCompanyTable from '../components/SiteAnalysis/SiteAnalysisCompanyTable';
import KpiDrilldownModal from '../components/SiteAnalysis/KpiDrilldownModal';
import type { KpiDrilldownType, SiteAnalysisPayload, SiteAnalysisRange } from '../components/SiteAnalysis/types';
```

- [ ] **Step 3: Add the drilldownType state**

Use Edit. Replace:

```tsx
    const [range, setRange] = useState<SiteAnalysisRange>('30d');
    const [data, setData] = useState<SiteAnalysisPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
```

with:

```tsx
    const [range, setRange] = useState<SiteAnalysisRange>('30d');
    const [data, setData] = useState<SiteAnalysisPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drilldownType, setDrilldownType] = useState<KpiDrilldownType | null>(null);
    const abortRef = useRef<AbortController | null>(null);
```

- [ ] **Step 4: Pass `onTileClick` to the KPI cards**

Use Edit. Replace:

```tsx
                    <SiteAnalysisKpiCards kpis={data.kpis} />
```

with:

```tsx
                    <SiteAnalysisKpiCards kpis={data.kpis} onTileClick={setDrilldownType} />
```

- [ ] **Step 5: Render the modal at the end of the page**

Use Edit. Replace the `data && (...)` block's closing fragment with the same content + the modal. Specifically, replace:

```tsx
                    <SiteAnalysisCompanyTable companies={data.companies} />
                </>
            )}
        </div>
    );
};
```

with:

```tsx
                    <SiteAnalysisCompanyTable companies={data.companies} />
                </>
            )}

            <KpiDrilldownModal
                type={drilldownType}
                range={range}
                onClose={() => setDrilldownType(null)}
            />
        </div>
    );
};
```

Note: the modal is rendered OUTSIDE the `data && (...)` conditional so it can show even if the dashboard is in an error state. (The modal hides itself when `type === null`.)

- [ ] **Step 6: Type-check**

```bash
bunx tsc --noEmit 2>&1 | grep "SiteAnalysis.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 7: Manual verification (controller will do this)**

Confirm the dev server is running, open `http://localhost:5175/jafar/site-analysis`, click each of the 8 tiles, verify each modal opens with the right title and shows real data. Verify Close button works. Verify clicking a different tile while a modal is open swaps the data without flicker. No console errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/SiteAnalysis.tsx
git commit -m "feat(site-analysis): wire KpiDrilldownModal into the dashboard page"
```

---

## Task 10: Extend the smoke test with drill-down assertions

**Files:**
- Modify: `src/tests/site-analysis.smoke.test.ts`

**Context:** Add ~35 new assertions to the existing script: hit the drill-down endpoint with each of the 8 KPI types, plus 3 error cases. Do NOT create a new file — keep all site-analysis smoke tests in one place.

- [ ] **Step 1: Read the current file**

```bash
cat src/tests/site-analysis.smoke.test.ts
```

Confirm the existing structure: imports, env vars, `assert` helper, `login`, `fetchSiteAnalysis`, `main` function, etc.

- [ ] **Step 2: Add a new helper function for drill-down fetches**

Use Edit. After the existing `fetchSiteAnalysis` function (right before the `const main = async () => {` line), add:

Replace:

```ts
const fetchSiteAnalysis = async (token: string, range: string, refresh = false) => {
    const url = `${API_BASE}/api/jafar-admin/site-analysis?range=${range}${refresh ? '&refresh=true' : ''}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
};

const main = async () => {
```

with:

```ts
const fetchSiteAnalysis = async (token: string, range: string, refresh = false) => {
    const url = `${API_BASE}/api/jafar-admin/site-analysis?range=${range}${refresh ? '&refresh=true' : ''}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
};

const fetchDrilldown = async (token: string, type: string, range: string, withAuth = true) => {
    const url = `${API_BASE}/api/jafar-admin/site-analysis/drilldown?type=${type}&range=${range}`;
    const headers: Record<string, string> = {};
    if (withAuth) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
};

const KPI_TYPES = [
    'totalCompanies',
    'totalUsers',
    'recentlyActiveUsers',
    'totalRequests',
    'requestsInRange',
    'tasksInRange',
    'totalCustomFormTemplates',
    'totalAttachments'
];

const main = async () => {
```

- [ ] **Step 3: Add the drill-down assertions inside `main`**

Find the line in `main` that prints the final results: `console.log(\`\\n📈 Results: ${passed} passed, ${failed} failed\`);`

Insert the drill-down test block immediately BEFORE that line. Use Edit to replace:

```ts
    console.log('\n🔒 Unauthenticated: no JWT should return 401');
    const unauthed = await fetch(`${API_BASE}/api/jafar-admin/site-analysis?range=30d`);
    assert('unauthenticated returns 401', unauthed.status === 401, unauthed.status);

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
```

with:

```ts
    console.log('\n🔒 Unauthenticated: no JWT should return 401');
    const unauthed = await fetch(`${API_BASE}/api/jafar-admin/site-analysis?range=30d`);
    assert('unauthenticated returns 401', unauthed.status === 401, unauthed.status);

    console.log('\n🔍 Drill-down: all 8 KPI types should return valid payloads');
    for (const kpiType of KPI_TYPES) {
        const drill = await fetchDrilldown(token, kpiType, '30d');
        assert(`${kpiType} returns 200`, drill.status === 200, drill.status);
        const drillBody = drill.body as Record<string, unknown>;
        assert(`${kpiType} payload has type=${kpiType}`, drillBody.type === kpiType);
        assert(`${kpiType} payload has rows array`, Array.isArray(drillBody.rows));
        assert(`${kpiType} payload has totalCount number`, typeof drillBody.totalCount === 'number');
        assert(`${kpiType} payload has truncated boolean`, typeof drillBody.truncated === 'boolean');
    }

    console.log('\n🚫 Drill-down: invalid type should return 400');
    const drillBadType = await fetchDrilldown(token, 'garbage', '30d');
    assert('drill-down invalid type returns 400', drillBadType.status === 400, drillBadType.status);

    console.log('\n🚫 Drill-down: invalid range should return 400');
    const drillBadRange = await fetchDrilldown(token, 'totalRequests', 'xyz');
    assert('drill-down invalid range returns 400', drillBadRange.status === 400, drillBadRange.status);

    console.log('\n🔒 Drill-down: no JWT should return 401');
    const drillUnauthed = await fetchDrilldown(token, 'totalRequests', '30d', false);
    assert('drill-down unauthenticated returns 401', drillUnauthed.status === 401, drillUnauthed.status);

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
```

- [ ] **Step 4: Run the smoke test**

Make sure the dev server is running (`bun run server:dev`), then:

```bash
TEST_JAFAR_EMAIL="ernest@shieldlytics.com" TEST_JAFAR_PASSWORD="MDA268RedDragon\$" bun src/tests/site-analysis.smoke.test.ts
```

Expected: all assertions pass (the previous count + ~43 new ones — 8 types × 5 assertions per type + 3 error cases). Final line should read `📈 Results: N passed, 0 failed` and exit code 0.

If any assertion fails, stop and investigate before committing. Most likely failure modes:
- Dev server not running or doesn't have the new route → restart it
- DB returned an unexpected shape → check that the SQL queries in Task 2 succeed via curl directly
- New routes not loaded by Bun → restart `bun run server:dev`

- [ ] **Step 5: Commit**

```bash
git add src/tests/site-analysis.smoke.test.ts
git commit -m "$(cat <<'EOF'
test: extend site analysis smoke test with drill-down assertions

Adds happy-path coverage for all 8 KPI drill-down types plus three
error scenarios (invalid type, invalid range, no auth). Uses the same
fetch-based pattern as the existing assertions — no new test runner.
EOF
)"
```

---

## Task 11: Final manual verification

**Files:** No file changes. Walk through the manual verification checklist from the spec.

- [ ] **Step 1: Re-run the smoke test end-to-end**

```bash
TEST_JAFAR_EMAIL="ernest@shieldlytics.com" TEST_JAFAR_PASSWORD="MDA268RedDragon\$" bun src/tests/site-analysis.smoke.test.ts
```

Expected: exit 0, all assertions pass.

- [ ] **Step 2: Visual checks in the browser**

With both `bun run server:dev` and `bun run dev` running, open `http://localhost:5175/jafar/site-analysis` as the Jafar user.

- [ ] Click each of the 8 KPI tiles in turn. For each:
  - Modal opens with the correct title from `drilldownColumns[type].title`
  - Subtitle reads "Showing all N <items>." with a real number
  - AG Grid renders with the columns specified in the config map
  - Sorting works on at least one column
  - Close button dismisses the modal
- [ ] Open one tile, then click a different tile while the modal is open → modal swaps data, no race condition, no console errors
- [ ] Switch the dashboard range (e.g., 30d → 7d), then click "Tasks in Range" → modal shows only tasks from the new range
- [ ] Toggle through all 5 ranges with each tile to spot-check that range scoping works
- [ ] No console errors (open DevTools, watch the console while clicking)
- [ ] Keyboard accessibility: Tab to a tile, press Enter → modal opens. Press Escape → modal closes.

- [ ] **Step 3: Empty state check**

Find a KPI that's currently 0 in your dev database (likely `recentlyActiveUsers` if no logins happened recently), or temporarily switch to the `7d` range to find one. Click that tile and verify the empty-state message displays from `drilldownColumns[type].emptyMessage`.

- [ ] **Step 4: Truncation message check (optional)**

If you have time and want to verify the truncation message: temporarily edit `server.cjs` to set `SITE_ANALYSIS_DRILLDOWN_LIMIT = 5`. Restart the dev server. Click "Total Requests" → modal subtitle should read "Showing the most recent 5 of 72 total. Narrow the range to see fewer." Revert the edit. Restart the server.

- [ ] **Step 5: Run all three server files**

Stop the dev server. Test with `node server.js`:

```bash
bun run server:prod-test
```

Once it starts, re-run the smoke test against it:

```bash
TEST_JAFAR_EMAIL="ernest@shieldlytics.com" TEST_JAFAR_PASSWORD="MDA268RedDragon\$" bun src/tests/site-analysis.smoke.test.ts
```

Expected: passes the same way under the production-style server. This proves the multi-server sync was correct.

- [ ] **Step 6: Commit any manual-test fixes (if needed)**

If steps 1-5 surfaced any bugs, fix them now and commit with descriptive messages. If everything passed cleanly, skip this step.

- [ ] **Step 7: Push the branch**

```bash
git push staging feature/siteAnalysis:main
```

(Per the user's previous direction — push to staging only, not origin.)

---

## Self-review (plan author)

- [x] **Spec coverage**: Every section of the spec maps to at least one task.
  - Architecture / new backend surface → Tasks 2, 3
  - Multi-server sync → Tasks 4, 5
  - API contract → Task 3 (route) + Task 1 (types)
  - Per-KPI columns and SQL → Task 2 (SQL) + Task 6 (column configs)
  - Components (`KpiDrilldownModal`, `drilldownColumns`, `SiteAnalysisKpiCards`, `SiteAnalysis.tsx`) → Tasks 6-9
  - Data flow & error handling → Tasks 7, 9 (frontend) + Tasks 2, 3 (backend)
  - Smoke test → Task 10
  - Manual verification → Task 11

- [x] **No placeholders**: No "TBD", "implement later", or vague instructions. Every code block contains the literal text to write.

- [x] **Type consistency**:
  - `KpiDrilldownType` defined in Task 1 → used in Tasks 6, 7, 8, 9
  - `KpiDrilldownPayload` defined in Task 1 → used in Task 7
  - `SITE_ANALYSIS_KPI_TYPES` defined in Task 2 → used in Tasks 3, 4, 5
  - `runSiteAnalysisDrilldownQueries` defined in Task 2 → called in Task 3
  - `drilldownColumns` exported in Task 6 → imported in Task 7
  - `KpiDrilldownModal` exported in Task 7 → imported in Task 9
  - `SiteAnalysisKpiCards` `onTileClick` prop defined in Task 8 → passed in Task 9
  - SQL field names in Task 2 (e.g. `companyName`, `requestorEmail`, `lastLoginAt`) match the AG Grid `field` references in Task 6

- [x] **Multi-server sync**: All edits to `server.cjs` (Tasks 2, 3) have explicit sync tasks for `server-production.js` (Task 4) and `server.js` (Task 5). Verified counts.

- [x] **AG Grid v33 theming**: `KpiDrilldownModal` (Task 7) explicitly does NOT import the legacy CSS files. Inline comment references commit `b268623`.

- [x] **No new dependencies**: All packages used (`react-bootstrap`, `ag-grid-react`, `ag-grid-community`, `axios`/`api`) are already in the project's `package.json`.

- [x] **Commit messages**: Every task ends with a single focused commit. Messages follow the existing `feat(site-analysis):` / `chore(sync):` / `test:` convention.
