# Site Analysis KPI Drill-downs — Design Spec

**Date**: 2026-04-09
**Branch**: `feature/siteAnalysis` (continuation)
**Audience**: Jafar (role ID 6) only
**Status**: Approved for planning
**Builds on**: `2026-04-08-site-analysis-design.md`

## Overview

Add click-to-drill-down behavior to all 8 KPI tiles on the existing Site Analysis dashboard. Clicking a tile opens a modal containing a list of the underlying records that produced that KPI's number, scoped to the same time range the dashboard is currently displaying.

This is a focused follow-up to the existing Site Analysis feature shipped under `2026-04-08-site-analysis-design.md`. It does not change any existing behavior — it only adds new endpoints, components, and click handlers on top.

## Scope

### In scope (MVP)

- One new backend endpoint: `GET /api/jafar-admin/site-analysis/drilldown?type=<kpi>&range=<preset>`
- Backend handles all 8 KPI types via a single switch-based query function
- Hard 500-row cap per drill-down (`SELECT TOP 500 ... ORDER BY ... DESC`) with a `totalCount` field reporting the true total
- New reusable `<KpiDrilldownModal>` React component using react-bootstrap Modal + AG Grid
- New per-KPI column config map (`drilldownColumns.tsx`)
- All 8 KPI tiles become clickable buttons (cursor pointer, hover, focus ring)
- Drill-down respects the dashboard's currently selected range
- Smoke test coverage extended in the existing `src/tests/site-analysis.smoke.test.ts`

### Explicitly out of scope (deferred)

- **Server-side pagination** — 500-row cap is sufficient for current data volumes; revisit when Jafar reports it as limiting
- **Filtering inside the modal** beyond AG Grid's built-in column sorting
- **CSV/PDF export from the modal** — defer until requested
- **Modal-to-modal navigation** (e.g., click a request row to drill into that specific request)
- **Caching of drill-down results** — drill-downs run on demand; the parent dashboard's 5-min cache is unaffected
- **Mobile-optimized modal layout** — Site Analysis is desktop-only

## Design decisions (locked in during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Drill-down content | List of underlying records | Most natural interpretation of "drill down on a count"; matches Jafar's investigation flow |
| Time scope | Inherit dashboard's range | Principle of least surprise — number you click equals rows in modal |
| Pagination strategy | Hard cap at 500 most recent | Single Jafar user, modest data, no pagination UI complexity |
| Backend API shape | One parameterized endpoint | Half the multi-server-sync overhead vs 8 endpoints; easy to add a 9th KPI later |
| Modal trigger | Click anywhere on the tile | Discoverable, no extra "details" button |
| Modal library | react-bootstrap Modal `size="xl"` | Already used throughout the project |
| Grid library | AG Grid Community | Already used; no new dependencies; consistent with company breakdown table |
| Caching | None for drill-downs | On-demand queries are cheap with proper indexes; cache invalidation isn't worth the complexity |
| Sort default | Most recent first | Newest data is the most relevant for an investigation |

## Architecture

### Codebase reality (carries forward from parent spec)

- All API logic lives **inline in the three legacy server files** (`server.cjs`, `server-production.js`, `server.js`). No `server/` TypeScript routes are mounted.
- Middleware chain: `getAuthenticatedUserCompany, checkJafarRole`.
- All edits must be applied to all three server files per `CLAUDE.md`.
- No test runner is installed — smoke tests are standalone ts-node scripts.

### New backend surface

**Constants** (next to existing `SITE_ANALYSIS_RANGE_PRESETS`):

```js
const SITE_ANALYSIS_KPI_TYPES = [
    'totalCompanies', 'totalUsers', 'recentlyActiveUsers',
    'totalRequests', 'requestsInRange', 'tasksInRange',
    'totalCustomFormTemplates', 'totalAttachments'
];
const SITE_ANALYSIS_DRILLDOWN_LIMIT = 500;
```

**Helper function** (added immediately after `runSiteAnalysisCompanyQueries`):

```js
const runSiteAnalysisDrilldownQueries = async (type, rangeStart) => {
    const rangeStartIso = rangeStart.toISOString();
    let rowsSql;
    let countSql;

    switch (type) {
        case 'totalCompanies':
            // ...see Section "Per-KPI columns and SQL" below for the 8 query pairs
            break;
        // ... 7 more cases
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
```

**HTTP route** (added immediately after the existing `/api/jafar-admin/site-analysis` route):

```js
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
```

### New frontend surface

```
src/components/SiteAnalysis/
├── KpiDrilldownModal.tsx        ← NEW: reusable modal, owns fetch state
├── drilldownColumns.tsx         ← NEW: per-KPI column config map + date formatters
├── SiteAnalysisKpiCards.tsx     ← MODIFIED: tiles become <button>, accept onTileClick
├── types.ts                     ← MODIFIED: add KpiDrilldownType, KpiDrilldownPayload
src/pages/SiteAnalysis.tsx       ← MODIFIED: own drilldownType state, render modal
src/tests/site-analysis.smoke.test.ts ← MODIFIED: add 8 drill-down assertions + 1 invalid-type
```

No new dependencies. `react-bootstrap`, `recharts`, and `ag-grid-react` are all already in `package.json`.

## API contract

### Endpoint

```
GET /api/jafar-admin/site-analysis/drilldown?type=<kpi>&range=<preset>
```

**Auth**: `getAuthenticatedUserCompany, checkJafarRole` (existing middleware, reused).

**Query params**:
- `type` (required): one of the 8 keys in `SITE_ANALYSIS_KPI_TYPES`
- `range` (required): one of `7d`, `30d`, `90d`, `12mo`, `all`

**Responses**:
- `200` — well-formed payload (see below)
- `400` — invalid `type`: `{ error: "Invalid KPI type" }`
- `400` — invalid `range`: `{ error: "Invalid range preset" }`
- `401` — missing/invalid JWT (existing middleware)
- `403` — valid JWT but not role 6 (existing middleware)
- `500` — query failure: `{ error: "Failed to load drill-down" }`

### Payload shape

```json
{
  "type": "totalRequests",
  "range": "30d",
  "rows": [
    {
      "REQUEST_ID": 123,
      "TRACKINGID": "REQ-2026-04-08-001",
      "REQUEST_NAME": "Background Investigation Request",
      "STATUS": "A",
      "CREATE_DATE": "2026-04-08T15:32:00.000Z",
      "COMPANY_ID": 1,
      "companyName": "Acme Corp",
      "requestorEmail": "user@acme.com"
    }
  ],
  "totalCount": 72,
  "truncated": false
}
```

**Notes:**
- The shape of each row depends on the `type` — different KPIs return different columns. The frontend uses the `drilldownColumns` config to render whatever fields the SQL returned.
- `truncated === true` when `totalCount > 500`. When truncated, `rows.length === 500` and the rows are the most recent.
- The frontend never assumes a specific row shape — column rendering is config-driven.

### TypeScript types added to `src/components/SiteAnalysis/types.ts`

```ts
export type KpiDrilldownType = keyof SiteAnalysisKpis;
// Equivalent to:
//   'totalCompanies' | 'totalUsers' | 'recentlyActiveUsers' |
//   'totalRequests' | 'requestsInRange' | 'tasksInRange' |
//   'totalCustomFormTemplates' | 'totalAttachments'

export interface KpiDrilldownPayload<TRow = Record<string, unknown>> {
    type: KpiDrilldownType;
    range: SiteAnalysisRange;
    rows: TRow[];
    totalCount: number;
    truncated: boolean;
}
```

`KpiDrilldownType` is derived from `keyof SiteAnalysisKpis` so the two stay in sync automatically — adding a new KPI to `SiteAnalysisKpis` later will surface a TypeScript error wherever a `switch` is missing the new case.

## Per-KPI columns and SQL

All 8 KPIs share the same general shape: a `SELECT TOP 500` query with appropriate joins, a parallel `SELECT COUNT(*)` query for the total, and an `ORDER BY <date> DESC` default sort.

### 1. `totalCompanies`

**Modal title**: Companies
**Empty state**: "No companies yet."
**Columns**: Company ID · Name · Created · Users · Requests

```sql
SELECT TOP 500
    c.COMPANY_ID,
    c.NAME,
    c.CREATED_AT,
    (SELECT COUNT(*) FROM GUARDIAN.USERS u WHERE TRY_CONVERT(INT, u.COMPANY_ID) = c.COMPANY_ID AND u.STATUS = 'P') AS userCount,
    (SELECT COUNT(*) FROM GUARDIAN.REQUESTS r WHERE TRY_CONVERT(INT, r.COMPANY_ID) = c.COMPANY_ID) AS requestCount
FROM GUARDIAN.COMPANY c
ORDER BY c.CREATED_AT DESC
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY
```

### 2. `totalUsers`

**Modal title**: Users
**Empty state**: "No users yet."
**Columns**: Email · Name · Company · Status · Created · Last Login

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.USERS WHERE STATUS = 'P'
```

### 3. `recentlyActiveUsers`

**Modal title**: Recently Active Users
**Empty state**: "No users have logged in during the selected range."
**Columns**: Email · Name · Company · Logins (in range) · Last Login

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(DISTINCT USER_ID) AS count
FROM GUARDIAN.USER_LOGIN_EVENTS
WHERE LOGIN_AT >= '${rangeStartIso}'
```

### 4. `totalRequests`

**Modal title**: All Requests
**Empty state**: "No requests yet."
**Columns**: Tracking ID · Name · Status · Requestor · Company · Created

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.REQUESTS
```

### 5. `requestsInRange`

**Modal title**: Requests in Range
**Empty state**: "No requests created in the selected range."
**Columns**: Tracking ID · Name · Status · Requestor · Company · Created

Same as `totalRequests` but with `WHERE r.CREATE_DATE >= '${rangeStartIso}'` added to both queries.

### 6. `tasksInRange`

**Modal title**: Tasks in Range
**Empty state**: "No tasks created in the selected range."
**Columns**: Tracking ID · Description · Status · Assignee · Request · Company · Created

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.TASKS WHERE CREATE_DATE >= '${rangeStartIso}'
```

### 7. `totalCustomFormTemplates`

**Modal title**: Custom Form Templates
**Empty state**: "No custom form templates yet."
**Columns**: Form Name · Description · Company · Fields · Form ID

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.FORMS WHERE COMPANY_ID IS NOT NULL
```

### 8. `totalAttachments`

**Modal title**: Attachments
**Empty state**: "No attachments yet."
**Columns**: Filename · Request · Company · Uploaded By · Created

```sql
SELECT TOP 500
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
```

```sql
SELECT COUNT(*) AS count FROM GUARDIAN.ATTACHMENTS
```

## Components

### `KpiDrilldownModal.tsx`

**Props**:
```ts
interface KpiDrilldownModalProps {
    type: KpiDrilldownType | null;
    range: SiteAnalysisRange;
    onClose: () => void;
}
```

**Behavior**:
- When `type === null` → modal is hidden (`<Modal show={false}>`)
- When `type` becomes non-null → useEffect fires, fetches the drill-down, renders
- Modal `size="xl"`, `scrollable`
- Header: title from `drilldownColumns[type].title`
- Header subtitle:
  - Loading: "Loading..."
  - Loaded, not truncated: `Showing all ${totalCount} ${title.toLowerCase()}`
  - Loaded, truncated: `Showing the most recent 500 of ${totalCount} total. Narrow the range to see fewer.`
- Body:
  - Loading: spinner
  - Error: red alert with message + Retry button
  - Empty: configured `emptyMessage` from `drilldownColumns[type]`
  - Success: AG Grid with `rowData={rows}` and `columnDefs={drilldownColumns[type].columns}`
- Footer: Close button only
- AbortController on `useEffect` cleanup; aborts in-flight fetches on type change or unmount
- Re-mounts cleanly on type change (no stale data flashing)

### `drilldownColumns.tsx`

```ts
import type { ColDef } from 'ag-grid-community';
import type { KpiDrilldownType } from './types';

interface DrilldownConfig {
    title: string;
    emptyMessage: string;
    columns: ColDef[];
}

const formatDate = (params: { value?: string | null }) =>
    params.value ? new Date(params.value).toLocaleString() : '—';

const formatRelative = (params: { value?: string | null }) => {
    if (!params.value) return 'Never';
    // ... same logic as SiteAnalysisCompanyTable.tsx (extracted to a shared util later)
};

export const drilldownColumns: Record<KpiDrilldownType, DrilldownConfig> = {
    totalCompanies: {
        title: 'Companies',
        emptyMessage: 'No companies yet.',
        columns: [
            { headerName: 'Company ID', field: 'COMPANY_ID', sortable: true, width: 110 },
            { headerName: 'Name', field: 'NAME', sortable: true, flex: 2, minWidth: 180 },
            { headerName: 'Created', field: 'CREATED_AT', sortable: true, valueFormatter: formatDate, flex: 1 },
            { headerName: 'Users', field: 'userCount', sortable: true, width: 100 },
            { headerName: 'Requests', field: 'requestCount', sortable: true, width: 110 }
        ]
    },
    // ... 7 more
};
```

The full 8-entry config map will live in this file. Date formatters are inlined for now; if `formatRelative` ends up duplicated between `SiteAnalysisCompanyTable.tsx` and this file, extract them to `src/components/SiteAnalysis/dateFormat.ts` as part of the implementation cleanup.

### `SiteAnalysisKpiCards.tsx` modifications

The current `Tile` sub-component is a `<div>`. Convert it to a `<button>` with:
- `type="button"` (don't trigger form submits)
- `onClick={() => onTileClick(kpiType)}` where `kpiType` is passed in
- `className` adds `cursor-pointer`, hover background, focus ring (Bootstrap classes: `btn btn-link p-0 text-start text-decoration-none w-100`)
- Each Tile receives a `kpiType` prop so it knows which key to dispatch
- The `SiteAnalysisKpiCards` parent receives a new `onTileClick: (type: KpiDrilldownType) => void` prop and passes it through

### `SiteAnalysis.tsx` modifications

```tsx
const [drilldownType, setDrilldownType] = useState<KpiDrilldownType | null>(null);

// In JSX, replace the existing <SiteAnalysisKpiCards kpis={data.kpis} />
// with:
<SiteAnalysisKpiCards kpis={data.kpis} onTileClick={setDrilldownType} />

// And add at the end of the rendered tree:
<KpiDrilldownModal
    type={drilldownType}
    range={range}
    onClose={() => setDrilldownType(null)}
/>
```

## Data flow

```
1. Jafar viewing /jafar/site-analysis at range='30d'.
   KPI cards already rendered from the parent payload.

2. Jafar clicks the "Total Requests: 72" tile.
   └─ Tile button onClick fires onTileClick('totalRequests')
      └─ SiteAnalysis.tsx setDrilldownType('totalRequests')
         └─ <KpiDrilldownModal type="totalRequests" range="30d" /> renders

3. Modal useEffect fires (type changed null → 'totalRequests'):
   ├─ AbortController created
   ├─ setLoading(true), setError(null)
   └─ fetch /api/jafar-admin/site-analysis/drilldown?type=totalRequests&range=30d
      ├─ getAuthenticatedUserCompany validates JWT
      ├─ checkJafarRole verifies role 6
      └─ Route handler:
          ├─ validate type ∈ SITE_ANALYSIS_KPI_TYPES (else 400)
          ├─ validate range ∈ SITE_ANALYSIS_RANGE_PRESETS (else 400)
          ├─ resolveSiteAnalysisRange(range) → { rangeStart }
          └─ runSiteAnalysisDrilldownQueries('totalRequests', rangeStart):
              ├─ switch picks the totalRequests SQL pair
              └─ Promise.all([
                    prisma.$queryRawUnsafe(rowsSql),    // SELECT TOP 500
                    prisma.$queryRawUnsafe(countSql)    // SELECT COUNT(*)
                  ])
              ├─ assemble { rows, totalCount, truncated }
              └─ return
   └─ Response: { type, range, rows: [...], totalCount, truncated }

4. Modal:
   ├─ setData(payload), setLoading(false)
   ├─ Header subtitle: "Showing all 72 requests" (truncated=false)
   └─ AG Grid renders columns from drilldownColumns.totalRequests

5. Jafar closes the modal:
   └─ onClose() → setDrilldownType(null) → modal hidden → AbortController.abort() runs
```

## Error handling

**Backend:**
- Invalid `type` → `400 { error: "Invalid KPI type" }`
- Invalid `range` → `400 { error: "Invalid range preset" }`
- SQL/DB failure → `500 { error: "Failed to load drill-down" }`, server-side `console.error('❌ [SITE ANALYSIS DRILLDOWN] Failed:', error)` with full stack
- Auth failures → `401`/`403` from existing middleware (no special handling)
- No partial payloads — if either query in the `Promise.all` rejects, the whole request fails

**Frontend:**
- Network error / 500 → modal body shows red alert with the error message and a Retry button. Retry re-fires the same fetch.
- Empty rows → grid is replaced with the configured `emptyMessage` for that KPI
- Modal close mid-fetch → `AbortController.abort()` runs in cleanup; `setData`/`setLoading` are guarded by `if (!aborted)` checks
- Rapid tile clicks → previous in-flight fetch aborted, new one wins
- Range switch while modal open (rare) → modal `range` prop changes, useEffect re-fires, data swaps

## Edge cases

- **Truncation messaging**: When `truncated === true`, the header subtitle reads "Showing the most recent 500 of N total. Narrow the range to see fewer." This is the user's signal, not a hard error.
- **Modal width**: Bootstrap `Modal size="xl"` is `max-width: 1140px`. Below 1200px viewport, falls back to `min(95vw, 1140px)`. Mobile is not a target.
- **AG Grid theming**: Drill-down grid uses the v33 default Theming API (themeQuartz). No CSS imports — matches the fix from commit `b268623`.
- **Cache**: explicitly **none** for drill-downs. Each click is a fresh query.
- **Type-derived enum**: `KpiDrilldownType = keyof SiteAnalysisKpis` ensures adding a new KPI later surfaces a TypeScript error in the switch statement and the `drilldownColumns` map.

## Access control

Inherited from the parent feature — same three layers:

1. **Backend route**: `getAuthenticatedUserCompany` + `checkJafarRole` middleware on the new endpoint
2. **Frontend route**: New endpoint is only called from inside `/jafar/site-analysis`, which is already wrapped in `<RequireJafar>`
3. **Frontend nav**: Drill-down tiles are only rendered as part of the dashboard, which only Jafar users can reach

No new access control surface.

## Testing plan

### Smoke test extension

Add to the existing `src/tests/site-analysis.smoke.test.ts` (do NOT create a new file):

1. After the existing happy-path checks, loop through all 8 KPI types and call `/drilldown?type=<type>&range=30d`. For each:
   - Assert HTTP 200
   - Assert `Array.isArray(rows)`
   - Assert `typeof totalCount === 'number'`
   - Assert `typeof truncated === 'boolean'`
   - If `rows.length > 0`, log the first row's keys (for diagnostic purposes)
2. Call `/drilldown?type=garbage&range=30d` → assert HTTP 400
3. Call `/drilldown?type=totalRequests&range=garbage` → assert HTTP 400
4. Call `/drilldown?type=totalRequests&range=30d` without `Authorization` header → assert HTTP 401

Expected new assertion count: **~35** (8 types × 4 assertions per type + 3 error cases).

### Manual verification (visual)

- [ ] Click each of the 8 KPI tiles → modal opens with appropriate title
- [ ] Modal shows the correct columns for each KPI type
- [ ] Empty state shows when there are no rows
- [ ] AG Grid sorting works on each column
- [ ] Close modal → re-open same type → fresh fetch (no stale data)
- [ ] Open one type → quickly close and open a different type → no race condition, last click wins
- [ ] Change dashboard range while modal is closed → re-open modal → uses new range
- [ ] Truncation case: artificially lower the limit to 5 (temporary edit) → verify "Showing the most recent 5 of N total" appears, then revert
- [ ] No console errors after clicking through all 8 tiles
- [ ] Keyboard accessibility: tab through tiles, Enter/Space opens modal, Escape closes

### Not tested

- No unit tests / no React Testing Library — project has no test runner (same as parent feature)
- No load testing — drill-downs run on demand and are bounded by the 500-row cap
- No E2E Playwright — manual visual verification covers it

## Open follow-ups (deferred)

- **CSV/PDF export from the modal** — wire into the existing ExportPage infrastructure if Jafar asks
- **Modal-to-modal navigation** — clicking a row to drill into that specific record (e.g., a request → its tasks)
- **Server-side pagination** — only if 500 becomes limiting at scale
- **Filtering** — AG Grid filter UI for power users
- **Per-column hover tooltips** for IDs and truncated text

## References

- Parent spec: `docs/superpowers/specs/2026-04-08-site-analysis-design.md`
- Parent plan: `docs/superpowers/plans/2026-04-08-site-analysis.md`
- Existing site-analysis route: `server.cjs:14918`
- Existing query helpers: `server.cjs:14018-14254` (KPI / trends / company)
- Multi-server sync rule: `CLAUDE.md` § "Multi-Server Synchronization Protocol"
- AG Grid v33 theming fix precedent: commit `b268623`
- Existing modal patterns: `src/components/RequestModal.tsx`, `src/components/CreateNoticeModal.tsx`
