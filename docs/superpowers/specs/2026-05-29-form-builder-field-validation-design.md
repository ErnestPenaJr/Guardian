# Form Builder Field Validation — Design

**Date:** 2026-05-29
**Status:** Approved (pending spec review)
**Author:** Ernest + Claude

## Problem

The Form Builder (`src/components/FormBuilder/FormBuilder.tsx`) has a **Validation**
tab listing checkboxes (`required, min, max, email, url, regex, numeric, alpha`)
and a **Conditions** tab. Two problems:

1. **None of the validation rules actually work.** The rules are written to a
   `validation` string that is *discarded on save* — it is not in the `DbField`
   interface, not stored in any DB column, and never read back when a user fills
   out a form. (The visible "Required" badges come from a separate `required`
   toggle in the **Properties** tab, which *does* persist via the `IS_REQUIRED`
   column.) The Conditions tab is a non-functional stub.

2. **Discoverability / usability.** The rules live in a separate tab, and the raw
   list (including `regex`, mutually-exclusive formats, and parameter-less
   `min`/`max`) is confusing for the **non-technical users** who must operate this
   builder.

## Goals

- Move validation controls **into the Properties tab, under the Required toggle.**
- Make them **actually persist and enforce** when users fill out forms.
- **Remove** the Conditions tab and the (now-empty) Validation tab.
- Optimize for **non-technical users**: no jargon, no impossible combinations,
  parameters built in.
- Support a **Currency ($)** format (the original request): `$` prefix, thousands
  separators, 2 decimals (USD).

## Non-Goals (YAGNI)

- No regex / custom-pattern UI (too technical for the audience).
- No server-side validation enforcement (the app does not server-validate form
  values today for any field; we match that with client masking + a submit gate).
- No configurable currency symbol (USD only).

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| UI shape | **Smart controls**: a `Format` dropdown + `Minimum`/`Maximum` boxes (not raw checkboxes) |
| Regex | **Dropped** from the UI |
| Persistence | **Add one column** `GUARDIAN.FIELDS.VALIDATION` (staging-first migration) |
| Tabs | **Remove both** Validation + Conditions tabs → tabs become Properties / Data / Layout |
| Enforcement scope | **All 4 fill paths** |

## Data Model

### New column (migration — idempotent, staging-first)

```sql
-- migrations/add_validation_to_fields.sql
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('GUARDIAN.FIELDS') AND name = 'VALIDATION'
)
  ALTER TABLE GUARDIAN.FIELDS ADD VALIDATION NVARCHAR(255) NULL;
```

### Stored shape

A compact JSON string in `VALIDATION`:

```json
{ "format": "currency", "min": 0, "max": 1000000 }
```

- `format` ∈ `none | email | url | number | currency | letters`
  (covers the old `email`, `url`, `numeric`, `alpha`, plus new `currency`).
- `min` / `max`: optional numbers. Meaning depends on format:
  - text-like formats (`none`, `email`, `url`, `letters`) → **character length**
  - `number` / `currency` → **numeric value**
- `null` / empty column = no constraints (backward compatible with existing fields).

> Currency rendering reads `format === "currency"` from this column. We do **not**
> also use `DISPLAY_FORMAT` — `VALIDATION` is the single source of truth.

### Frontend types

`src/types/formBuilder.ts` — extend `FormField`:

```ts
format?: 'none' | 'email' | 'url' | 'number' | 'currency' | 'letters';
min?: number;
max?: number;
// the old `validation?: string` is retired (no longer read or written)
```

`src/services/formService.ts`:
- `DbField` gains `VALIDATION?: string | null`.
- `convertFormFieldsToDbFields`: serialize `{format,min,max}` → `VALIDATION` JSON
  (emit `null` when format is `none`/absent and no min/max).
- `convertDbFieldsToFormFields`: parse `VALIDATION` JSON back into `format/min/max`.

## Builder UI (`FormBuilder.tsx`)

### Tabs

`SubTab` and the tab list lose `'validation'` and `'conditions'`:

```ts
type SubTab = 'properties' | 'data' | 'layout';
```

Delete the `subTab === 'validation'` and `subTab === 'conditions'` blocks and the
`VALIDATION_RULES` constant + `valRules`/`toggleValidation` helpers.

### Properties tab — new "Validation" subsection

Rendered **after the Required toggle row**, and **only for text/number-type
fields** (Text Input, Textarea, Number, Email, Phone, URL, Password). Hidden for
Dropdown/Radio/Checkbox/File/Date/Time/DateTime where format/length make no sense.

```
── Validation ─────────────────
Format    [ None ▾ ]      (None / Email / Website URL / Number / Currency ($) / Letters only)
Minimum   [        ]      label: "Min characters" (text) | "Min value" (number/currency)
Maximum   [        ]      label: "Max characters" (text) | "Max value" (number/currency)
```

- `Format` → `onChange({...field, format})`.
- `Minimum`/`Maximum` → numeric inputs → `onChange({...field, min/max})` (empty = undefined).
- Min/Max labels switch on whether `format` is `number`/`currency` (value) vs text (characters).

### Builder preview (`FieldPreview`)

When `field.format === 'currency'`, render the read-only preview input with a `$`
prefix and `$0.00` placeholder.

## Backend — thread `VALIDATION` through all field paths

All edits applied identically to **`server.cjs`**, **`server.js`**,
**`server-production.js`** (multi-server sync protocol).

**Writes:**
- `POST /api/forms` — add `VALIDATION` to the `INSERT INTO GUARDIAN.FIELDS (...)`
  column list + value (`field.VALIDATION`).  *(currently missing)*
- `PUT /api/forms/:formId` — add `VALIDATION` to both the new-field INSERT and the
  existing-field UPDATE.  *(currently missing)*
- `POST /api/fields`, `PUT /api/fields/:fieldId` — extract `VALIDATION` from
  `req.body`, add to INSERT/UPDATE. *(these already do this for `DISPLAY_FORMAT`;
  mirror the pattern for `VALIDATION`)*

**Reads (SELECT column list + response mapping):**
- `GET /api/forms/:id`
- `GET /api/requests/:id/form`  (runtime request fill)
- `GET /api/fields`
- Any securities/notice template-field fetch that feeds `CreateNoticeModalV2` and
  `SendNoticeForm` (see Enforcement → SendNoticeForm note).

Each must `SELECT f.VALIDATION` and include `VALIDATION: field.VALIDATION` in the
mapped JSON response.

> **Note on the securities path:** `SendNoticeForm` gets template fields from a
> securities-template source that currently returns `FIELD_LABEL/IS_PII/IS_ENABLED/
> IS_READ_ONLY` and does **not** include format/validation. Implementation must
> locate that source (legacy server endpoint and/or `server/routes/*.ts`) and
> thread `VALIDATION` (and a renderable field-type) through it so the securities
> form can enforce + format. This is the highest-effort sub-task.

## Enforcement — shared utility + all 4 fill paths

### Shared utility — `src/utils/fieldValidation.ts`

```ts
export type FieldRules = { format?: Format; min?: number; max?: number };

export function parseValidation(raw?: string | null): FieldRules;        // JSON → rules (safe)
export function validateField(value: string, rules: FieldRules, required: boolean): string | null; // error msg or null
export function validateAll(fields, values): Record<string, string>;     // fieldId/name → error
export function formatCurrency(raw: string): string;   // "1234.5" → "$1,234.50"
export function parseCurrency(display: string): string; // "$1,234.50" → "1234.50" (stored value)
export function maskCurrencyInput(raw: string): string; // restrict typing to digits + one '.'
```

Validation rules per format:
- `email` → standard email regex; `url` → URL regex; `letters` → alpha (+ spaces)
  only; `number` → numeric; `currency` → numeric (parsed from masked value).
- `min`/`max` → length for text formats, numeric value for number/currency.
- `required` (the existing toggle) → non-empty.
Error messages are plain-English ("Enter a valid email address", "Must be at least
$0.00", "Use letters only", etc.).

### Wire into each renderer (inline error + block submit)

1. **`SmartFormLayout` / `FieldCell`** (requests) — render `$` mask for currency;
   show inline error per field; submit handlers in `AddRequestModal` /
   `RequestModal` call `validateAll` and block on errors.
2. **`FidelitySubjectFormLayout`** (specialized request) — reuse its existing
   `validationErrors: Set<string>` + `sw-field--error` styling; populate from
   `validateAll`; currency mask on its `DocInput`.
3. **`CreateNoticeModalV2` / `FieldInput`** (notice templates — the screenshot's
   path) — map `VALIDATION` into its `ViewField`; currency mask; extend the
   existing required-only check in `submit()` to `validateAll`.
4. **`SendNoticeForm`** (securities) — depends on the backend note above; once the
   fields carry `VALIDATION` + type, render format-appropriate inputs (currently
   all `type="text"`), currency mask, and gate `buildPayload()`/submit on
   `validateAll`.

Currency fields **store the raw numeric value** (e.g. `1234.50`); the `$`/comma
formatting is display-only.

## Testing

- **Unit** (`bun test`): `fieldValidation.ts` — each format (valid/invalid),
  min/max as length vs value, `formatCurrency`/`parseCurrency`/`maskCurrencyInput`
  round-trips and edge cases (empty, `.`, multiple dots, leading zeros).
- **Manual** (staging, COMPANY_ID 54):
  1. Apply migration to staging DB.
  2. Build a template with a Currency field (min 0 / max 1,000,000) + an Email
     field + a "Letters only" field. Save.
  3. Reopen the template → confirm Format/min/max round-trip.
  4. Fill the template as a **Notice** and as a **Request** → confirm `$`/comma/
     2-decimal behavior, invalid values block submit with inline errors, valid
     submit persists the **raw** value.
  5. Repeat for the Fidelity-Subject and Securities (SendNoticeForm) paths.

## Rollout / ordering (per workflow)

- Migration is **manual + staging-first**; do **not** push `origin` until the prod
  DB has the `VALIDATION` column (per the "hold origin until prod DB migrated"
  rule). Ship to staging, verify, then prod migration, then origin.

## Files touched (summary)

- **New:** `migrations/add_validation_to_fields.sql`,
  `src/utils/fieldValidation.ts`, `src/utils/fieldValidation.test.ts`
- **Frontend:** `src/types/formBuilder.ts`, `src/services/formService.ts`,
  `src/components/FormBuilder/FormBuilder.tsx`,
  `src/components/SmartFormLayout.tsx`,
  `src/components/FidelitySubjectFormLayout.tsx`,
  `src/components/CreateNoticeModalV2/index.tsx`,
  `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx`,
  (submit handlers in `AddRequestModal.tsx`, `RequestModal.tsx`),
  possibly `src/types/template.ts`
- **Backend (×3 in sync):** `server.cjs`, `server.js`, `server-production.js`
  (+ securities template-field source if in `server/routes/*.ts`)
