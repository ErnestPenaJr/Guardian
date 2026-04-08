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

### New surface

**Backend:**
- `GET /api/jafar-admin/site-analysis?range=<preset>&refresh=<bool>` — single endpoint returning the full payload. Mounted under the existing `jafar-admin` router, which already applies `requireAuth` + `requireJafar` globally.
- `server/services/siteAnalysis.ts` — orchestration: resolves the range window, checks the cache, runs aggregation queries in parallel via `Promise.all`, assembles the payload, writes the cache, returns.
- `server/services/siteAnalysisQueries.ts` — raw SQL query builders, one function per metric. Isolating them makes the queries independently testable and keeps the orchestrator readable.
- In-memory cache: `Map<RangePreset, { data: SiteAnalysisPayload; cachedAt: number }>` inlined into `siteAnalysis.ts`. 5-minute TTL. `getCached`, `setCached`, `invalidate` helpers. Process-local (no Redis — single-user Jafar dashboard, no horizontal scaling concerns).

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

  USER      USERS     @relation(fields: [USER_ID], references: [USER_ID], onDelete: Cascade)

  @@index([LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_LOGIN_AT")
  @@index([USER_ID, LOGIN_AT], map: "IX_USER_LOGIN_EVENTS_USER_LOGIN_AT")
  @@map("USER_LOGIN_EVENTS")
  @@schema("GUARDIAN")
}
```

- **Why a table, not a `LAST_LOGIN_DATE` column on `USERS`**: the "Logins per day" trend chart needs event history. A single column cannot power a time-series. The table is the minimum data structure that satisfies both the "Recently Active Users" KPI and the logins trend chart.
- **Indexes**: `LOGIN_AT` for fast range-based aggregation; `(USER_ID, LOGIN_AT)` for per-user lookups (not used in MVP but costs nothing to add now).
- **Cascade**: `ON DELETE CASCADE` from `USERS` so row cleanup is automatic. The existing `jafarPurge` service also explicitly enumerates this table for its count preview and delete chain.
- **Migration**: Generated via `prisma migrate dev`, then manually applied to staging and production per the existing SQL Server deployment flow.

## API contract

### Endpoint

```
GET /api/jafar-admin/site-analysis?range=<preset>&refresh=<bool>
```

**Auth**: `requireAuth` (valid JWT) + `requireJafar` (role ID 6). Inherited from the parent `jafar-admin` router.

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

1. **Backend route**: `requireAuth` + `requireJafar` middleware (reused from existing `jafar-admin` router; no new middleware needed)
2. **Frontend route**: New `<RequireJafar>` guard wrapping the `/jafar/site-analysis` route (extracted from existing `JafarAdministration` duplication)
3. **Frontend nav**: AdminDashboard tile only rendered when `isJafarUser()` returns true

The `<RequireJafar>` extraction is included in MVP scope because we now have two Jafar pages; avoiding a third duplication of the role check is a small, focused refactor that serves the current goal. Both `JafarAdministration.tsx` (lines 78–80) and the new `SiteAnalysis.tsx` will use it.

## Testing plan

### Backend unit tests

**`server/services/siteAnalysis.test.ts`:**
- `resolveRange('7d')` returns a window 7 days before now
- `resolveRange('all')` returns epoch-start as `rangeStart`
- Cache hit returns identical payload with `cached: true`
- Cache miss computes fresh payload with `cached: false`
- `invalidate('30d')` forces recomputation on next call
- Expired cache entry triggers recomputation
- One failing query causes `Promise.all` to reject with a descriptive error (no partial payloads)

**`server/services/siteAnalysisQueries.test.ts`** (against a seeded test DB fixture of 3 companies, ~10 users, ~20 requests, some login events):
- KPI totals match hand-counted fixture values
- `requestsInRange` respects the range boundary (events outside the window excluded)
- Trend queries return one row per day in range (including zero-activity days)
- Company breakdown sorted DESC by `requestsInRange`
- `percentOfPlatformRequests` sums to ~100% across all companies (accounting for rounding)
- Custom templates count excludes `COMPANY_ID IS NULL` global templates

### Backend integration tests

**`server/routes/siteAnalysis.test.ts`:**
- No auth → 401
- Valid JWT but role ≠ 6 → 403
- Valid Jafar JWT → 200 with well-formed payload
- Invalid `range` param → 400 `{ error: "Invalid range preset" }`
- `refresh=true` bypasses cache (second call has different `generatedAt`)

**`server/services/jafarPurge.test.ts`** (regression):
- Previewing a user purge now includes `userLoginEvents` count
- Executing a user purge deletes their login events
- Previewing a company purge sums login events across all company users
- Executing a company purge cascades login events cleanly

**`/api/login` login tracking** (highest-risk change):
- Successful login creates a `USER_LOGIN_EVENTS` row with correct `USER_ID` and recent `LOGIN_AT`
- Successful login returns the same JWT shape as before (regression check)
- **DB insert failure does not block login** — mock insert to throw, verify login still returns 200 with valid token, verify error is logged to console. **Critical test.**
- Failed password login does NOT create a login event

### Frontend tests

**`src/pages/SiteAnalysis.test.tsx`** (React Testing Library):
- Loading state renders skeleton while fetch is pending
- Success state renders all three sections from a mocked payload
- Error state renders `<ErrorBanner>` with retry; retry re-fires fetch
- Range switch triggers new fetch with new query param
- Refresh button hits endpoint with `?refresh=true`
- Mid-fetch range switch aborts previous fetch; new fetch wins
- Empty payload renders empty states without crashing
- Non-Jafar user redirected away (`<RequireJafar>` test)

### Manual verification checklist (pre-merge)

- [ ] Log in as Jafar → see new "Site Analysis" tile on AdminDashboard
- [ ] Click tile → dashboard loads within ~2 seconds
- [ ] Toggle through all 5 presets → charts + tables update
- [ ] Click Refresh → `generatedAt` timestamp updates
- [ ] Log in as non-Jafar (role 1 admin) → tile invisible, direct URL `/jafar/site-analysis` blocked
- [ ] Create a new request in another browser tab → click Refresh → counter increments
- [ ] Log in and log out multiple times → verify `USER_LOGIN_EVENTS` rows appear
- [ ] Regression: existing users can still log in normally after `/api/login` change
- [ ] Run Jafar purge preview → confirm login events appear in the count
- [ ] Run all three server files locally (`server.cjs`, `node server.js`) and verify endpoint works on each

### What is NOT tested

- No E2E Playwright test — component tests + manual checklist cover the same ground; `design-review-agent` available for deeper visual QA on request
- No load/performance testing — irrelevant at current data volumes; revisit if slowness reported
- No fuzz testing of the `range` param — simple allowlist validation is sufficient

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
