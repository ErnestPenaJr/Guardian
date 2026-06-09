# Security Report (Jafar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Jafar-only page at `/jafar/security-report` that renders the latest `.gstack/security-reports/*.json` audit, with a history dropdown, filterable findings, and Copy Recommendation / Copy Playbook per finding. Add a 5th Jafar tile on the Admin Dashboard to reach it.

**Architecture:** Three read-only Express routes under `/api/jafar-admin/security-reports/*` added inline in all three legacy server files (`server.cjs`, `server-production.js`, `server.js`), gated by the existing `getAuthenticatedUserCompany, checkJafarRole` middleware chain. File access is constrained to `.gstack/security-reports/` with a strict filename regex and resolved-path prefix check. React page `src/pages/SecurityReport.tsx` composed of small focused components, reached via a new "Security Report" tile on `AdminDashboard` that mirrors the "Role Access Matrix" tile.

**Tech Stack:** Express (legacy inline routes in `.cjs`/`.js`), Node `fs.promises` + `path`, React 18 + TypeScript, Tailwind + Guardian palette (no new UI library), react-router-dom v7, react-toastify.

---

## Context notes for the engineer

Read these before starting — they explain decisions that will otherwise look wrong.

1. **`server.cjs` is the source of truth for API logic.** The TypeScript `server/` tree exists but is NOT mounted in the running servers. New Jafar routes go inline in `server.cjs`, then are copy-synced to `server-production.js` and `server.js`. See commit `3d643b1 feat: ... consolidate routing to server.cjs`.

2. **Multi-server sync rule.** Per `CLAUDE.md`, any endpoint change MUST land in all three server files. Tasks 3–5 enforce this.

3. **Middleware pattern.** Existing Jafar routes use `app.get('/api/jafar-admin/...', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {...})`. `checkJafarRole` is defined inline at `server.cjs:14401`. Do NOT use `requireAuth`/`requireJafar` from `server/middleware/` — that belongs to the unused TS tree.

4. **`.gstack/` must NEVER ship to production.** The security reports contain live exploit payloads. Handlers gracefully return empty responses when the directory is missing, and Task 11 adds `.gstack/` to `.gitignore`. The already-tracked `2026-04-23-070810.json` is left in place — git-history scrubbing is a separate remediation.

5. **No test runner is installed.** `package.json` has no `"test"` script and no `vitest`/`jest`. Smoke tests are standalone `ts-node`/`bun` scripts following the pattern in `src/tests/site-analysis.smoke.test.ts` — they import code (or hit the live server), run it, and `process.exit(1)` on failure. Do NOT introduce a test framework.

6. **Never log the parsed report JSON.** The payload contains live exploit strings (path-traversal payloads, SQLi payloads, hardcoded JWT fallbacks). Finding #10 in the report explicitly flags log exfil as a risk. Handlers log only status/metadata.

7. **Home vs App route wiring.** The existing Jafar pages are reached two ways:
   - Admin Dashboard tile → `Home.tsx` sets `selectedSection='jafar…'` → inline render in Home.
   - Standalone `/jafar/*` route in `App.tsx` wrapped with `<RequireJafar>`.
   Both are needed. Task 9 updates `Home.tsx`, Task 10 updates `App.tsx`.

8. **Spec.** The approved design spec lives at `docs/superpowers/specs/2026-04-23-security-report-jafar-design.md`. Every task maps back to a section in that spec.

---

## File structure

### Files to create

**Frontend types:**
- `src/components/SecurityReport/types.ts` — shared TS types for the report payload and summary.

**Frontend components:**
- `src/components/SecurityReport/SummaryCards.tsx` — four stat cards (Critical / High / Medium / New since last scan).
- `src/components/SecurityReport/AttackSurfacePanel.tsx` — collapsible panel for `attack_surface.code` + `.infrastructure`.
- `src/components/SecurityReport/SupplyChainPanel.tsx` — collapsible panel for `supply_chain_summary`.
- `src/components/SecurityReport/FindingsToolbar.tsx` — severity filter chips + search + expand/collapse all.
- `src/components/SecurityReport/FindingCard.tsx` — single finding, collapsed by default, with Copy buttons.

**Frontend page:**
- `src/pages/SecurityReport.tsx` — page component with fetch, dropdown, state, error handling.

**Tests:**
- `src/tests/security-report.smoke.test.ts` — standalone script that logs in as Jafar and hits the three endpoints.

### Files to modify

**Backend (same edits applied to all three):**
- `server.cjs` — add base dir constant, filename regex, `listReportFilenames`, `readReport` helpers, and three route handlers.
- `server-production.js` — same.
- `server.js` — same.

**Frontend:**
- `src/App.tsx` — add `/jafar/security-report` route guarded by `RequireJafar`.
- `src/pages/AdminDashboard.tsx` — add "Security Report" tile + `onShowJafarSecurityReport` prop.
- `src/pages/Home.tsx` — add `selectedSection='jafarSecurityReport'` branch + callback wiring + import.

**Repo hygiene:**
- `.gitignore` — add `.gstack/` so future scan artifacts stay out of git.

---

## Task 1: Shared TypeScript types

**Files:**
- Create: `src/components/SecurityReport/types.ts`

- [ ] **Step 1: Create the types file**

Create `src/components/SecurityReport/types.ts` with exactly this content:

```typescript
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Totals {
    critical: number;
    high: number;
    medium: number;
    tentative: number;
}

export interface Trend {
    prior_report_date: string | null;
    resolved: number;
    persistent: number;
    new: number;
    direction: 'first_run' | 'improving' | 'degrading' | 'flat';
}

export interface SecurityFinding {
    id: number;
    severity: Severity;
    confidence: number;
    status: string;
    phase: number;
    phase_name: string;
    category: string;
    fingerprint: string;
    title: string;
    file: string;
    line: number;
    commit?: string;
    description: string;
    exploit_scenario: string;
    impact: string;
    recommendation: string;
    playbook: string;
    verification: string;
}

export interface AttackSurfaceCode {
    total_routes: number;
    authed_via_middleware: number;
    unauth_mutating_routes: number;
    requirePermission_uses: number;
    requireJafar_uses: number;
    file_upload_points: number;
    admin_routes: number;
}

export interface AttackSurfaceInfra {
    ci_workflows: number;
    duplicate_pipelines_deploying_to_same_app: boolean;
    container_configs: number;
    iac_configs: number;
    deploy_targets: string[];
    secret_management: string;
}

export interface SupplyChainSummary {
    direct_deps: number;
    dev_deps: number;
    transitive_deps_total: number;
    critical_cves: number;
    high_cves: number;
    moderate_cves: number;
    low_cves: number;
    install_scripts_in_prod_deps: string;
    lockfile_present: boolean;
    lockfile_tracked: boolean;
    tools_skipped: string[];
}

export interface SecurityReport {
    version: string;
    date: string;
    mode: string;
    scope: string;
    diff_mode: boolean;
    phases_run: number[];
    attack_surface: {
        code: AttackSurfaceCode;
        infrastructure: AttackSurfaceInfra;
    };
    findings: SecurityFinding[];
    supply_chain_summary: SupplyChainSummary;
    filter_stats: Record<string, number>;
    totals: Totals;
    trend: Trend;
}

export interface SecurityReportSummary {
    filename: string;
    date: string;
    mode: string;
    scope: string;
    totals: Totals;
    trend: Trend;
}

export interface SecurityReportListResponse {
    reports: SecurityReportSummary[];
}
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors referring to this new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/SecurityReport/types.ts
git commit -m "feat(security-report): add shared TypeScript types for report payload"
```

---

## Task 2: Backend helpers + three endpoints in `server.cjs`

**Files:**
- Modify: `server.cjs` (add near the existing `/api/jafar-admin/*` routes, after `server.cjs:~15596`)

- [ ] **Step 1: Open `server.cjs` and locate the insertion point**

Find the closing brace of the last Jafar route before the next route group. Search for the string `/api/jafar-admin/jafar-users` — the new routes go AFTER the last handler in that block, before the next section. Confirm the insertion site is below an existing `/api/jafar-admin/*` handler's closing `});` and above the next `app.get/post/put/delete` line.

- [ ] **Step 2: Add the helpers and three route handlers**

Insert this block at the insertion point identified in Step 1:

```javascript
// ========================================
// SECURITY REPORT ENDPOINTS (Jafar only)
// Reads scan reports produced by `gstack cso` from .gstack/security-reports/.
// The directory is intentionally NOT deployed to production — handlers return
// empty/404 when the directory is missing. Never log parsed report bodies —
// they contain live exploit payloads (see Finding #10 in the scan report).
// ========================================

const SECURITY_REPORTS_DIR = path.resolve(process.cwd(), '.gstack/security-reports');
const SECURITY_REPORT_FILENAME_RE = /^\d{4}-\d{2}-\d{2}-\d{6}\.json$/;

const listSecurityReportFilenames = async () => {
    try {
        const entries = await fs.promises.readdir(SECURITY_REPORTS_DIR);
        return entries
            .filter((name) => SECURITY_REPORT_FILENAME_RE.test(name))
            .sort()
            .reverse(); // newest first
    } catch (err) {
        if (err && err.code === 'ENOENT') return [];
        throw err;
    }
};

const readSecurityReport = async (filename) => {
    if (!SECURITY_REPORT_FILENAME_RE.test(filename)) {
        const e = new Error('INVALID_FILENAME');
        e.status = 400;
        throw e;
    }
    const resolved = path.resolve(SECURITY_REPORTS_DIR, filename);
    if (!resolved.startsWith(SECURITY_REPORTS_DIR + path.sep)) {
        const e = new Error('PATH_TRAVERSAL');
        e.status = 400;
        throw e;
    }
    const raw = await fs.promises.readFile(resolved, 'utf8');
    return JSON.parse(raw);
};

const summarizeSecurityReport = (filename, report) => ({
    filename,
    date: report.date,
    mode: report.mode,
    scope: report.scope,
    totals: report.totals,
    trend: report.trend
});

// GET /api/jafar-admin/security-reports — list metadata only, newest first
app.get('/api/jafar-admin/security-reports', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const filenames = await listSecurityReportFilenames();
        const reports = [];
        for (const filename of filenames) {
            try {
                const report = await readSecurityReport(filename);
                reports.push(summarizeSecurityReport(filename, report));
            } catch (err) {
                console.error(`⚠️  [SECURITY REPORT] Skipping malformed file ${filename}:`, err && err.message);
            }
        }
        res.json({ reports });
    } catch (err) {
        console.error('❌ [SECURITY REPORT] Failed to list reports:', err && err.message);
        res.status(500).json({ error: 'Failed to list security reports' });
    }
});

// GET /api/jafar-admin/security-reports/latest — full JSON of newest report
app.get('/api/jafar-admin/security-reports/latest', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const filenames = await listSecurityReportFilenames();
        if (filenames.length === 0) {
            return res.status(404).json({ error: 'No reports available' });
        }
        const report = await readSecurityReport(filenames[0]);
        res.json({ filename: filenames[0], report });
    } catch (err) {
        console.error('❌ [SECURITY REPORT] Failed to read latest report:', err && err.message);
        const status = err && err.status ? err.status : 500;
        res.status(status).json({ error: err && err.message === 'INVALID_FILENAME' ? 'Invalid filename' : 'Failed to read report' });
    }
});

// GET /api/jafar-admin/security-reports/:filename — full JSON of a specific report
app.get('/api/jafar-admin/security-reports/:filename', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    const filename = String(req.params.filename || '');
    try {
        const report = await readSecurityReport(filename);
        res.json({ filename, report });
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Report not found' });
        }
        if (err && err.status === 400) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        console.error('❌ [SECURITY REPORT] Failed to read report:', err && err.message);
        res.status(500).json({ error: 'Failed to read report' });
    }
});
```

- [ ] **Step 3: Verify `fs` and `path` are already imported at the top of `server.cjs`**

Run: `grep -n "require('fs')\|require('path')" server.cjs | head -4`

If either is missing, add at the top of the requires block (near existing `const express = require('express');`):

```javascript
const fs = require('fs');
const path = require('path');
```

- [ ] **Step 4: Start the dev server and confirm no startup error**

Start the server per `CLAUDE.md` (with the proper `DATABASE_URL`):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/netlifydb?schema=GUARDIAN&connection_limit=30&pool_timeout=20" bun server.cjs
```

Expected: server prints its usual startup banner and "✅ Database connected successfully" with no syntax errors.

- [ ] **Step 5: Smoke-test the list endpoint with curl**

In a separate terminal, log in as a Jafar user to grab a token (or copy one from your browser's localStorage after a local login), then:

```bash
TOKEN="<your-jafar-jwt>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/jafar-admin/security-reports | head -40
```

Expected: JSON body `{"reports":[{"filename":"2026-04-23-070810.json","date":"2026-04-23T07:08:10Z","mode":"daily","scope":"full","totals":{...},"trend":{...}}]}`.

- [ ] **Step 6: Smoke-test the latest endpoint**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/jafar-admin/security-reports/latest | head -5
```

Expected: `{"filename":"2026-04-23-070810.json","report":{"version":"2.0.0",...`

- [ ] **Step 7: Smoke-test path traversal rejection**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" "http://localhost:3001/api/jafar-admin/security-reports/..%2F..%2F.env"
```

Expected: `400`. This is the defense from the same class as Finding #3 in the report itself.

- [ ] **Step 8: Smoke-test unauth rejection**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/jafar-admin/security-reports
```

Expected: `401` (from `getAuthenticatedUserCompany`).

- [ ] **Step 9: Commit**

```bash
git add server.cjs
git commit -m "feat(security-report): add Jafar-only endpoints in server.cjs

- GET /api/jafar-admin/security-reports
- GET /api/jafar-admin/security-reports/latest
- GET /api/jafar-admin/security-reports/:filename

Strict filename regex + resolved-path prefix check to block
traversal. Returns empty list when .gstack/ is absent (prod case)."
```

---

## Task 3: Sync the same code into `server-production.js`

**Files:**
- Modify: `server-production.js`

- [ ] **Step 1: Copy the helpers + routes block into `server-production.js`**

Find the equivalent insertion point in `server-production.js` (right after the existing Jafar routes — `grep -n "/api/jafar-admin/" server-production.js | tail -1` will point you at the last one). Paste the same block from Task 2 Step 2.

- [ ] **Step 2: Ensure `fs` and `path` are required at the top**

Run: `grep -n "require('fs')\|require('path')" server-production.js | head -4`

If missing, add them at the top of the requires block.

- [ ] **Step 3: Verify the file still parses**

Run: `node --check server-production.js`
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add server-production.js
git commit -m "feat(security-report): sync Jafar security-report endpoints to server-production.js"
```

---

## Task 4: Sync the same code into `server.js`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Copy the helpers + routes block into `server.js`**

Same procedure as Task 3, target file `server.js`. Paste the block from Task 2 Step 2 at the equivalent insertion point.

- [ ] **Step 2: Ensure `fs` and `path` are required at the top**

Run: `grep -n "require('fs')\|require('path')" server.js | head -4`

If missing, add them.

- [ ] **Step 3: Verify the file still parses**

Run: `node --check server.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(security-report): sync Jafar security-report endpoints to server.js"
```

---

## Task 5: Summary cards component

**Files:**
- Create: `src/components/SecurityReport/SummaryCards.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SecurityReport/SummaryCards.tsx`:

```tsx
import React from 'react';
import type { Totals, Trend } from './types';

interface SummaryCardsProps {
    totals: Totals;
    trend: Trend;
}

const Card: React.FC<{ label: string; value: number | string; tone: 'red' | 'orange' | 'yellow' | 'blue' }> = ({ label, value, tone }) => {
    const toneMap = {
        red: 'bg-red-50 border-red-300 text-red-700',
        orange: 'bg-orange-50 border-orange-300 text-orange-700',
        yellow: 'bg-yellow-50 border-yellow-300 text-yellow-700',
        blue: 'bg-blue-50 border-blue-300 text-blue-700'
    } as const;
    return (
        <div className={`rounded-md border p-4 ${toneMap[tone]}`}>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm uppercase tracking-wide mt-1">{label}</div>
        </div>
    );
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ totals, trend }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Critical" value={totals.critical} tone="red" />
            <Card label="High" value={totals.high} tone="orange" />
            <Card label="Medium" value={totals.medium} tone="yellow" />
            <Card label={trend.prior_report_date ? 'New since last scan' : 'First scan'} value={trend.new} tone="blue" />
        </div>
    );
};

export default SummaryCards;
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SecurityReport/SummaryCards.tsx
git commit -m "feat(security-report): add SummaryCards component"
```

---

## Task 6: Collapsible Attack Surface and Supply Chain panels

**Files:**
- Create: `src/components/SecurityReport/AttackSurfacePanel.tsx`
- Create: `src/components/SecurityReport/SupplyChainPanel.tsx`

- [ ] **Step 1: Create `AttackSurfacePanel.tsx`**

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AttackSurfaceCode, AttackSurfaceInfra } from './types';

interface AttackSurfacePanelProps {
    code: AttackSurfaceCode;
    infrastructure: AttackSurfaceInfra;
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono">{value}</span>
    </div>
);

const AttackSurfacePanel: React.FC<AttackSurfacePanelProps> = ({ code, infrastructure }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 p-3 text-left font-semibold hover:bg-gray-50"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Attack Surface
            </button>
            {open && (
                <div className="grid md:grid-cols-2 gap-6 p-4 border-t border-gray-200">
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Code</h4>
                        <Row label="Total routes" value={code.total_routes} />
                        <Row label="Authed via middleware" value={code.authed_via_middleware} />
                        <Row label="Unauth mutating routes" value={code.unauth_mutating_routes} />
                        <Row label="requirePermission uses" value={code.requirePermission_uses} />
                        <Row label="requireJafar uses" value={code.requireJafar_uses} />
                        <Row label="File upload points" value={code.file_upload_points} />
                        <Row label="Admin routes" value={code.admin_routes} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Infrastructure</h4>
                        <Row label="CI workflows" value={infrastructure.ci_workflows} />
                        <Row label="Duplicate pipelines → same app" value={String(infrastructure.duplicate_pipelines_deploying_to_same_app)} />
                        <Row label="Container configs" value={infrastructure.container_configs} />
                        <Row label="IaC configs" value={infrastructure.iac_configs} />
                        <Row label="Deploy targets" value={(infrastructure.deploy_targets || []).join(', ') || '—'} />
                        <Row label="Secret management" value={infrastructure.secret_management} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttackSurfacePanel;
```

- [ ] **Step 2: Create `SupplyChainPanel.tsx`**

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SupplyChainSummary } from './types';

interface SupplyChainPanelProps {
    summary: SupplyChainSummary;
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono">{value}</span>
    </div>
);

const SupplyChainPanel: React.FC<SupplyChainPanelProps> = ({ summary }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 p-3 text-left font-semibold hover:bg-gray-50"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Supply Chain
            </button>
            {open && (
                <div className="grid md:grid-cols-2 gap-6 p-4 border-t border-gray-200">
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Dependencies</h4>
                        <Row label="Direct" value={summary.direct_deps} />
                        <Row label="Dev" value={summary.dev_deps} />
                        <Row label="Transitive (total)" value={summary.transitive_deps_total} />
                        <Row label="Lockfile present" value={String(summary.lockfile_present)} />
                        <Row label="Lockfile tracked" value={String(summary.lockfile_tracked)} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">CVEs</h4>
                        <Row label="Critical" value={summary.critical_cves} />
                        <Row label="High" value={summary.high_cves} />
                        <Row label="Moderate" value={summary.moderate_cves} />
                        <Row label="Low" value={summary.low_cves} />
                        <Row label="Install scripts" value={summary.install_scripts_in_prod_deps} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplyChainPanel;
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SecurityReport/AttackSurfacePanel.tsx src/components/SecurityReport/SupplyChainPanel.tsx
git commit -m "feat(security-report): add AttackSurfacePanel and SupplyChainPanel"
```

---

## Task 7: FindingCard with Copy buttons

**Files:**
- Create: `src/components/SecurityReport/FindingCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SecurityReport/FindingCard.tsx`:

```tsx
import React from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import type { SecurityFinding, Severity } from './types';

interface FindingCardProps {
    finding: SecurityFinding;
    expanded: boolean;
    onToggle: () => void;
}

const severityStyles: Record<Severity | 'UNKNOWN', string> = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-green-100 text-green-800 border-green-300',
    UNKNOWN: 'bg-gray-100 text-gray-700 border-gray-300'
};

const severityClass = (sev: string): string => {
    if (sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW') {
        return severityStyles[sev];
    }
    return severityStyles.UNKNOWN;
};

const copyToClipboard = async (label: string, text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    } catch {
        toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
};

const Section: React.FC<{ label: string; body: string; copyLabel?: string }> = ({ label, body, copyLabel }) => (
    <div className="mt-3">
        <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h5>
            {copyLabel && (
                <button
                    type="button"
                    onClick={() => copyToClipboard(copyLabel, body)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                    <Copy className="h-3 w-3" /> Copy {copyLabel.toLowerCase()}
                </button>
            )}
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{body}</p>
    </div>
);

const FindingCard: React.FC<FindingCardProps> = ({ finding, expanded, onToggle }) => {
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50"
            >
                {expanded ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${severityClass(finding.severity)}`}>
                            {finding.severity}
                        </span>
                        <span className="text-xs text-gray-600">{finding.confidence}/10</span>
                        <span className="text-xs text-gray-600">· {finding.status}</span>
                        <span className="text-xs text-gray-600">· {finding.category}</span>
                    </div>
                    <div className="mt-1 font-semibold text-gray-900">{finding.title}</div>
                    <div className="text-xs font-mono text-gray-500 mt-0.5">
                        {finding.file}{finding.line ? `:${finding.line}` : ''}
                    </div>
                </div>
            </button>
            {expanded && (
                <div className="p-4 border-t border-gray-200">
                    <Section label="Description" body={finding.description} />
                    <Section label="Exploit scenario" body={finding.exploit_scenario} />
                    <Section label="Impact" body={finding.impact} />
                    <Section label="Recommendation" body={finding.recommendation} copyLabel="Recommendation" />
                    <Section label="Playbook" body={finding.playbook} copyLabel="Playbook" />
                    <Section label="Verification" body={finding.verification} />
                    {finding.commit && (
                        <div className="mt-3 text-xs text-gray-500 font-mono">commit: {finding.commit}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FindingCard;
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SecurityReport/FindingCard.tsx
git commit -m "feat(security-report): add FindingCard with Copy Recommendation/Playbook"
```

---

## Task 8: FindingsToolbar (filter + search + expand controls)

**Files:**
- Create: `src/components/SecurityReport/FindingsToolbar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SecurityReport/FindingsToolbar.tsx`:

```tsx
import React from 'react';
import { Search } from 'lucide-react';
import type { Severity } from './types';

export type SeverityFilter = 'ALL' | Severity;

interface FindingsToolbarProps {
    severity: SeverityFilter;
    onSeverityChange: (sev: SeverityFilter) => void;
    search: string;
    onSearchChange: (value: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    resultCount: number;
    totalCount: number;
}

const filters: Array<{ value: SeverityFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' }
];

const FindingsToolbar: React.FC<FindingsToolbarProps> = ({
    severity, onSeverityChange, search, onSearchChange,
    onExpandAll, onCollapseAll, resultCount, totalCount
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => onSeverityChange(f.value)}
                        className={`text-xs px-3 py-1 rounded-full border ${
                            severity === f.value
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
                <span className="text-xs text-gray-500 ml-2">
                    {resultCount} of {totalCount}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search title, file, category..."
                        className="text-sm pl-8 pr-3 py-1.5 border border-gray-300 rounded-md w-64"
                    />
                </div>
                <button
                    type="button"
                    onClick={onExpandAll}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Expand all
                </button>
                <button
                    type="button"
                    onClick={onCollapseAll}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Collapse all
                </button>
            </div>
        </div>
    );
};

export default FindingsToolbar;
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SecurityReport/FindingsToolbar.tsx
git commit -m "feat(security-report): add FindingsToolbar (filter, search, expand)"
```

---

## Task 9: SecurityReport page component

**Files:**
- Create: `src/pages/SecurityReport.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/SecurityReport.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import SummaryCards from '../components/SecurityReport/SummaryCards';
import AttackSurfacePanel from '../components/SecurityReport/AttackSurfacePanel';
import SupplyChainPanel from '../components/SecurityReport/SupplyChainPanel';
import FindingsToolbar, { type SeverityFilter } from '../components/SecurityReport/FindingsToolbar';
import FindingCard from '../components/SecurityReport/FindingCard';
import type {
    SecurityReport as SecurityReportPayload,
    SecurityReportSummary,
    SecurityReportListResponse
} from '../components/SecurityReport/types';

interface FullReportResponse {
    filename: string;
    report: SecurityReportPayload;
}

const SecurityReport: React.FC = () => {
    const [reports, setReports] = useState<SecurityReportSummary[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [report, setReport] = useState<SecurityReportPayload | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    const [severity, setSeverity] = useState<SeverityFilter>('ALL');
    const [search, setSearch] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const fetchList = useCallback(async () => {
        setLoadingList(true);
        setListError(null);
        try {
            const { data } = await api.get<SecurityReportListResponse>('/api/jafar-admin/security-reports');
            setReports(data.reports || []);
            if (data.reports && data.reports.length > 0) {
                setSelected(data.reports[0].filename);
            } else {
                setSelected(null);
                setReport(null);
            }
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load security reports';
            setListError(message);
        } finally {
            setLoadingList(false);
        }
    }, []);

    const fetchReport = useCallback(async (filename: string) => {
        setLoadingReport(true);
        try {
            const url = filename === reports[0]?.filename
                ? '/api/jafar-admin/security-reports/latest'
                : `/api/jafar-admin/security-reports/${encodeURIComponent(filename)}`;
            const { data } = await api.get<FullReportResponse>(url);
            setReport(data.report);
            setExpandedIds(new Set());
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load report';
            toast.error(message);
        } finally {
            setLoadingReport(false);
        }
    }, [reports]);

    useEffect(() => { void fetchList(); }, [fetchList]);
    useEffect(() => { if (selected) void fetchReport(selected); }, [selected, fetchReport]);

    const filteredFindings = useMemo(() => {
        if (!report) return [];
        const q = search.trim().toLowerCase();
        return report.findings.filter((f) => {
            if (severity !== 'ALL' && f.severity !== severity) return false;
            if (!q) return true;
            return (
                f.title.toLowerCase().includes(q) ||
                (f.file || '').toLowerCase().includes(q) ||
                (f.category || '').toLowerCase().includes(q)
            );
        });
    }, [report, severity, search]);

    const toggleFinding = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        if (!report) return;
        setExpandedIds(new Set(filteredFindings.map((f) => f.id)));
    };
    const collapseAll = () => setExpandedIds(new Set());

    if (loadingList) {
        return <div className="container mx-auto py-6">Loading security reports...</div>;
    }

    if (listError) {
        return (
            <div className="container mx-auto py-6">
                <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
                    <div className="font-semibold mb-1">Failed to load reports</div>
                    <div className="text-sm">{listError}</div>
                    <button
                        type="button"
                        onClick={() => void fetchList()}
                        className="mt-2 text-sm underline"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="container mx-auto py-6">
                <div className="rounded-md border border-gray-300 bg-gray-50 p-6 text-gray-700">
                    <div className="font-semibold mb-1">No security reports available</div>
                    <div className="text-sm">
                        No security reports are available on this environment. Run <code className="font-mono">gstack cso</code> locally to generate one.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Security Report</h1>
                    {report && (
                        <div className="text-sm text-gray-500 mt-1">
                            <span className="font-mono">{report.mode}</span> · <span className="font-mono">{report.scope}</span> · version {report.version}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selected ?? ''}
                        onChange={(e) => setSelected(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                        disabled={loadingReport}
                    >
                        {reports.map((r) => (
                            <option key={r.filename} value={r.filename}>
                                {r.date} ({r.filename})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </button>
                </div>
            </div>

            {loadingReport && <div className="text-sm text-gray-500">Loading report...</div>}

            {report && (
                <>
                    <SummaryCards totals={report.totals} trend={report.trend} />
                    <AttackSurfacePanel code={report.attack_surface.code} infrastructure={report.attack_surface.infrastructure} />
                    <SupplyChainPanel summary={report.supply_chain_summary} />

                    <div className="space-y-3">
                        <FindingsToolbar
                            severity={severity}
                            onSeverityChange={setSeverity}
                            search={search}
                            onSearchChange={setSearch}
                            onExpandAll={expandAll}
                            onCollapseAll={collapseAll}
                            resultCount={filteredFindings.length}
                            totalCount={report.findings.length}
                        />
                        {filteredFindings.map((f) => (
                            <FindingCard
                                key={f.id}
                                finding={f}
                                expanded={expandedIds.has(f.id)}
                                onToggle={() => toggleFinding(f.id)}
                            />
                        ))}
                        {filteredFindings.length === 0 && (
                            <div className="text-sm text-gray-500 py-4">No findings match the current filters.</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SecurityReport;
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SecurityReport.tsx
git commit -m "feat(security-report): add SecurityReport page with filter/search/dropdown"
```

---

## Task 10: Admin Dashboard tile + Home.tsx wiring + App.tsx route

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the prop and tile to `AdminDashboard.tsx`**

In `src/pages/AdminDashboard.tsx`, update the component props (around line 21-27):

Change:
```tsx
const AdminDashboard: React.FC<{
  onShowUserManagement?: () => void;
  onShowJafarAdministration?: () => void;
  onShowJafarSiteAnalysis?: () => void;
  onShowJafarUserManagement?: () => void;
  onShowJafarRoleSettings?: () => void;
}> = ({ onShowUserManagement, onShowJafarAdministration, onShowJafarSiteAnalysis, onShowJafarUserManagement, onShowJafarRoleSettings }) => {
```

To:
```tsx
const AdminDashboard: React.FC<{
  onShowUserManagement?: () => void;
  onShowJafarAdministration?: () => void;
  onShowJafarSiteAnalysis?: () => void;
  onShowJafarUserManagement?: () => void;
  onShowJafarRoleSettings?: () => void;
  onShowJafarSecurityReport?: () => void;
}> = ({ onShowUserManagement, onShowJafarAdministration, onShowJafarSiteAnalysis, onShowJafarUserManagement, onShowJafarRoleSettings, onShowJafarSecurityReport }) => {
```

- [ ] **Step 2: Add the "Security Report" tile to `AdminDashboard.tsx`**

Find the "Role Access Matrix" tile (the block beginning with the comment-free `{isJafarUser() && (` closest to the text `Role Access Matrix` — around line 266-286). Immediately AFTER that tile's closing `)}`, add the new Jafar tile:

```tsx
        {isJafarUser() && (
          <a
            href="#"
            className="bg-white shadow-sm p-6 flex flex-col items-center transition-colors duration-200 border border-gray-200 border-t-4 border-t-danger"
            style={{ borderRadius: '6px', backgroundColor: '#FFFFFF' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            onClick={e => {
              e.preventDefault();
              if (onShowJafarSecurityReport) onShowJafarSecurityReport();
            }}
          >
            <FaUserShield className="h-12 w-12 text-danger mb-4" />
            <h3 className="text-lg font-semibold mb-2">Security Report</h3>
            <ul className="text-gray-600">
              <li>Latest gstack cso scan</li>
              <li>Critical/High/Medium findings</li>
              <li>Exploit scenarios & remediations</li>
            </ul>
          </a>
        )}
```

- [ ] **Step 3: Wire the new section in `Home.tsx`**

In `src/pages/Home.tsx`:

a) Add the import near the other Jafar page imports (near line ~33-34 where `JafarAdministration` and `SiteAnalysis` are imported):

```tsx
import SecurityReport from './SecurityReport';
```

b) Update the `selectedSection` union type at line ~121 to include `'jafarSecurityReport'`:

Change:
```tsx
const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'jafarAdministration' | 'jafarUserManagement' | 'jafarRoleSettings' | 'jafarSiteAnalysis' | 'apiManager' | 'notices' | 'workspaces'>('dashboard');
```

To:
```tsx
const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'jafarAdministration' | 'jafarUserManagement' | 'jafarRoleSettings' | 'jafarSiteAnalysis' | 'jafarSecurityReport' | 'apiManager' | 'notices' | 'workspaces'>('dashboard');
```

c) Pass the new prop when rendering `<AdminDashboard />` (around line 1887-1895). Change:

```tsx
<AdminDashboard
  onShowUserManagement={() => setSelectedSection('adminUserManagement')}
  onShowJafarAdministration={() => setSelectedSection('jafarAdministration')}
  onShowJafarSiteAnalysis={() => setSelectedSection('jafarSiteAnalysis')}
  onShowJafarUserManagement={() => setSelectedSection('jafarUserManagement')}
  onShowJafarRoleSettings={() => setSelectedSection('jafarRoleSettings')}
/>
```

To:

```tsx
<AdminDashboard
  onShowUserManagement={() => setSelectedSection('adminUserManagement')}
  onShowJafarAdministration={() => setSelectedSection('jafarAdministration')}
  onShowJafarSiteAnalysis={() => setSelectedSection('jafarSiteAnalysis')}
  onShowJafarUserManagement={() => setSelectedSection('jafarUserManagement')}
  onShowJafarRoleSettings={() => setSelectedSection('jafarRoleSettings')}
  onShowJafarSecurityReport={() => setSelectedSection('jafarSecurityReport')}
/>
```

d) Add the render branch after the existing `jafarRoleSettings` branch (around line 1913-1916). After:

```tsx
) : selectedSection === 'jafarRoleSettings' ? (
  <div className="mt-4 md:mt-6 mb-6">
    <JafarRoleSettings />
  </div>
```

Add:

```tsx
) : selectedSection === 'jafarSecurityReport' ? (
  <div className="mt-4 md:mt-6 mb-6">
    <SecurityReport />
  </div>
```

- [ ] **Step 4: Add the standalone route in `App.tsx`**

In `src/App.tsx`, add the import near the other page imports (around line 34):

```tsx
import SecurityReport from './pages/SecurityReport';
```

Then add a new `<Route>` next to the existing `/jafar/site-analysis` route (around line 84):

```tsx
<Route path="/jafar/security-report" element={<ProtectedRoute><RequireJafar><SecurityReport /></RequireJafar></ProtectedRoute>} />
```

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Start both servers:

```bash
# terminal 1
DATABASE_URL="postgresql://USER:PASSWORD@HOST/netlifydb?schema=GUARDIAN&connection_limit=30&pool_timeout=20" bun server.cjs
# terminal 2
bun run dev
```

Log in as a Jafar user. Navigate to Admin Dashboard. Confirm:

1. A new "Security Report" tile appears beside "Role Access Matrix" (only for Jafar users).
2. Clicking it renders the report page with the severity counts (6 Critical, 9 High, 3 Medium, 18 New).
3. The dropdown lists `2026-04-23-070810.json`.
4. Attack Surface and Supply Chain panels expand/collapse.
5. Severity filter narrows the list; search box narrows by title/file/category.
6. Clicking a finding expands it; Copy Recommendation / Copy Playbook toast and populate clipboard.
7. Navigating directly to `/jafar/security-report` also works.
8. Log out and back in as a non-Jafar user — the tile does NOT appear, and direct navigation to `/jafar/security-report` redirects to `/home`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminDashboard.tsx src/pages/Home.tsx src/App.tsx
git commit -m "feat(security-report): wire Admin Dashboard tile, Home section, and /jafar/security-report route"
```

---

## Task 11: Add `.gstack/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Inspect current `.gitignore`**

Run: `grep -n "gstack" .gitignore || echo "NOT PRESENT"`
Expected: `NOT PRESENT`.

- [ ] **Step 2: Append the entry**

Open `.gitignore` and append (at the end of the file):

```
# gstack security scan artifacts — contain live exploit payloads, MUST NOT ship to production
.gstack/
```

- [ ] **Step 3: Verify the already-tracked report is still tracked (we deliberately do not remove it)**

Run: `git ls-files .gstack/security-reports/ | head -5`
Expected: still lists `2026-04-23-070810.json` (tracked files are unaffected by `.gitignore` additions).

- [ ] **Step 4: Verify new reports would be ignored**

Run:

```bash
touch .gstack/security-reports/9999-99-99-999999.json
git status --porcelain .gstack/
rm .gstack/security-reports/9999-99-99-999999.json
```

Expected: `git status` shows NO entries for the dummy file (it was ignored).

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .gstack/ so future scan artifacts don't land in the repo"
```

---

## Task 12: Confirm `.gstack/` is not bundled into deployment

**Files:**
- Read-only: `azure-pipelines.yml`, `azure-pipelines-staging.yml`, `web.config`

- [ ] **Step 1: Audit the pipeline copy steps**

Run:

```bash
grep -nE "cp -r|cp -R|CopyFiles|rsync|zip" azure-pipelines.yml azure-pipelines-staging.yml
```

Review each match. For any step that copies files into `deployment/` or builds the deploy zip, confirm either:
- The source is a specific subtree (e.g., `dist/`, `src/`, `prisma/`) that does NOT include `.gstack/`, OR
- The step has an explicit exclude for `.gstack/` or all dotfiles.

- [ ] **Step 2: If any step uses a broad copy that would include `.gstack/`, add an exclude**

Example patch for a line like `cp -r . deployment/`:

```yaml
# BEFORE
- script: cp -r . deployment/
# AFTER
- script: |
    rsync -a --exclude='.gstack/' --exclude='.git/' ./ deployment/
```

If no broad copy exists (all copies are specific subtrees), skip this step.

- [ ] **Step 3: Verify `web.config` does not expose `.gstack/`**

Run: `grep -n "gstack" web.config || echo "NOT REFERENCED"`
Expected: `NOT REFERENCED`.

- [ ] **Step 4: Commit (only if pipeline edits were made)**

If Step 2 modified pipeline YAML:

```bash
git add azure-pipelines.yml azure-pipelines-staging.yml
git commit -m "ops: exclude .gstack/ from deployment copy steps"
```

If no changes were needed, skip this commit.

---

## Task 13: Backend smoke test

**Files:**
- Create: `src/tests/security-report.smoke.test.ts`

- [ ] **Step 1: Create the test script**

Create `src/tests/security-report.smoke.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the smoke test**

With the dev server running (see Task 2 Step 4), run:

```bash
TEST_API_BASE=http://localhost:3001 \
TEST_JAFAR_EMAIL=<your-jafar-email> \
TEST_JAFAR_PASSWORD=<your-jafar-password> \
bun src/tests/security-report.smoke.test.ts
```

Expected: all assertions pass, final line `✅ N passed, 0 failed`, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/tests/security-report.smoke.test.ts
git commit -m "test(security-report): add smoke test covering list/latest/traversal/unauth"
```

---

## Self-review checklist (do NOT commit this section)

Before handing off, the author verified:

- **Spec coverage:**
  - Admin Dashboard tile (Jafar-only) → Task 10 Step 2.
  - Page at `/jafar/security-report` with `RequireJafar` → Task 10 Steps 3–4.
  - Three endpoints under `/api/jafar-admin/security-reports/*` with `getAuthenticatedUserCompany + checkJafarRole` → Task 2.
  - Sync to all three server files → Tasks 3–4.
  - Strict filename regex + resolved-path check → Task 2 Step 2.
  - Summary cards / Attack Surface / Supply Chain / Findings with Copy buttons / search / filter chips / expand-all → Tasks 5–9.
  - History dropdown, newest default → Task 9.
  - Empty state, error state, loading states → Task 9.
  - `.gitignore` update → Task 11.
  - Deployment audit → Task 12.
  - Smoke tests → Task 13.
  - Out-of-scope items (diff view, PDF export, mark-resolved, Jira/Slack, write endpoints) → NOT added ✅.
- **Placeholder scan:** No TBD / TODO / "implement later" / vague phrases. Every code block is complete.
- **Type consistency:** `SecurityReport`, `SecurityFinding`, `SecurityReportSummary`, `SecurityReportListResponse`, `SeverityFilter` all defined once and used consistently across Tasks 1, 5–9, 13.
- **Method/prop consistency:** `onShowJafarSecurityReport` prop name matches across Task 10 Steps 1–3. `selectedSection === 'jafarSecurityReport'` matches. URL `/jafar/security-report` matches in Task 10 Steps 4 and 6 and Task 13.
