# Site Analysis — Design Spec

**Date**: 2026-04-08
**Branch**: `feature/siteAnalysis`
**Audience**: Jafar (role ID 6) only
**Status**: Approved for planning

## Overview

A cross-tenant usage dashboard available exclusively to Jafar users (role ID 6). It aggregates platform-wide statistics across all companies to answer four questions in a single view:

1. **Adoption** — Which companies are actually using Guardian?
2. **Volume** — How much work is flowing through each company?
3. **Trends** — Are companies growing or shrinking their usage over time?
4. **Capacity** — Raw counters useful for pricing and infrastructure decisions.

This deliberately breaks Guardian's normal company-isolation rule. That rule is enforced everywhere else in the app, and the cross-tenant view is gated behind the existing `requireJafar` middleware (role ID 6), which is the same gate used by the Jafar Administration purge tool.

## Scope

### In scope (MVP)

- Jafar-only route and navigation entry
- Single backend endpoint returning KPIs, trend data, and per-company breakdown in one payload
- Five fixed date range presets: `7d`, `30d`, `90d`, `12mo`, `all`
- In-memory backend cache with 5-minute TTL and manual refresh
- Eight KPI tiles, two time-series trend charts, one company breakdown table
- Login tracking: new `GUARDIAN.USER_LOGIN_EVENTS` table, write on successful login in all three server files
- Integration with the existing Jafar purge flow so login events cascade cleanly when a user or company is hard-deleted

### Explicitly out of scope (deferred)

- Company drill-down detail page (revisit after MVP usage reveals which per-company questions matter)
- Custom date range picker (presets cover the common questions; trivial to bolt on later)
- Nightly aggregation table or scheduled jobs (premature at current data volumes)
- Export to CSV/PDF (the existing `ExportPage` infrastructure can absorb this later on request)
- Per-user timezone configuration (browser local time via `toLocaleString()` is sufficient)

## Design decisions (locked in during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Layout shape | KPI cards + site-wide trend charts + company breakdown table below | Executive summary reads top-down |
| Time range control | Fixed presets only (`7d`, `30d`, `90d`, `12mo`, `all`) | Answers 95% of questions; no custom picker needed |
| Data freshness | Cached with manual refresh button | Fast repeat loads; Jafar can force fresh when needed |
| Navigation placement | Tile on `AdminDashboard`, mirrors existing "JAFAR Hard Delete" tile pattern | Reuses established Jafar toolkit UX |
| Drill-down | None for MVP | Design against real questions later instead of guessing now |
| Timezone display | Backend UTC, frontend `toLocaleString()` to browser local | Simple; one-line footnote explains UTC day buckets |

## Architecture

### Codebase reality check (informs decisions below)

The project has consolidated active API routes into the three legacy server files (`server.cjs`, `server-production.js`, `server.js`) — see commit `3d643b1 feat: ... consolidate routing to server.cjs`. The parallel `server/` TypeScript tree (`server/routes/jafar-admin.ts`, `server/services/jafarPurge.ts`, etc.) exists but is not mounted in `server/index.ts`, so adding files there has no runtime effect on the running servers. New Jafar routes therefore go inline in the legacy servers, following the existing pattern at `server.cjs:14427+` which uses the middleware pair `getAuthenticatedUserCompany, checkJafarRole` defined inline at `server.cjs:13917`. The project also has no test runner installed — see Testing section for the implications.

### New surface

**Backend (inline in all three legacy server files):**
- `GET /api/jafar-admin/site-analysis?range=<preset>&refresh=<bool>` — single endpoint returning the full payload. Uses existing middleware chain: `getAuthenticatedUserCompany, checkJafarRole`.
- Helper functions added inline near the existing Jafar routes (around `server.cjs:14427+`):
  - `resolveSiteAnalysisRange(range)` — maps a preset to `{ rangeStart, rangeEnd }`.
  - `getCachedSiteAnalysis(range)` / `setCachedSiteAnalysis(range, data)` / `invalidateSiteAnalysisCache(range)` — operate on a module-level `Map` declared near the top of the Jafar section.
  - `runSiteAnalysisKpiQueries(rangeStart)`, `runSiteAnalysisTrendQueries(rangeStart, rangeEnd)`, `runSiteAnalysisCompanyQueries(rangeStart)` — raw SQL query functions using `prisma.$queryRaw` / `$queryRawUnsafe`.
  - `getSiteAnalysis(range, { refresh })` — orchestrator that checks cache, runs the three query groups via `Promise.all`, assembles payload, writes cache, returns.
- In-memory cache: `Map<RangePreset, { data, cachedAt }>` declared at module scope. 5-minute TTL. Process-local (no Redis — single-user Jafar dashboard).

**Why inline, not a shared helper module**: `server.cjs` is CommonJS, `server.js` is loaded as CommonJS via `package.production.json`, but the root `package.json` declares `"type": "module"`. Sharing a helper file across all three servers would require an ESM/CJS interop workaround that is strictly worse than the existing "copy the route into all three files" rule the project already enforces in `CLAUDE.md`. This plan matches the prevailing convention.

**Frontend:**
- `src/pages/SiteAnalysis.tsx` — page component. Owns `range`, `data`, `loading`, `error` state. Single `useEffect` firing on range change. `handleRefresh()` hits the endpoint with `?refresh=true`.
- `src/components/SiteAnalysis/SiteAnalysisHeader.tsx` — title, range selector, refresh button, "updated X ago" display.
- `src/components/SiteAnalysis/SiteAnalysisKpiCards.tsx` — eight-tile grid.
- `src/components/SiteAnalysis/SiteAnalysisActivityChart.tsx` — recharts `LineChart` for logins/requests/tasks per day.
- `src/components/SiteAnalysis/SiteAnalysisNewAccountsChart.tsx` — recharts `LineChart` for new users/new companies per day.
- `src/components/SiteAnalysis/SiteAnalysisCompanyTable.tsx` — AG Grid wrapper, sortable columns, consistent with `TaskTable.tsx` and other data grids in the project.
- `src/components/SiteAnalysis/types.ts` — shared TypeScript types for the payload.
- `src/components/RequireJafar.tsx` — new reusable guard component. Extracts the `isJafar` check currently duplicated in `JafarAdministration.tsx` lines 78–80 and the `isJafarUser()` helper in `AdminDashboard.tsx`. Used to wrap both Jafar routes.

**Navigation (mirrors existing JafarAdministration pattern):**
- New tile on `AdminDashboard.tsx` beside the existing "JAFAR Hard Delete" tile, gated by `isJafarUser()`. Non-danger accent color (e.g. `border-t-primary` or `border-t-info`) with a chart icon. Copy: "Site Analysis" / "Cross-company usage metrics / Platform trends / Company breakdown".
- New `onShowJafarSiteAnalysis` prop on `AdminDashboard`.
- New `selectedSection='jafarSiteAnalysis'` branch in `Home.tsx` that renders `<SiteAnalysis />` inline, mirroring the existing `jafarAdministration` branch.
- New standalone route `/jafar/site-analysis` in `App.tsx` for direct-URL access (mirrors the existing `/jafar-administration` route formality).

### Multi-server sync requirement

Per `CLAUDE.md`, API endpoint changes must land in all three server files simultaneously:
- `server.cjs` (development, source of truth)
- `server-production.js` (production source for pipeline)
- `server.js` (local production testing)

The new `/api/jafar-admin/site-analysis` route and the `/api/login` login-tracking insert both touch this rule.

## Schema changes

New table:

```prisma
model USER_LOGIN_EVENTS {
  EVENT_ID  Int       @id(map: "PK_USER_LOGIN_EVENTS") @default(autoincrement())
  USER_ID   Int
  LOGIN_AT  DateTime  @default(now()) @db.DateTime

  @@index([LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_LOGIN_AT")
  @@index([USER_ID, LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_USER_LOGIN_AT")
  @@schema("GUARDIAN")
}
```

- **Why a table, not a `LAST_LOGIN_DATE` column on `USERS`**: the "Logins per day" trend chart needs event history. A single column cannot power a time-series. The table is the minimum data structure that satisfies both the "Recently Active Users" KPI and the logins trend chart.
- **Indexes**: `LOGIN_AT` for fast range-based aggregation; `(USER_ID, LOGIN_AT)` for per-user lookups (not used in MVP but costs nothing to add now).
- **No FK or cascade**: Matches the prevailing pattern for analytics/history tables in this schema — store `USER_ID` as a plain int, rely on the existing Jafar purge transaction to enumerate and explicitly delete rows. Adding a FK with cascade would bypass the purge counts (the existing `createEmptyJafarCounts` pattern at `server.cjs:14119` requires explicit counts to show Jafar what will be deleted).
- **Jafar purge integration**: Update `createEmptyJafarCounts()` to include `userLoginEvents: 0`, update `buildJafarUserPreview` and `buildJafarCompanyPreview` to count them, and add explicit `DELETE FROM GUARDIAN.USER_LOGIN_EVENTS` statements inside the existing purge transactions.
- **Migration**: Hand-written SQL migration file at `prisma/migrations/YYYYMMDD-add-user-login-events.sql`, following the existing convention (see `prisma/migrations/20250428-allow-null-request-relations.sql`). The Prisma schema is also updated so the generated client knows about the new model, but the DDL is applied manually to each environment — the project does not use `prisma migrate dev`.

## API contract

### Endpoint

```
GET /api/jafar-admin/site-analysis?range=<preset>&refresh=<bool>
```

**Auth**: Middleware chain `getAuthenticatedUserCompany, checkJafarRole` applied directly on the route, matching the existing inline Jafar routes at `server.cjs:14427+`.

**Query params**:
- `range` (required): one of `"7d"`, `"30d"`, `"90d"`, `"12mo"`, `"all"`
- `refresh` (optional): `"true"` to bypass cache and force recomputation

**Responses**:
- `200` — well-formed payload (see below)
- `400` — invalid range preset: `{ error: "Invalid range preset" }`
- `401` — missing/invalid JWT: `{ error: "Authentication required" }`
- `403` — valid JWT but not role 6: `{ error: "JAFAR access required" }`
- `500` — aggregation failure: `{ error: "Failed to compute site analysis" }`

### Payload shape

```json
{
  "range": "30d",
  "rangeStart": "2026-03-09T00:00:00.000Z",
  "rangeEnd":   "2026-04-08T23:59:59.999Z",
  "generatedAt": "2026-04-08T14:32:10.123Z",
  "cached": true,
  "kpis": {
    "totalCompanies": 42,
    "totalUsers": 1234,
    "recentlyActiveUsers": 567,
    "totalRequests": 8900,
    "requestsInRange": 234,
    "tasksInRange": 456,
    "totalCustomFormTemplates": 89,
    "totalAttachments": 1234
  },
  "trends": {
    "activityPerDay": [
      { "date": "2026-03-09", "logins": 23, "requests": 4, "tasks": 7 }
    ],
    "newAccountsPerDay": [
      { "date": "2026-03-09", "newUsers": 1, "newCompanies": 0 }
    ]
  },
  "companies": [
    {
      "companyId": 1,
      "companyName": "Acme Corp",
      "totalUsers": 42,
      "activeUsersInRange": 12,
      "totalRequests": 1234,
      "requestsInRange": 56,
      "totalTasks": 789,
      "tasksInRange": 23,
      "customFormTemplates": 5,
      "lastActivityAt": "2026-04-07T15:32:00.000Z",
      "accountAgeDays": 234,
      "percentOfPlatformRequests": 8.3
    }
  ]
}
```

- `range="all"` sets `rangeStart` to `1970-01-01T00:00:00.000Z` (effectively no lower bound) so range-scoped and all-time metrics converge.
- Trend arrays include one entry per day in the range, filled with zeros on days with no activity, so charts draw continuous lines.
- `companies` is sorted by `requestsInRange` DESC by default; the frontend table provides client-side re-sorting on any column.

## Metrics catalog

### KPI tiles (8)

| # | Tile | Query |
|---|---|---|
| 1 | Total Companies | `COUNT(*) FROM GUARDIAN.COMPANY` |
| 2 | Total Users | `COUNT(*) FROM GUARDIAN.USERS WHERE STATUS = 'P'` |
| 3 | Recently Active Users | `COUNT(DISTINCT USER_ID) FROM GUARDIAN.USER_LOGIN_EVENTS WHERE LOGIN_AT >= rangeStart` |
| 4 | Total Requests (all-time) | `COUNT(*) FROM GUARDIAN.REQUESTS` |
| 5 | Requests in Range | `COUNT(*) FROM GUARDIAN.REQUESTS WHERE CREATE_DATE >= rangeStart` |
| 6 | Tasks in Range | `COUNT(*) FROM GUARDIAN.TASKS WHERE CREATE_DATE >= rangeStart` |
| 7 | Custom Form Templates | `COUNT(*) FROM GUARDIAN.FORMS WHERE COMPANY_ID IS NOT NULL` (excludes global Jafar-owned templates) |
| 8 | Attachments | `COUNT(*) FROM GUARDIAN.ATTACHMENTS`. File count only — total storage size is deliberately excluded (see note below). |

### Trend charts (2)

**Chart A — "Platform Activity"** (three lines):
- Logins per day
- Requests created per day
- Tasks created per day

**Chart B — "New Accounts"** (two lines):
- New users per day
- New companies per day

Split into two charts (rather than one five-line chart) so each has sensible Y-axis scaling. Combining signup counts (typically single digits) with login counts (potentially hundreds) on one axis would make the signup line invisible.

**Note on the attachments KPI**: The `GUARDIAN.ATTACHMENTS` table stores file bytes in an `ATTACHMENT Bytes?` blob column with no explicit `FILE_SIZE` column. Summing total storage would require `SUM(DATALENGTH(ATTACHMENT))`, which scans blob data and can be expensive at scale. For MVP the KPI is file count only. If total storage bytes becomes a required metric later, the right fix is adding a `FILE_SIZE_BYTES` column to `ATTACHMENTS` (populated on insert) — that's cheap to sum and doesn't rescan blobs. This is listed under Open follow-ups.

### Company breakdown table (8 columns)

| Column | Content |
|---|---|
| Company | Name (plain text, not a link — drill-down deferred) |
| Users (active / total) | e.g. `12 / 42`. Active = distinct users with login in range. |
| Requests (range / all) | e.g. `56 / 1,234` |
| Tasks (range / all) | e.g. `23 / 789` |
| Templates | Custom form templates count |
| Last Activity | Most recent of: last login / last request create / last task create. Relative time ("2 hours ago"). |
| Account Age | Days since `COMPANY.CREATE_DATE` |
| % Platform Requests | `company.requestsInRange ÷ SUM(requestsInRange across all companies) × 100`, one decimal |

Default sort: `Requests (range)` DESC. All columns sortable client-side.

## Data flow

```
1. Jafar clicks "Site Analysis" tile on AdminDashboard
   └─ Home.tsx sets selectedSection='jafarSiteAnalysis'
      └─ <SiteAnalysis /> mounts, defaults to range='30d'

2. SiteAnalysis useEffect fires:
   GET /api/jafar-admin/site-analysis?range=30d
   ├─ requireAuth validates JWT
   └─ requireJafar verifies role 6

3. siteAnalysis service:
   ├─ resolveRange('30d') → { rangeStart, rangeEnd }
   ├─ getCached('30d') → cache hit? return cached payload immediately
   └─ cache miss:
       └─ Promise.all([
            runKpiQueries(rangeStart),
            runTrendQueries(rangeStart, rangeEnd),
            runCompanyBreakdownQueries(rangeStart)
          ])
       ├─ assemble payload
       ├─ setCached('30d', payload)
       └─ return payload

4. Frontend renders:
   ├─ Header shows "Updated just now" from generatedAt
   ├─ KpiCards renders 8 tiles from payload.kpis
   ├─ ActivityChart renders from payload.trends.activityPerDay
   ├─ NewAccountsChart renders from payload.trends.newAccountsPerDay
   └─ CompanyTable renders sorted by requestsInRange DESC

5. Range switch:
   └─ range state changes → useEffect re-fires → new fetch (may hit cache)

6. Manual refresh:
   └─ GET /api/jafar-admin/site-analysis?range=30d&refresh=true
   └─ Service invalidates '30d' cache then re-runs queries
```

## Error handling

**Backend:**
- Any single aggregation query throws → whole request fails with `500` and `{ error: "Failed to compute site analysis" }`. No partial payloads — a dashboard with half the tiles missing is more confusing than a clear error. Underlying error is `console.error`'d server-side with the range and failed query name.
- Cache corruption → `getCached()` wraps access in try/catch; on exception returns `null` (treated as miss). Cache is recomputed on next request.
- Login tracking insert fails (`/api/login` fire-and-forget) → `.catch(err => console.error('[LOGIN TRACK]', err))`. Login itself still succeeds. **Login availability always wins over analytics accuracy.**

**Access control:**
- No JWT → 401 (existing `requireAuth` middleware)
- Valid JWT but not role 6 → 403 (existing `requireJafar` middleware)
- Frontend 403 → redirects to `/` with a toast "JAFAR access required", matching existing `JafarAdministration` behavior

**Frontend:**
- Network error / 500 → `<ErrorBanner>` with error message and "Retry" button. Loading skeleton is hidden.
- Empty payload (zero companies / zero activity) → KPI cards show `0`, charts show flat zero lines, company table shows "No companies yet." No crashes.
- Range switch mid-fetch → previous fetch aborted via `AbortController` so a slow 90d query cannot overwrite a fast 7d result.

### Edge cases

- **`range='all'`** could scan millions of rows as data grows. Cache absorbs this — at worst one slow query every five minutes.
- **Timezone / UTC day buckets**: Backend always sends raw UTC timestamps. Frontend converts display to browser local time via `toLocaleString()`. Day buckets are UTC days; a one-line UI footnote notes that events near midnight local time may appear on the adjacent day. Edge case is invisible in aggregate.
- **Zero-activity days**: Filled with `{ date, logins: 0, requests: 0, tasks: 0 }` so charts draw a continuous line rather than gaps.

## Access control

All access is gated by role ID 6 (Jafar) at three layers:

1. **Backend route**: `getAuthenticatedUserCompany` + `checkJafarRole` middleware, reusing the existing inline helpers at `server.cjs:13917` and nearby. No new middleware needed.
2. **Frontend route**: New `<RequireJafar>` guard wrapping the `/jafar/site-analysis` route (extracted from existing `JafarAdministration` duplication)
3. **Frontend nav**: AdminDashboard tile only rendered when `isJafarUser()` returns true

The `<RequireJafar>` extraction is included in MVP scope because we now have two Jafar pages; avoiding a third duplication of the role check is a small, focused refactor that serves the current goal. Both `JafarAdministration.tsx` (lines 78–80) and the new `SiteAnalysis.tsx` will use it.

## Testing plan

### Testing reality

The project has **no test runner installed**. `package.json` has no `"test"` script, no `vitest`/`jest`/`@testing-library/react` in deps, and no `*.test.ts` files under `server/`. The existing `src/tests/*.test.ts` files are **standalone `ts-node` scripts** — they import code, run it, log pass/fail, and `process.exit(1)` on failure. Introducing a real test framework is out of scope for this feature; the smoke tests below match the existing convention.

### Script-style smoke tests

**`src/tests/site-analysis.smoke.test.ts`** — standalone ts-node script that:
1. POSTs to `/api/login` with a known Jafar user's credentials (credentials read from env vars, same pattern as the existing sendgrid tests).
2. Calls `GET /api/jafar-admin/site-analysis?range=30d` with the returned JWT.
3. Asserts the response is HTTP 200.
4. Asserts the payload has the expected top-level keys (`range`, `rangeStart`, `rangeEnd`, `generatedAt`, `kpis`, `trends`, `companies`).
5. Asserts `kpis` contains all 9 expected fields and all are numbers.
6. Asserts `trends.activityPerDay` and `trends.newAccountsPerDay` are arrays with at least 1 entry containing the expected day-bucket keys.
7. Asserts `companies` is an array; if non-empty, the first entry has the expected column fields.
8. Calls the endpoint a second time with `?refresh=true` and asserts `generatedAt` has changed.
9. Calls the endpoint a third time without `refresh` and asserts `cached: true`.
10. Attempts the call with an invalid `range=xyz` and asserts HTTP 400.
11. Attempts the call without a JWT and asserts HTTP 401.
12. Logs pass/fail counts and `process.exit(1)` if any assertion failed.

**`src/tests/login-tracking.smoke.test.ts`** — separate standalone script:
1. Counts rows in `GUARDIAN.USER_LOGIN_EVENTS` via `prisma.$queryRaw`.
2. POSTs to `/api/login` with valid credentials, asserts 200 + valid JWT.
3. Re-counts the table, asserts the count increased by exactly 1.
4. Asserts the new row has the correct `USER_ID` and a recent `LOGIN_AT`.
5. Attempts login with invalid credentials, asserts 401, re-counts table, asserts the count did NOT increase.
6. Exits 0 on success, 1 on any failure.

The fire-and-forget-on-insert-failure behavior cannot be automated without a test runner that supports mocking — it is explicitly covered in the manual verification checklist below (simulate the failure by temporarily breaking the INSERT SQL in a dev copy).

### Manual verification checklist (pre-merge)

- [ ] Log in as Jafar → see new "Site Analysis" tile on AdminDashboard
- [ ] Click tile → dashboard loads within ~2 seconds
- [ ] Toggle through all 5 presets → charts + tables update
- [ ] Click Refresh → `generatedAt` timestamp updates
- [ ] Log in as non-Jafar (role 1 admin) → tile invisible, direct URL `/jafar/site-analysis` blocked with 403
- [ ] Create a new request in another browser tab → click Refresh → counter increments
- [ ] Log in and log out multiple times → verify `USER_LOGIN_EVENTS` rows appear via direct DB query
- [ ] Regression: existing users can still log in normally after `/api/login` change
- [ ] **Fire-and-forget test**: Temporarily break the login-event INSERT (e.g., misspell the table name in a dev copy). Verify login still succeeds and returns a valid JWT. Verify the error is logged to the console. Revert.
- [ ] Run Jafar purge preview → confirm login events appear in the count
- [ ] Run Jafar purge on a throwaway test user → verify login events are deleted
- [ ] Run all three server files locally (`bun server.cjs`, `node server.js`, and the production-test script) → verify endpoint works on each
- [ ] Run both smoke test scripts → both exit 0

### What is NOT tested

- **No unit tests or component tests** — project has no test runner. Smoke tests + manual checklist are the coverage. Adding Vitest/RTL is its own project, deferred.
- **No E2E Playwright test** — `design-review-agent` available for deeper visual QA on request.
- **No load/performance testing** — irrelevant at current data volumes; revisit if slowness is reported.
- **No fuzz testing of the `range` param** — simple allowlist validation is sufficient.

## Open follow-ups (explicitly deferred)

- **Company drill-down page**: `/jafar/site-analysis/company/:id` with per-company time-series, top active users, request type breakdown. Defer until MVP usage surfaces specific questions.
- **Custom date range picker**: replaces preset buttons with a `DateRangePicker`, endpoint accepts `?from=&to=`. Low priority; presets cover common cases.
- **CSV/PDF export**: Hook the company breakdown table into the existing `ExportPage` infrastructure.
- **Nightly aggregation table**: Only if the live dashboard becomes slow, which will not happen at current volumes.
- **Per-user timezone**: Only if the UTC footnote proves confusing to actual Jafar users.
- **Total attachment storage bytes**: Requires a new `FILE_SIZE_BYTES` column on `GUARDIAN.ATTACHMENTS` (populated on insert). Add if Jafar actually asks how much storage the platform is consuming.

## References

- Existing Jafar tooling: `src/pages/JafarAdministration.tsx`, `server/routes/jafar-admin.ts`, `server/middleware/requireJafar.ts`, `server/services/jafarPurge.ts`
- Existing data grid pattern: `src/components/TaskTable.tsx`
- Schema: `prisma/schema.prisma` — `USERS`, `COMPANY`, `REQUESTS`, `TASKS`, `FORMS`, `ATTACHMENTS`
- Multi-server sync rule: `CLAUDE.md` § "Multi-Server Synchronization Protocol"
