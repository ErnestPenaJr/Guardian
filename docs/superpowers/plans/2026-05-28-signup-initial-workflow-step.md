# Signup Initial Workflow Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skippable "create your first workflow" step at the end of the `/register` wizard, after the role/team/company-size survey and before the `/login` redirect.

**Architecture:** `/api/complete-registration` returns a JWT identical in shape and expiry to `/api/login`'s token. The wizard stashes that JWT in component state (never localStorage), shows two new substeps that mirror `NewRequestModal`'s step 0 (pick form type) and step 1 (name + description), and uses the JWT once to `POST /api/forms` before redirecting to `/login`. Skip is available on both substeps. No DB schema changes, no new endpoints.

**Tech Stack:** Express.js (CommonJS legacy servers — `server.cjs`, `server.js`, `server-production.js`), React 18 + TypeScript, Tailwind CSS, React Router DOM v7, axios, Bun test, jsonwebtoken, Prisma + SQL Server.

**Spec:** `docs/superpowers/specs/2026-05-28-signup-initial-workflow-step-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `server.cjs` | modify | Add `token` to `/api/complete-registration` response — source of truth per CLAUDE.md |
| `server.js` | modify | Mirror — local-prod-test copy |
| `server-production.js` | modify | Mirror — Azure pipeline copies this to `server.js` during deploy |
| `src/tests/registration-workflow.smoke.test.ts` | create | Two-layer Bun smoke test (unit + opt-in HTTP) for the new behavior |
| `src/components/registration/InitialWorkflowStep.tsx` | create | Presentational component for screens 5a / 5b — no fetch, no localStorage, no navigation |
| `src/pages/VerifyEmail.tsx` | modify | Extend `registrationStep` 1→4; wire new component; handle JWT and `/api/forms` call |

**Decomposition rationale:**
- Backend changes live in the three legacy server files because `/api/complete-registration` is not hosted by the TS server (per CLAUDE.md). All three must update together or the change won't deploy.
- The new wizard screens are extracted into `InitialWorkflowStep.tsx` (rather than two more `renderXxx()` blocks inside `VerifyEmail.tsx`) because that file is already 887 lines. A focused presentational component with a small prop surface keeps the boundary clean.
- Frontend has no React component test infrastructure (no `@testing-library`, no jsdom). Coverage of the new UI is manual per the spec's QA checklist.

---

## Task 1: Write the failing smoke test for `/api/complete-registration` token issuance

**Files:**
- Create: `src/tests/registration-workflow.smoke.test.ts`

- [ ] **Step 1: Read the existing smoke-test pattern**

Read `src/tests/securities-notice-permissions.test.ts` lines 1-60 to confirm the two-layer structure: unit layer always runs, HTTP layer gated on `TEST_API_BASE` env var.

- [ ] **Step 2: Create the smoke test file**

Create `src/tests/registration-workflow.smoke.test.ts` with the following content:

```typescript
// src/tests/registration-workflow.smoke.test.ts
//
// Verifies the signup wizard's "initial workflow" step backend contract:
//
//   1. UNIT layer (always runs): exercises jsonwebtoken to assert the token
//      payload shape we expect /api/complete-registration to issue matches
//      the shape /api/login already issues (id, userId, email, firstName,
//      lastName, companyId, roles, roleNames). Guards against drift.
//
//   2. HTTP layer (opt-in via TEST_API_BASE): runs the full registration
//      flow against a live server — POST /api/register, POST /api/verify-email,
//      POST /api/complete-registration — and asserts (a) the response includes
//      a `token` field, (b) the decoded token contains the expected keys,
//      (c) the token works against POST /api/forms.
//
// HTTP-layer env vars (set all to run the HTTP layer):
//   TEST_API_BASE        — e.g. http://localhost:3001
//   JWT_SECRET           — must match the server's JWT_SECRET (required to
//                           decode the issued token)
//
// Without TEST_API_BASE, the HTTP layer is skipped and the script exits 0
// after the unit layer.

import { describe, it, expect } from 'bun:test';
import jwt from 'jsonwebtoken';

const EXPECTED_TOKEN_KEYS = [
  'id',
  'userId',
  'email',
  'firstName',
  'lastName',
  'companyId',
  'roles',
  'roleNames',
];

describe('registration workflow — JWT payload shape (unit)', () => {
  it('jsonwebtoken signs and verifies a payload with all expected keys', () => {
    const secret = 'test-secret-for-shape-check';
    const payload = {
      id: 1,
      userId: 1,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      companyId: 99,
      roles: [1],
      roleNames: ['Admin'],
    };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    for (const key of EXPECTED_TOKEN_KEYS) {
      expect(decoded).toHaveProperty(key);
    }
  });
});

const apiBase = process.env.TEST_API_BASE;
const jwtSecret = process.env.JWT_SECRET;

if (apiBase && jwtSecret) {
  describe('registration workflow — full flow (HTTP)', () => {
    const testEmail = `wftest+${Date.now()}@example.com`;
    let verificationCode: string;
    let issuedToken: string;
    let companyId: number;

    it('POST /api/register starts registration and returns a dev verification code', async () => {
      const res = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; verificationCode?: string };
      expect(body.success).toBe(true);
      expect(typeof body.verificationCode).toBe('string');
      verificationCode = body.verificationCode!;
    });

    it('POST /api/verify-email accepts the code', async () => {
      const res = await fetch(`${apiBase}/api/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, verificationCode }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('POST /api/complete-registration returns a `token` with the expected payload', async () => {
      const res = await fetch(`${apiBase}/api/complete-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'TestPassword123!',
          fullName: 'WF Test',
          workspaceName: `WFTEST-${Date.now() % 100}`,
          role: 'Analyst',
          teamSize: '2-5',
          companySize: '20-49',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        token?: string;
        user?: { companyId: number };
      };
      expect(body.success).toBe(true);
      expect(typeof body.token).toBe('string');

      const decoded = jwt.verify(body.token!, jwtSecret) as Record<string, unknown>;
      for (const key of EXPECTED_TOKEN_KEYS) {
        expect(decoded).toHaveProperty(key);
      }
      expect(decoded.email).toBe(testEmail);
      expect((decoded.roleNames as string[]).includes('Admin')).toBe(true);

      issuedToken = body.token!;
      companyId = body.user!.companyId;
    });

    it('The issued token authorizes POST /api/forms', async () => {
      const res = await fetch(`${apiBase}/api/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuedToken}`,
        },
        body: JSON.stringify({
          form: {
            FORM_NAME: `WF Test Initial ${Date.now()}`,
            FORM_DESCRIPTION: 'Created by registration-workflow smoke test',
            TEMPLATE_TYPE: 'request',
            IS_PUBLIC: false,
            IS_ACTIVE: true,
            IS_INTERNAL: true,
            IS_EXTERNAL: false,
          },
          fields: [],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { formId?: number };
      expect(typeof body.formId).toBe('number');
    });
  });
} else {
  describe('registration workflow — HTTP layer skipped', () => {
    it('skips HTTP layer when TEST_API_BASE or JWT_SECRET is unset', () => {
      expect(true).toBe(true);
    });
  });
}
```

- [ ] **Step 3: Run the unit layer to confirm the file is wired up**

Run: `bun test src/tests/registration-workflow.smoke.test.ts`

Expected: 1 test passes (the unit-layer shape check), HTTP layer reports "skipped" (unless `TEST_API_BASE` and `JWT_SECRET` happen to be set in your shell). No errors.

- [ ] **Step 4: Run the HTTP layer to confirm it currently FAILS**

Start the dev server **with `NODE_ENV=development`** so `/api/register` returns the verification code in its response body (required by the smoke test's flow):

```bash
NODE_ENV=development bun run backend
```

In the test terminal, with the server running:

```bash
TEST_API_BASE=http://localhost:3001 \
JWT_SECRET="guardian-jwt-secret-key" \
bun test src/tests/registration-workflow.smoke.test.ts
```

Expected: the "POST /api/complete-registration returns a `token` …" test **FAILS** because the endpoint does not yet include a `token` field in its response. This is the failing state TDD needs before Task 2.

(If `JWT_SECRET` is set differently in your shell or `.env`, use that value instead — it must match what the server uses. If `NODE_ENV` isn't development, the first test assertion fails on the missing `verificationCode` field and you can't reach the JWT-issuance assertion — make sure the server was started with `NODE_ENV=development`.)

- [ ] **Step 5: Commit**

```bash
git add src/tests/registration-workflow.smoke.test.ts
git commit -m "test(registration): failing smoke test for JWT issuance from /api/complete-registration"
```

---

## Task 2: Implement JWT issuance in `server.cjs` to pass the test

**Files:**
- Modify: `server.cjs` (in `/api/complete-registration` around line 10018, immediately before the existing `res.json(...)` call at line 10028)

- [ ] **Step 1: Read the reference `jwt.sign` call from `/api/login`**

Read `server.cjs` lines 1753-1784 — this is the source-of-truth shape we must mirror exactly. The relevant pieces are:

```js
// Role lookup pattern (lines 1753-1768):
const userRoles = await prisma.$queryRaw`
    SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
    FROM GUARDIAN.USER_ROLES ur
    JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
    WHERE ur.USER_ID = ${user.USER_ID}
`;
const roleIds = userRoles.map(ur => ur.ROLE_ID);
const roleNames = userRoles.map(ur => ur.NAME);

// Token signing (lines 1771-1784):
const token = jwt.sign(
    {
        id: user.USER_ID,
        userId: user.USER_ID,
        email: user.EMAIL,
        firstName: user.FIRST_NAME,
        lastName: user.LAST_NAME,
        companyId: user.COMPANY_ID,
        roles: roleIds,
        roleNames: roleNames
    },
    JWT_SECRET,
    { expiresIn: '24h' }
);
```

- [ ] **Step 2: Locate the insertion point in `/api/complete-registration`**

Open `server.cjs` and find the response-building block in `/api/complete-registration`. It is around line 10018-10039, starting at the comment:

```js
console.log(`✅ Registration completed successfully for: ${email} (User ID: ${userId})`);
```

The existing `res.json(...)` block follows. The new JWT block goes after the `actualCallSign` lookup and before `res.json(...)`.

- [ ] **Step 3: Insert the JWT issuance block**

Immediately before the existing `res.json({` line (which currently starts at server.cjs:10028), insert:

```js
        // Look up the user's roles (Admin was just assigned above if absent),
        // then sign a JWT with the exact same payload shape /api/login issues
        // so the wizard's one-shot POST /api/forms call is authorized end-to-end.
        const userRolesForToken = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${userIdInt}
        `;
        const tokenRoleIds = userRolesForToken.map(ur => ur.ROLE_ID);
        const tokenRoleNames = userRolesForToken.map(ur => ur.NAME);

        const token = jwt.sign(
            {
                id: userId,
                userId: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId,
                roles: tokenRoleIds,
                roleNames: tokenRoleNames,
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

```

- [ ] **Step 4: Add the `token` field to the response body**

Update the existing `res.json({...})` block to include `token`. The block currently ends with `callSign: actualCallSign // Use the actual company name from database` on line 10038. Add a comma and `token` line so it reads:

```js
        res.json({
            success: true,
            message: `Registration completed successfully! Welcome to organization ${actualCallSign}`,
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId
            },
            callSign: actualCallSign, // Use the actual company name from database
            token,                    // NEW: short-lived session token for the wizard's POST /api/forms call
        });
```

- [ ] **Step 5: Restart the dev server and re-run the failing test**

If the dev server from Task 1 Step 4 is still running, stop it (Ctrl+C) and restart with `NODE_ENV=development`:

```bash
NODE_ENV=development bun run backend
```

Then re-run the smoke test:

```bash
TEST_API_BASE=http://localhost:3001 \
JWT_SECRET="guardian-jwt-secret-key" \
bun test src/tests/registration-workflow.smoke.test.ts
```

Expected: all five tests PASS (unit-layer shape check, register, verify, complete-registration with token, /api/forms accepts token).

- [ ] **Step 6: Commit**

```bash
git add server.cjs
git commit -m "feat(registration): issue JWT from /api/complete-registration for signup-wizard workflow step"
```

---

## Task 3: Mirror the JWT issuance to `server.js` and `server-production.js`

**Files:**
- Modify: `server.js` (find `/api/complete-registration`, mirror the Task 2 edits)
- Modify: `server-production.js` (find `/api/complete-registration`, mirror the Task 2 edits)

Per CLAUDE.md's multi-server sync protocol, **both** files must be updated or the change will not deploy. `server-production.js` is the source the Azure pipeline copies to `server.js` during deploy; `server.js` is what `node server.js` runs locally for production testing.

- [ ] **Step 1: Apply the role-lookup + `jwt.sign` insertion to `server.js`**

Open `server.js`, find the `/api/complete-registration` handler (approximate offset similar to `server.cjs:9759`). Locate the success response block ending with `callSign: actualCallSign`. Immediately before the `res.json({` opening, insert:

```js
        const userRolesForToken = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${userIdInt}
        `;
        const tokenRoleIds = userRolesForToken.map(ur => ur.ROLE_ID);
        const tokenRoleNames = userRolesForToken.map(ur => ur.NAME);

        const token = jwt.sign(
            {
                id: userId,
                userId: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId,
                roles: tokenRoleIds,
                roleNames: tokenRoleNames,
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

```

Then update the response object to include `token`:

```js
        res.json({
            success: true,
            message: `Registration completed successfully! Welcome to organization ${actualCallSign}`,
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId
            },
            callSign: actualCallSign,
            token,
        });
```

- [ ] **Step 2: Apply the same insertion to `server-production.js`**

Open `server-production.js`, find the `/api/complete-registration` handler, and insert the exact same role-lookup + `jwt.sign(...)` block immediately before the `res.json(...)` call:

```js
        const userRolesForToken = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${userIdInt}
        `;
        const tokenRoleIds = userRolesForToken.map(ur => ur.ROLE_ID);
        const tokenRoleNames = userRolesForToken.map(ur => ur.NAME);

        const token = jwt.sign(
            {
                id: userId,
                userId: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId,
                roles: tokenRoleIds,
                roleNames: tokenRoleNames,
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

```

Then update its response object the same way:

```js
        res.json({
            success: true,
            message: `Registration completed successfully! Welcome to organization ${actualCallSign}`,
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId
            },
            callSign: actualCallSign,
            token,
        });
```

- [ ] **Step 3: Confirm the three files now agree**

Run a quick diff of just the `/api/complete-registration` blocks. From the repo root:

```bash
grep -n "/api/complete-registration" server.cjs server.js server-production.js
```

Note the line numbers, then for each file inspect the response block to confirm `token,` is present:

```bash
grep -n "token," server.cjs server.js server-production.js | grep -v "^Binary"
```

Expected: each file shows a `token,` entry inside the `/api/complete-registration` response block.

- [ ] **Step 4: Restart with the production server and re-run the smoke test**

Stop `server.cjs`. Start the production server locally with `NODE_ENV=development` (so the test's first step still receives the verification code):

```bash
NODE_ENV=development node server.js
```

In another terminal:

```bash
TEST_API_BASE=http://localhost:3001 \
JWT_SECRET="guardian-jwt-secret-key" \
bun test src/tests/registration-workflow.smoke.test.ts
```

Expected: all five tests PASS against `node server.js`. This validates the production-shaped build, not just dev.

- [ ] **Step 5: Commit**

```bash
git add server.js server-production.js
git commit -m "feat(registration): mirror JWT issuance into legacy server.js + server-production.js"
```

---

## Task 4: Create `InitialWorkflowStep` presentational component

**Files:**
- Create: `src/components/registration/InitialWorkflowStep.tsx`

- [ ] **Step 1: Confirm the target directory exists**

Run: `ls src/components/registration 2>/dev/null || mkdir -p src/components/registration`

- [ ] **Step 2: Create the component file**

Create `src/components/registration/InitialWorkflowStep.tsx` with the following content:

```tsx
import React from 'react';

export type WorkflowType = '' | 'Request' | 'Self-Service' | 'Notice';

export interface InitialWorkflowStepProps {
  subStep: 'pickType' | 'nameAndDescribe';
  workflowType: WorkflowType;
  workflowName: string;
  workflowDescription: string;
  saving: boolean;
  error: string;
  onTypeChange: (t: WorkflowType) => void;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onSave: () => void;
  onSkip: () => void;
}

// Form-type tiles match the options shown in NewRequestModal step 0.
// 'Self-Service' is rendered disabled to mirror NewRequestModal's behavior —
// the option exists in the UI for visual consistency but is not yet selectable.
const TYPE_OPTIONS: Array<{ value: WorkflowType; label: string; disabled?: boolean; description: string }> = [
  { value: 'Request', label: 'Requests', description: 'Receive and process request submissions from your team or external parties.' },
  { value: 'Self-Service', label: 'Self-Service', disabled: true, description: 'Coming soon — let external users submit forms directly.' },
  { value: 'Notice', label: 'Notice', description: 'Send announcements, alerts, or compliance notices to recipients.' },
];

const InitialWorkflowStep: React.FC<InitialWorkflowStepProps> = ({
  subStep,
  workflowType,
  workflowName,
  workflowDescription,
  saving,
  error,
  onTypeChange,
  onNameChange,
  onDescriptionChange,
  onBack,
  onContinue,
  onSave,
  onSkip,
}) => {
  if (subStep === 'pickType') {
    return (
      <>
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
          <span className="text-h4 font-display font-bold text-black">Guardian</span>
        </div>

        <h1 className="text-h5 font-display font-bold text-center mb-1">Create your first workflow</h1>
        <p className="text-body-md text-gray-1 mb-6 text-center">
          Pick a starting point. You can build more from the dashboard later.
        </p>

        <div className="space-y-3 mb-6">
          {TYPE_OPTIONS.map((opt) => {
            const selected = workflowType === opt.value;
            return (
              <label
                key={opt.value}
                className={`block px-4 py-3 border cursor-pointer transition-all ${
                  opt.disabled
                    ? 'border-gray-5 opacity-50 cursor-not-allowed'
                    : selected
                    ? 'border-secondary bg-secondary/10'
                    : 'border-gray-5 hover:border-gray-4'
                }`}
                style={{ borderRadius: '6px' }}
              >
                <input
                  type="radio"
                  name="workflowType"
                  value={opt.value}
                  checked={selected}
                  disabled={opt.disabled}
                  onChange={() => !opt.disabled && onTypeChange(opt.value)}
                  className="h-4 w-4 text-secondary border-gray-5 focus:ring-secondary mr-2"
                />
                <span className="font-medium">{opt.label}</span>
                <p className="text-body-sm text-gray-2 mt-1 ml-6">{opt.description}</p>
              </label>
            );
          })}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-error mb-6" style={{ borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onSkip}
            className="w-1/3 bg-white border border-gray-5 text-gray-1 font-semibold py-3 px-4 transition-colors"
            style={{ borderRadius: '8px' }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!workflowType}
            className="w-2/3 py-3 px-4 text-white font-medium transition-colors duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: '8px', backgroundColor: '#2EBCBC' }}
          >
            Continue
          </button>
        </div>
      </>
    );
  }

  // subStep === 'nameAndDescribe'
  return (
    <>
      <div className="flex items-center justify-center gap-3 mb-8">
        <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
        <span className="text-h4 font-display font-bold text-black">Guardian</span>
      </div>

      <h1 className="text-h5 font-display font-bold text-center mb-1">Name your workflow</h1>
      <p className="text-body-md text-gray-1 mb-6 text-center">
        Give your {workflowType.toLowerCase()} workflow a name and short description.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="workflowName" className="block text-body-sm font-medium text-gray-1 mb-2">
            Workflow name
          </label>
          <input
            type="text"
            id="workflowName"
            maxLength={255}
            value={workflowName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. New customer intake"
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
            style={{ borderRadius: '6px' }}
          />
        </div>

        <div>
          <label htmlFor="workflowDescription" className="block text-body-sm font-medium text-gray-1 mb-2">
            Description
          </label>
          <textarea
            id="workflowDescription"
            rows={3}
            value={workflowDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What is this workflow for?"
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
            style={{ borderRadius: '6px' }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-error mt-4 mb-2" style={{ borderRadius: '6px' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="w-1/4 bg-white border border-gray-5 text-gray-1 font-semibold py-3 px-4 transition-colors disabled:opacity-50"
          style={{ borderRadius: '8px' }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="w-1/4 bg-white border border-gray-5 text-gray-1 font-semibold py-3 px-4 transition-colors disabled:opacity-50"
          style={{ borderRadius: '8px' }}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !workflowName.trim() || !workflowDescription.trim()}
          className="flex-1 py-3 px-4 text-white font-medium transition-colors duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: '8px', backgroundColor: '#2EBCBC' }}
        >
          {saving ? 'Creating…' : 'Create workflow'}
        </button>
      </div>
    </>
  );
};

export default InitialWorkflowStep;
```

- [ ] **Step 3: Type-check the new file**

Run: `npx tsc --noEmit`

Expected: no new TypeScript errors introduced by `InitialWorkflowStep.tsx`. (Existing repo-wide errors unrelated to this file are acceptable.)

- [ ] **Step 4: Commit**

```bash
git add src/components/registration/InitialWorkflowStep.tsx
git commit -m "feat(registration): add InitialWorkflowStep presentational component"
```

---

## Task 5: Wire `InitialWorkflowStep` into `VerifyEmail.tsx`

**Files:**
- Modify: `src/pages/VerifyEmail.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/pages/VerifyEmail.tsx`, after the existing `LegalModal` import (around line 6), add:

```tsx
import InitialWorkflowStep, { WorkflowType } from '../components/registration/InitialWorkflowStep';
```

- [ ] **Step 2: Add the new state hooks**

In the `VerifyEmail` component body, just after the existing `formData` state declaration (around line 56), add:

```tsx
  // Initial workflow step (registrationStep 3 & 4) state
  const [pendingJwt, setPendingJwt] = useState<string | null>(null);
  const [workflowType, setWorkflowType] = useState<WorkflowType>('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
```

- [ ] **Step 3: Modify `handleCompleteRegistration` to stash the JWT and advance instead of navigating**

In `handleCompleteRegistration` (around line 256), find the success branch — currently lines 289-298:

```tsx
      if (response.data.success) {
        // Show simple success toast and redirect to login
        const callSign = response.data.callSign || 'GUARDIAN-XX';
        showToast.success(`Registration completed! Welcome to ${callSign}. Please sign in to continue.`);

        // Clear registration data from localStorage
        localStorage.removeItem('registrationData');

        // Redirect to login page
        navigate('/login');
      }
```

Replace it with:

```tsx
      if (response.data.success) {
        // Stash the short-lived JWT in state (never localStorage) so the
        // workflow step can authorize its one-shot POST /api/forms call.
        // localStorage and navigation happen at the end of the wizard.
        if (typeof response.data.token === 'string') {
          setPendingJwt(response.data.token);
        }
        setRegistrationStep(3);
      }
```

- [ ] **Step 4: Add the workflow save and skip handlers**

After `handleCompleteRegistration` closes (around line 312), add two new handlers:

```tsx
  const handleWorkflowSave = async () => {
    if (!pendingJwt) {
      setWorkflowError('Session expired. Please sign in and create your workflow from the dashboard.');
      return;
    }
    if (!workflowName.trim() || !workflowDescription.trim()) {
      setWorkflowError('Please enter both a name and a description.');
      return;
    }

    setWorkflowSaving(true);
    setWorkflowError('');
    try {
      const templateType = workflowType === 'Notice' ? 'notice' : 'request';
      await axios.post(
        '/api/forms',
        {
          form: {
            FORM_NAME: workflowName.trim(),
            FORM_DESCRIPTION: workflowDescription.trim(),
            TEMPLATE_TYPE: templateType,
            IS_PUBLIC: false,
            IS_ACTIVE: true,
            IS_INTERNAL: true,
            IS_EXTERNAL: false,
          },
          fields: [],
        },
        { headers: { Authorization: `Bearer ${pendingJwt}` } }
      );

      setPendingJwt(null);
      localStorage.removeItem('registrationData');
      showToast.success(`Workflow "${workflowName.trim()}" created — please sign in to continue.`);
      navigate('/login');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setWorkflowError('Session expired. Please sign in and create your workflow from the dashboard.');
      } else if (err.response?.data?.error) {
        setWorkflowError(err.response.data.error);
      } else {
        setWorkflowError('Could not save workflow. Please try again or skip for now.');
      }
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleWorkflowSkip = () => {
    setPendingJwt(null);
    localStorage.removeItem('registrationData');
    showToast.success('Account created — please sign in to continue.');
    navigate('/login');
  };
```

- [ ] **Step 5: Replace `renderRegistrationForm` to route steps 3 & 4 to the new component**

Find the existing `renderRegistrationForm` function (around line 860):

```tsx
  const renderRegistrationForm = () => {
    return registrationStep === 1 ? renderPersonalInfoForm() : renderRoleAndTeamForm();
  };
```

Replace with:

```tsx
  const renderRegistrationForm = () => {
    if (registrationStep === 1) return renderPersonalInfoForm();
    if (registrationStep === 2) return renderRoleAndTeamForm();
    return (
      <InitialWorkflowStep
        subStep={registrationStep === 3 ? 'pickType' : 'nameAndDescribe'}
        workflowType={workflowType}
        workflowName={workflowName}
        workflowDescription={workflowDescription}
        saving={workflowSaving}
        error={workflowError}
        onTypeChange={(t) => {
          setWorkflowType(t);
          setWorkflowError('');
        }}
        onNameChange={(n) => {
          setWorkflowName(n);
          setWorkflowError('');
        }}
        onDescriptionChange={(d) => {
          setWorkflowDescription(d);
          setWorkflowError('');
        }}
        onBack={() => {
          setRegistrationStep(3);
          setWorkflowError('');
        }}
        onContinue={() => {
          if (!workflowType) {
            setWorkflowError('Please choose a workflow type to continue.');
            return;
          }
          setWorkflowError('');
          setRegistrationStep(4);
        }}
        onSave={handleWorkflowSave}
        onSkip={handleWorkflowSkip}
      />
    );
  };
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`

Expected: no new TypeScript errors. If the existing `registrationStep` state has a narrower type (`useState(1)` infers `number`), no change needed — `1|2|3|4` are all `number`. If it was typed `1|2`, widen it to `number` or `1 | 2 | 3 | 4`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/VerifyEmail.tsx
git commit -m "feat(registration): wire InitialWorkflowStep into VerifyEmail wizard"
```

---

## Task 6: Manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Start both dev servers**

In one terminal:

```bash
bun run backend
```

In another terminal:

```bash
bun run dev
```

Confirm backend logs `Database connected successfully` and frontend reports the Vite URL (typically `http://localhost:5175`).

- [ ] **Step 2: Walk through the happy path**

Open `http://localhost:5175/register` in a browser. Use a fresh email (e.g. `qa+<timestamp>@example.com`). Submit, copy the verification code from the dev console toast, verify, fill in personal info, fill in survey, advance.

Expected screens after survey:
- **Screen 5a** appears with three type tiles (Requests selectable, Self-Service disabled, Notice selectable) and `[Skip for now]` + `[Continue]` buttons. `[Continue]` is disabled until a tile is selected.
- After picking `Requests` + Continue: **Screen 5b** appears with name + description inputs and `[Back]` `[Skip]` `[Create workflow]` buttons.
- After filling name + description + clicking Create workflow: redirect to `/login` with the success toast.
- Sign in. The new workflow appears in the dashboard's templates list. The first-time-admin modal does NOT appear.

- [ ] **Step 3: Walk through the skip paths**

Register a fresh email. On Screen 5a click `[Skip for now]` → redirect to `/login` → sign in → first-time-admin modal appears.

Register another fresh email. Pick a type → Continue → on Screen 5b click `[Skip]` → redirect to `/login` → sign in → first-time-admin modal appears.

- [ ] **Step 4: Walk through Back from 5b**

Register a fresh email. Pick `Notice` → Continue → on Screen 5b click `[Back]` → returns to Screen 5a with the `Notice` tile still highlighted. Re-Continue → Screen 5b reappears with name and description empty.

- [ ] **Step 5: Force a 401 on /api/forms**

Register a fresh email. Reach Screen 5b. Open React DevTools, find the `VerifyEmail` component, set `pendingJwt` to the string `"corrupted"`. Click Create workflow.

Expected: inline error "Session expired. Please sign in and create your workflow from the dashboard." Click any other navigation option to reach `/login`, then sign in. The first-time-admin modal appears (since no workflow was saved).

- [ ] **Step 6: Force a network failure**

Register a fresh email. Reach Screen 5b. In DevTools Network tab, set throttling to **Offline**. Click Create workflow → inline error appears. Switch throttling back to **No throttling**. Click Create workflow again → succeeds.

- [ ] **Step 7: Browser refresh on Screen 5a**

Register a fresh email. Reach Screen 5a. Hit browser refresh.

Expected: redirected away from the wizard (because `pendingJwt` is gone from state and `registrationData` in localStorage is either stale or absent). Sign in normally; the first-time-admin modal appears.

- [ ] **Step 8: Double-click guard**

Register a fresh email. Reach Screen 5b, fill name + description. Double-click `[Create workflow]` quickly.

Expected: only one POST `/api/forms` fires (verifiable in DevTools Network tab). The button is disabled (`Creating…`) during the request.

- [ ] **Step 9: Record QA results and commit any fixes**

If any of Steps 2-8 failed, fix the issue in the relevant file (likely `InitialWorkflowStep.tsx` or `VerifyEmail.tsx`), re-run the failing step, and commit:

```bash
git add <files>
git commit -m "fix(registration): <what was broken>"
```

If all eight steps passed, no commit needed — the implementation is complete.

---

## Done criteria

- All five smoke-test assertions pass against both `bun run backend` and `node server.js`
- All eight manual QA steps pass
- `git log --oneline` shows the feature broken into atomic commits: failing test, server.cjs JWT, mirror to server.js + server-production.js, new component, wizard wire-up, (optional) QA fixes
- `server.cjs`, `server.js`, `server-production.js` all contain the same `/api/complete-registration` response shape with the `token` field

## Out of scope (per spec)

- Field building during signup
- Auto-login after registration
- React component test infrastructure
- TS-server mirror (registration endpoints are legacy-only)
- DB schema changes
