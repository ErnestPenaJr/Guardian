# Signup Wizard — Initial Workflow Step

**Status:** Design approved, awaiting implementation plan
**Date:** 2026-05-28
**Author:** Ernest + Claude
**Branch:** main → Chetan

## Problem

The current `/register` wizard creates a user, company, and admin role on the final survey submit, then redirects to `/login`. A previously-present "create an initial workflow" step was removed at some point and needs to be re-added as the final step of registration — before the user reaches the login screen.

Without it, every new admin lands in an empty company with no form templates, and the post-login `NewRequestModal` first-time-admin modal is the only path that prompts them to build one. That modal works, but it's a worse first impression than having the new admin shape their workspace during signup itself.

## Goal

Insert a new "initial workflow" step at the end of the signup wizard, after the role/team/company-size survey. The step is **skippable**, **does not block account creation**, and lets the user create one starter form template (type + name + description, no fields yet) before being sent to `/login`.

## Non-goals

- Full field building during signup (handled later from the dashboard via the existing form builder).
- Auto-logging the user in after registration — the existing "redirect to `/login`" behavior is preserved.
- Replacing the post-login first-time-admin modal — it remains as a safety net for users who skip or fail the new step. (When a workflow IS created during signup, the modal's existing "company has zero form templates" check will correctly detect the template and NOT show on next login — no extra logic needed.)
- Refactoring the signup wizard structure beyond what this feature requires.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| What the user does in the new step | Reuse `NewRequestModal` step 0 + step 1 UI (pick type, then name + description) — no field building |
| When the user account is created | Survey submit creates user + company as today; the new step runs after |
| Skippable? | Yes — `[Skip for now]` available on both substeps |
| Post-step destination | Redirect to `/login` regardless of save vs skip |
| Auth for the workflow save call | `/api/complete-registration` returns a JWT (same shape/expiry as `/api/login`); wizard uses it once for `POST /api/forms` then discards |

## User flow

```
Screen 1 — Email entry (/register, existing)
    ↓ POST /api/register
Screen 2 — Verify code (/verify-email, existing, verificationComplete=false)
    ↓ POST /api/verify-email
Screen 3 — Personal info (existing, registrationStep===1)
    ↓ client-side validation
Screen 4 — Survey (existing, registrationStep===2)
    ↓ POST /api/complete-registration → returns { ..., token }
Screen 5a — NEW: Pick workflow type (registrationStep===3)
    └─ [Skip for now] → /login
    └─ Continue → 5b
Screen 5b — NEW: Name and describe (registrationStep===4)
    └─ [Back] → 5a (preserves type selection)
    └─ [Skip for now] → /login
    └─ [Create workflow] → POST /api/forms (Bearer JWT) → /login
```

JWT lives in component state only. It is nulled before any `navigate()` call so it cannot leak across page transitions.

## Component / file changes

### Frontend

**`src/pages/VerifyEmail.tsx`** *(modify)*
- Extend `registrationStep` state from `1|2` → `1|2|3|4`.
- Add state: `pendingJwt: string|null`, `workflowType: ''|'Requests'|'Self-Service'|'Notice'`, `workflowName: string`, `workflowDescription: string`, `workflowSaving: boolean`, `workflowError: string`.
- Modify `handleCompleteRegistration`:
  - On success: stop calling `navigate('/login')`. Instead `setPendingJwt(response.data.token)` and `setRegistrationStep(3)`.
  - Keep existing error path.
- Update `renderRegistrationForm()` to dispatch step 3 → `<InitialWorkflowStep subStep="pickType" ... />` and step 4 → `<InitialWorkflowStep subStep="nameAndDescribe" ... />`.
- Add handlers:
  - `handleWorkflowSave()` — `POST /api/forms` with `Authorization: Bearer ${pendingJwt}` and body `{ name, description, formType, formFields: [] }`. On success: `setPendingJwt(null)`, `localStorage.removeItem('registrationData')`, `navigate('/login')` with success toast. On error: per error-handling table below.
  - `handleWorkflowSkip()` — `setPendingJwt(null)`, `localStorage.removeItem('registrationData')`, `navigate('/login')` with neutral toast.

**`src/components/registration/InitialWorkflowStep.tsx`** *(new, ~200 LOC)*

Presentational component — no fetch, no localStorage, no navigation. Parent owns state and side-effects.

```ts
interface InitialWorkflowStepProps {
  subStep: 'pickType' | 'nameAndDescribe';
  workflowType: string;
  workflowName: string;
  workflowDescription: string;
  saving: boolean;
  error: string;
  onTypeChange: (t: string) => void;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onBack: () => void;       // only used when subStep === 'nameAndDescribe'
  onContinue: () => void;   // pickType → nameAndDescribe
  onSave: () => void;       // nameAndDescribe → POST /api/forms
  onSkip: () => void;       // → /login
}
```

UI borrows the type-tile markup from `NewRequestModal` step 0 and the name/description input markup from step 1, restyled to match the existing wizard's Tailwind card layout. Name input has `maxLength={255}` to match the `GUARDIAN.FORMS.NAME` column constraint observed in `SimpleFormBuilder`.

Why a new file instead of two more `renderXxx()` blocks inside `VerifyEmail.tsx`: that file is already 887 lines; adding two more screen renderers would push it past 1100. A focused component with a small prop surface gives the workflow screens a clean boundary without triggering a broader wizard refactor. This is a targeted improvement, not unrelated cleanup.

### Backend

**`server.cjs` (line ~9759, `/api/complete-registration`)** *(modify)*

After the existing success path (line ~10028, before `res.json(...)`), build a JWT by **copying the exact `jwt.sign(...)` call used by `/api/login` in `server.cjs`** — same payload keys (`userId`, `email`, `companyId`, `roles`), same `JWT_SECRET`, same `expiresIn`. Do not invent new fields or shorten the expiry; mirror what login does so `/api/forms` (and any other JWT-protected endpoint the wizard might end up calling) accepts the token unmodified.

Implementation note: locate the `jwt.sign(...)` call inside `/api/login` (search `server.cjs` for `jwt.sign(`), reuse it verbatim with the values from this endpoint's local scope (`userId` = `existingUser.USER_ID`, `companyId` = `currentCompanyId`, `roles` = the same role lookup the user was assigned at lines 9876-9888).

Append `token` to the response body alongside the existing `user`, `callSign`, etc.

**`server.js`** *(modify)* — mirror the same change. Per CLAUDE.md, this file is the local-prod-test copy of the legacy server.

**`server-production.js`** *(modify)* — mirror the same change. Per CLAUDE.md and the multi-server sync protocol, this is the file the Azure pipeline copies to `server.js` during deployment. **If only `server.cjs` and `server.js` are updated and `server-production.js` is missed, the change will not deploy to staging or prod.**

**TS server (`server/index.ts`)** *(no change)* — per CLAUDE.md, registration endpoints are not hosted by the TS server.

**`/api/forms`** *(no change)* — already JWT-authenticated; the wizard call hits it normally.

### Files touched

| File | Type | Approx LOC |
|---|---|---|
| `src/pages/VerifyEmail.tsx` | modify | +60 / -10 |
| `src/components/registration/InitialWorkflowStep.tsx` | new | ~200 |
| `server.cjs` | modify | +8 |
| `server.js` | modify | +8 |
| `server-production.js` | modify | +8 |
| `src/tests/registration-workflow.smoke.test.ts` | new | ~150 |

No DB schema changes. No new dependencies.

## Data flow

```
Screen 4 (Survey) → handleCompleteRegistration()
  ├─ POST /api/complete-registration
  │   body: { email, password, fullName, workspaceName, role, teamSize, companySize }
  └─ 200: { success, user, callSign, token }
       ├─ setPendingJwt(token)
       └─ setRegistrationStep(3)

Screen 5a (Pick type) → onContinue()
  └─ setRegistrationStep(4)   // no network call

Screen 5b (Name + describe) → handleWorkflowSave()
  ├─ POST /api/forms
  │   headers: { Authorization: `Bearer ${pendingJwt}` }
  │   body: { name, description, formType: workflowType, formFields: [] }
  └─ 200: { success, formId }
       ├─ setPendingJwt(null)
       ├─ localStorage.removeItem('registrationData')
       └─ navigate('/login') + toast: "Workflow '<name>' created — please sign in."

Skip path (5a or 5b) → handleWorkflowSkip()
  ├─ setPendingJwt(null)
  ├─ localStorage.removeItem('registrationData')
  └─ navigate('/login') + toast: "Account created — please sign in to continue."
```

## Error handling

### `/api/complete-registration` failures *(Screen 4)*

| Status | Behavior |
|---|---|
| 400 missing fields | Inline error, stay on Screen 4, no advance |
| 500 DB error | Inline error, stay on Screen 4 |
| Network | Inline "Connection lost, try again" |

User account is not yet created on the user's view of the world — they can safely retry.

### `/api/forms` failures *(Screen 5b)*

| Status | Behavior |
|---|---|
| 401 JWT rejected | Inline: "Session expired. Please sign in and create your workflow from the dashboard." `[Continue to sign in]` → `/login`. Account exists, modal handles workflow creation post-login. |
| 400 validation | Inline error, stay on Screen 5b, user can edit |
| 500 server | Inline error with `[Try again]` and `[Skip for now]` buttons |
| Network | Same as 500 |

Account already exists at this point — failure to save the workflow is not failure to register.

### Duplicate-submit guards

- `workflowSaving` boolean disables `[Create workflow]` while in flight.
- Existing `isLoading` boolean already guards `handleCompleteRegistration` from double-submit.

## Edge cases

| Scenario | Behavior |
|---|---|
| User refreshes browser on Screen 5a or 5b | `pendingJwt` is gone (state-only). `useEffect` sees `localStorage.registrationData` is still present but registration is already complete; redirect to `/login`. Account exists; post-login first-time-admin modal handles workflow creation. |
| User closes browser entirely | Same as refresh. |
| User clicks the in-wizard `[Back]` button on Screen 5b | Returns to Screen 5a with type selection preserved. (Wizard steps are internal state, not history entries — there is no Back button on 5a; `[Skip for now]` is the only way out.) |
| User clicks browser-back from Screen 5a or 5b | Browser exits `/verify-email` entirely (the wizard doesn't push history per step). They land on `/register` or wherever the previous history entry points. Account is already created; if they come back to `/verify-email` directly, `useEffect` sees no valid `registrationData` and bounces them to `/register`. They can sign in normally. |
| User resubmits Screen 4 survey | `/api/complete-registration` is idempotent for already-completed users (verified at server.cjs:9839-9841 — re-runs the profile update and re-issues a fresh JWT). Safe. |
| JWT expired between Screen 4 and 5b | 401 path above. Realistic only if user goes AFK long enough to outlast the login session expiry. |
| User picks a type, Continue, then Back from 5b | Type selection preserved in parent state, tile re-highlighted on 5a. |
| `/api/forms` returns success but `navigate` somehow fails | Toast still fires; user can click login link manually. Workflow IS saved. |
| Workflow name longer than `NAME` column | Input `maxLength={255}` enforces client-side cap; mirrors `SimpleFormBuilder` behavior. |

## What we explicitly do NOT do

- Persist workflow draft to localStorage — if the user abandons it, it's gone. Intentional; reduces ghost state.
- Auto-log-in the user — JWT is for one POST only, then discarded.
- Roll back the user account if `/api/forms` fails — account creation is the durable goal of `/register`; the workflow is optional.
- Add field building during signup — out of scope.
- Add React component test infrastructure — no `@testing-library` exists; adding it is scope creep. Frontend is manual QA.

## Testing

### Backend: new smoke test

**`src/tests/registration-workflow.smoke.test.ts`** — follows the existing two-layer pattern from `src/tests/securities-notice-permissions.test.ts`.

**Unit layer** (no env required):
- Asserts the JWT payload shape we issue from `/api/complete-registration` matches what `/api/login` issues — same keys (`userId`, `email`, `companyId`, `roles`), same types, same expiry.

**HTTP layer** (gated by `TEST_API_BASE`):
1. **Happy path** — `POST /api/complete-registration` for a freshly verified user → assert 200, response has `token` field, decoded token's `companyId` matches the created company.
2. **JWT works against `/api/forms`** — take token from step 1 → `POST /api/forms` with `Authorization: Bearer <token>` and `{ name, description, formType: 'Requests', formFields: [] }` → assert 200 and `formId` returned.
3. **JWT role-scoped correctly** — admin-only endpoints reachable; super-admin-only endpoints denied. Reuses the role-check pattern from `securities-notice-permissions.test.ts`.
4. **No token on failure paths** — `POST /api/complete-registration` with an unverified email → error response has NO `token` field.

New env var documented in the file header: `TEST_REGISTRATION_EMAIL` (verified-but-not-completed seeded user).

### Frontend: manual QA checklist

1. **Happy path** — register → verify code → personal info → survey → Screen 5a → pick `Requests` → Continue → fill name + description → Create workflow → `/login` → sign in → workflow visible on dashboard.
2. **Skip on Screen 5a** — survey → Skip for now → `/login` → sign in → first-time-admin modal appears (existing behavior).
3. **Skip on Screen 5b** — pick type → Continue → Skip → same as #2.
4. **Back from 5b to 5a** — type selection still highlighted; name and description fields are cleared on return.
5. **JWT rejected** — manually expire/corrupt `pendingJwt` in React DevTools → Create → inline error + `[Continue to sign in]` → `/login` → modal appears.
6. **Network error during save** — DevTools offline → Create → inline error + `[Try again]` / `[Skip for now]` → toggle online → retry succeeds.
7. **Browser refresh on Screen 5a** — redirected to `/login`; sign in → modal appears.
8. **Double-click `[Create workflow]`** — only one POST fires (button disabled during `workflowSaving`).

## Open questions

None — all design decisions locked during brainstorming.

## Multi-server sync reminder

Per CLAUDE.md "Pipeline Configuration" section: the Azure pipeline runs `cp server-production.js deployment/server.js` during deploy. Changes to `/api/complete-registration` that miss `server-production.js` will NOT deploy. Implementation plan must explicitly list all three legacy files (`server.cjs`, `server.js`, `server-production.js`) as touched.
