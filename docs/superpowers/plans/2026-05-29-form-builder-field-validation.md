# Form Builder Field Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Form Builder field validation actually work — a Format dropdown (Email/URL/Number/Currency $/Letters) plus Min/Max, living under the Required toggle in the Properties tab, persisted to the DB and enforced when users fill out forms.

**Architecture:** Validation config is stored as compact JSON in a new `GUARDIAN.FIELDS.VALIDATION` column, threaded through the field read/write endpoints (3 synced server files) and `formService`. The builder edits `format/min/max` on `FormField`. A single shared utility (`src/utils/fieldValidation.ts`) provides format/min/max checking and USD currency masking, and is wired into all four runtime fill renderers (inline errors + submit gate).

**Tech Stack:** React + TypeScript (Vite), Express (CommonJS) + Prisma `$queryRawUnsafe` over SQL Server, Bun test runner.

**Spec:** `docs/superpowers/specs/2026-05-29-form-builder-field-validation-design.md`

**Multi-server sync rule:** Every server edit below is shown for `server.cjs`. Apply the **identical** change to `server.js` and `server-production.js` at the corresponding location (their field-handling code is byte-identical, offset by ~8 lines earlier than `server.cjs`). Verify with the grep step in each task.

**Rollout rule:** The migration is manual + staging-first. Do **not** push `origin` until the prod DB has the `VALIDATION` column (per the "hold origin until prod DB migrated" workflow rule).

---

## File Structure

**New files:**
- `migrations/add_validation_to_fields.sql` — adds the `VALIDATION` column (idempotent).
- `src/utils/fieldValidation.ts` — shared rules + currency masking/formatting.
- `src/utils/fieldValidation.test.ts` — unit tests (bun).

**Modified files:**
- `src/types/formBuilder.ts` — `FormField` gains `format/min/max`.
- `src/services/formService.ts` — `DbField.VALIDATION` + serialize/parse in converters.
- `src/components/FormBuilder/FormBuilder.tsx` — remove Validation+Conditions tabs; add Validation subsection to Properties; currency preview.
- `server.cjs`, `server.js`, `server-production.js` — thread `VALIDATION` through field write/read endpoints.
- `src/components/SmartFormLayout.tsx` — currency mask + inline errors (requests).
- `src/components/FidelitySubjectFormLayout.tsx` — currency mask + error set (Fidelity).
- `src/components/CreateNoticeModalV2/index.tsx` — map VALIDATION, mask, submit gate (notices).
- `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx` — format-aware inputs + submit gate (securities).
- `src/components/AddRequestModal.tsx`, `src/components/RequestModal.tsx` — call `validateAll` before submit.
- `src/types/template.ts` — ensure `VALIDATION` on the template field type.

---

## Phase 1 — Shared validation utility (TDD)

### Task 1: `fieldValidation.ts` types + `parseValidation`

**Files:**
- Create: `src/utils/fieldValidation.ts`
- Test: `src/utils/fieldValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/fieldValidation.test.ts
import { describe, it, expect } from 'bun:test';
import { parseValidation } from './fieldValidation';

describe('parseValidation', () => {
  it('parses a full JSON rule string', () => {
    expect(parseValidation('{"format":"currency","min":0,"max":1000000}'))
      .toEqual({ format: 'currency', min: 0, max: 1000000 });
  });
  it('returns empty rules for null/empty/garbage', () => {
    expect(parseValidation(null)).toEqual({ format: 'none' });
    expect(parseValidation('')).toEqual({ format: 'none' });
    expect(parseValidation('not json')).toEqual({ format: 'none' });
  });
  it('defaults missing format to none and drops non-numeric min/max', () => {
    expect(parseValidation('{"min":"x"}')).toEqual({ format: 'none' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: FAIL — `Cannot find module './fieldValidation'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/fieldValidation.ts
export type FieldFormat = 'none' | 'email' | 'url' | 'number' | 'currency' | 'letters';

export interface FieldRules {
  format: FieldFormat;
  min?: number;
  max?: number;
}

const FORMATS: FieldFormat[] = ['none', 'email', 'url', 'number', 'currency', 'letters'];

export function parseValidation(raw?: string | null): FieldRules {
  if (!raw) return { format: 'none' };
  let obj: any;
  try { obj = JSON.parse(raw); } catch { return { format: 'none' }; }
  if (!obj || typeof obj !== 'object') return { format: 'none' };
  const format: FieldFormat = FORMATS.includes(obj.format) ? obj.format : 'none';
  const rules: FieldRules = { format };
  if (typeof obj.min === 'number' && !Number.isNaN(obj.min)) rules.min = obj.min;
  if (typeof obj.max === 'number' && !Number.isNaN(obj.max)) rules.max = obj.max;
  return rules;
}

export function serializeValidation(rules: Partial<FieldRules>): string | null {
  const format = rules.format && rules.format !== 'none' ? rules.format : undefined;
  const hasMin = typeof rules.min === 'number' && !Number.isNaN(rules.min);
  const hasMax = typeof rules.max === 'number' && !Number.isNaN(rules.max);
  if (!format && !hasMin && !hasMax) return null;
  const out: any = {};
  if (format) out.format = format;
  if (hasMin) out.min = rules.min;
  if (hasMax) out.max = rules.max;
  return JSON.stringify(out);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/utils/fieldValidation.ts src/utils/fieldValidation.test.ts
git commit -m "feat(validation): add parseValidation/serializeValidation util"
```

---

### Task 2: Currency masking + formatting

**Files:**
- Modify: `src/utils/fieldValidation.ts`
- Test: `src/utils/fieldValidation.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to src/utils/fieldValidation.test.ts
import { maskCurrencyInput, parseCurrency, formatCurrency } from './fieldValidation';

describe('currency', () => {
  it('mask keeps digits and a single dot, max 2 decimals', () => {
    expect(maskCurrencyInput('$1,2a3.4567')).toBe('123.45');
    expect(maskCurrencyInput('12.3.4')).toBe('12.34');
    expect(maskCurrencyInput('abc')).toBe('');
  });
  it('parseCurrency strips formatting to a raw numeric string', () => {
    expect(parseCurrency('$1,234.50')).toBe('1234.50');
    expect(parseCurrency('')).toBe('');
  });
  it('formatCurrency renders $ + commas + 2 decimals', () => {
    expect(formatCurrency('1234.5')).toBe('$1,234.50');
    expect(formatCurrency('1000000')).toBe('$1,000,000.00');
    expect(formatCurrency('')).toBe('');
    expect(formatCurrency('abc')).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: FAIL — `maskCurrencyInput is not a function`.

- [ ] **Step 3: Implement**

```ts
// append to src/utils/fieldValidation.ts

// Restrict raw typed text to digits + at most one dot + 2 decimal places.
export function maskCurrencyInput(raw: string): string {
  let s = (raw ?? '').replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    const [int, dec = ''] = s.split('.');
    s = int + '.' + dec.slice(0, 2);
  }
  return s;
}

// "$1,234.50" -> "1234.50" (value to store)
export function parseCurrency(display: string): string {
  if (!display) return '';
  const s = String(display).replace(/[^0-9.]/g, '');
  return s;
}

// "1234.5" -> "$1,234.50" (display only)
export function formatCurrency(raw: string): string {
  if (raw === '' || raw == null) return '';
  const n = Number(parseCurrency(String(raw)));
  if (Number.isNaN(n)) return '';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/utils/fieldValidation.ts src/utils/fieldValidation.test.ts
git commit -m "feat(validation): add currency mask/parse/format helpers"
```

---

### Task 3: `validateField` + `validateAll`

**Files:**
- Modify: `src/utils/fieldValidation.ts`
- Test: `src/utils/fieldValidation.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to src/utils/fieldValidation.test.ts
import { validateField, validateAll } from './fieldValidation';

describe('validateField', () => {
  it('required blocks empty, allows present', () => {
    expect(validateField('', { format: 'none' }, true)).toBe('This field is required.');
    expect(validateField('hi', { format: 'none' }, true)).toBeNull();
  });
  it('skips format/length checks when empty and not required', () => {
    expect(validateField('', { format: 'email', min: 5 }, false)).toBeNull();
  });
  it('email/url/letters formats', () => {
    expect(validateField('bad', { format: 'email' }, false)).toBe('Enter a valid email address.');
    expect(validateField('a@b.co', { format: 'email' }, false)).toBeNull();
    expect(validateField('nope', { format: 'url' }, false)).toBe('Enter a valid web address (URL).');
    expect(validateField('https://x.com', { format: 'url' }, false)).toBeNull();
    expect(validateField('ab1', { format: 'letters' }, false)).toBe('Use letters only.');
    expect(validateField('Ab c', { format: 'letters' }, false)).toBeNull();
  });
  it('number/currency value range', () => {
    expect(validateField('5', { format: 'number', min: 10 }, false)).toBe('Must be at least 10.');
    expect(validateField('$5.00', { format: 'currency', max: 4 }, false)).toBe('Must be at most $4.00.');
    expect(validateField('$3.00', { format: 'currency', min: 0, max: 10 }, false)).toBeNull();
  });
  it('text length min/max', () => {
    expect(validateField('ab', { format: 'none', min: 3 }, false)).toBe('Must be at least 3 characters.');
    expect(validateField('abcd', { format: 'none', max: 3 }, false)).toBe('Must be at most 3 characters.');
  });
});

describe('validateAll', () => {
  it('returns fieldId -> error for each failing field', () => {
    const fields = [
      { key: '1', rules: { format: 'email' as const }, required: true },
      { key: '2', rules: { format: 'none' as const }, required: false },
    ];
    const values: Record<string, string> = { '1': 'bad', '2': '' };
    expect(validateAll(fields, values)).toEqual({ '1': 'Enter a valid email address.' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: FAIL — `validateField is not a function`.

- [ ] **Step 3: Implement**

```ts
// append to src/utils/fieldValidation.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i;
const LETTERS_RE = /^[A-Za-z\s]+$/;

export function validateField(value: string, rules: FieldRules, required: boolean): string | null {
  const v = (value ?? '').trim();
  if (!v) return required ? 'This field is required.' : null;

  switch (rules.format) {
    case 'email':
      if (!EMAIL_RE.test(v)) return 'Enter a valid email address.';
      break;
    case 'url':
      if (!URL_RE.test(v)) return 'Enter a valid web address (URL).';
      break;
    case 'letters':
      if (!LETTERS_RE.test(v)) return 'Use letters only.';
      break;
    case 'number':
    case 'currency': {
      const n = Number(rules.format === 'currency' ? parseCurrency(v) : v);
      if (Number.isNaN(n)) return rules.format === 'currency' ? 'Enter a valid amount.' : 'Enter a valid number.';
      if (typeof rules.min === 'number' && n < rules.min)
        return `Must be at least ${rules.format === 'currency' ? formatCurrency(String(rules.min)) : rules.min}.`;
      if (typeof rules.max === 'number' && n > rules.max)
        return `Must be at most ${rules.format === 'currency' ? formatCurrency(String(rules.max)) : rules.max}.`;
      return null;
    }
  }

  // length checks for text-like formats
  if (typeof rules.min === 'number' && v.length < rules.min) return `Must be at least ${rules.min} characters.`;
  if (typeof rules.max === 'number' && v.length > rules.max) return `Must be at most ${rules.max} characters.`;
  return null;
}

export function validateAll(
  fields: Array<{ key: string; rules: FieldRules; required: boolean }>,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const err = validateField(values[f.key] ?? '', f.rules, f.required);
    if (err) errors[f.key] = err;
  }
  return errors;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/utils/fieldValidation.ts src/utils/fieldValidation.test.ts
git commit -m "feat(validation): add validateField/validateAll rule checks"
```

---

## Phase 2 — Data model & persistence

### Task 4: Migration — add `VALIDATION` column

**Files:**
- Create: `migrations/add_validation_to_fields.sql`

- [ ] **Step 1: Write the migration (idempotent)**

```sql
-- migrations/add_validation_to_fields.sql
-- Adds per-field validation config (compact JSON) to GUARDIAN.FIELDS.
-- Idempotent: safe to run multiple times. Apply staging-first, then prod.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('GUARDIAN.FIELDS') AND name = 'VALIDATION'
)
BEGIN
    ALTER TABLE GUARDIAN.FIELDS ADD VALIDATION NVARCHAR(255) NULL;
END
```

- [ ] **Step 2: Add the column to the Prisma schema (keep client in sync)**

In `schema.prisma`, in `model FIELDS`, add after the `DISPLAY_FORMAT` line:

```prisma
  VALIDATION                   String?  @db.NVarChar(255)
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `bun prisma generate`
Expected: "Generated Prisma Client" success, no errors.

- [ ] **Step 4: Commit**

```bash
git add migrations/add_validation_to_fields.sql schema.prisma
git commit -m "feat(db): add VALIDATION column to GUARDIAN.FIELDS"
```

- [ ] **Step 5: Apply to staging DB (manual, before any end-to-end test)**

Run against the staging DB (the `DATABASE_URL` in CLAUDE.md / `.env`):
the contents of `migrations/add_validation_to_fields.sql`.
Expected: command completes; re-running is a no-op.

---

### Task 5: `FormField` type gains `format/min/max`

**Files:**
- Modify: `src/types/formBuilder.ts:11`

- [ ] **Step 1: Edit the interface**

Replace the `validation?: string;` line with:

```ts
  // Validation config (replaces the old inert `validation` string)
  format?: 'none' | 'email' | 'url' | 'number' | 'currency' | 'letters';
  min?: number; // characters (text formats) or value (number/currency)
  max?: number;
```

- [ ] **Step 2: Type-check**

Run: `tsc --noEmit`
Expected: errors ONLY where `field.validation` / `validation:` were referenced (FormBuilder.tsx mkField + validation tab). These are fixed in later tasks; note them.

- [ ] **Step 3: Commit**

```bash
git add src/types/formBuilder.ts
git commit -m "feat(types): replace FormField.validation with format/min/max"
```

---

### Task 6: `formService` — serialize/parse `VALIDATION`

**Files:**
- Modify: `src/services/formService.ts` (`DbField` ~line 15; `convertFormFieldsToDbFields` ~323; `convertDbFieldsToFormFields` ~342)

- [ ] **Step 1: Add `VALIDATION` to `DbField`**

In the `DbField` interface, after `OPTIONS?: string | null;`, add:

```ts
  VALIDATION?: string | null;
```

- [ ] **Step 2: Import the helpers at top of file**

```ts
import { parseValidation, serializeValidation } from '../utils/fieldValidation';
```

- [ ] **Step 3: Serialize on the way to DB**

In `convertFormFieldsToDbFields`, inside the returned object (after `OPTIONS: field.options || null,`), add:

```ts
        VALIDATION: serializeValidation({ format: field.format, min: field.min, max: field.max }),
```

- [ ] **Step 4: Parse on the way back to the UI**

In `convertDbFieldsToFormFields`, inside the returned object (after `options: field.OPTIONS || '',`), add:

```ts
        ...(() => { const r = parseValidation(field.VALIDATION); return { format: r.format, min: r.min, max: r.max }; })(),
```

- [ ] **Step 5: Type-check**

Run: `tsc --noEmit`
Expected: no new errors in `formService.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/services/formService.ts
git commit -m "feat(forms): round-trip VALIDATION through formService converters"
```

---

## Phase 3 — Builder UI

### Task 7: Remove Validation + Conditions tabs

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx` (SubTab type ~24; tab list ~446; tab blocks ~556-576; constants ~421; mkField ~53)

- [ ] **Step 1: Narrow the `SubTab` type (~line 24)**

```ts
type SubTab = 'properties' | 'data' | 'layout';
```

- [ ] **Step 2: Update the tab list (~line 446)**

```tsx
        {(['properties', 'data', 'layout'] as SubTab[]).map((t) => (
```

- [ ] **Step 3: Delete the validation + conditions blocks**

Remove the entire `{subTab === 'validation' && ( ... )}` block (~556-569) and the `{subTab === 'conditions' && ( ... )}` block (~571-576).

- [ ] **Step 4: Delete now-dead code**

Remove the `VALIDATION_RULES` constant (~421) and, inside `FieldEditor`, the `valRules` const and `toggleValidation` function (~436-441). In `mkField` (~53) remove the `validation: '',` line.

- [ ] **Step 5: Type-check & build**

Run: `tsc --noEmit`
Expected: no references to `VALIDATION_RULES`, `valRules`, `toggleValidation`, or `validation` remain in this file.

- [ ] **Step 6: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx
git commit -m "refactor(form-builder): remove dead Validation + Conditions tabs"
```

---

### Task 8: Add the Validation subsection to the Properties tab

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx` (Properties block, after the Required toggle row ~497; add a constant near `OPTION_FIELD_TYPES` ~422)

- [ ] **Step 1: Add a field-type allowlist constant (near line 422)**

```ts
// Field types where Format/Min/Max validation makes sense.
const VALIDATABLE_FIELD_TYPES = ['text', 'text_input', 'textarea', 'number', 'email', 'phone', 'url', 'password'];
```

- [ ] **Step 2: Add the Validation subsection (immediately after the Required toggle `</div>` ~line 497, still inside `subTab === 'properties'`)**

```tsx
            {VALIDATABLE_FIELD_TYPES.includes(field.fieldType) && (
              <div className="fb-valsection">
                <div className="fb-valhdr">Validation</div>
                <div className="fb-prow">
                  <label className="fb-plbl2">Format</label>
                  <select
                    className="fb-pinp"
                    value={field.format || 'none'}
                    onChange={(e) => onChange({ ...field, format: e.target.value as FormField['format'] })}
                  >
                    <option value="none">None</option>
                    <option value="email">Email</option>
                    <option value="url">Website URL</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency ($)</option>
                    <option value="letters">Letters only</option>
                  </select>
                </div>
                <div className="fb-prow">
                  <label className="fb-plbl2">
                    {field.format === 'number' || field.format === 'currency' ? 'Min value' : 'Min characters'}
                  </label>
                  <input
                    className="fb-pinp"
                    type="number"
                    value={field.min ?? ''}
                    onChange={(e) => onChange({ ...field, min: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="fb-prow">
                  <label className="fb-plbl2">
                    {field.format === 'number' || field.format === 'currency' ? 'Max value' : 'Max characters'}
                  </label>
                  <input
                    className="fb-pinp"
                    type="number"
                    value={field.max ?? ''}
                    onChange={(e) => onChange({ ...field, max: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
```

- [ ] **Step 3: Add minimal styling**

Styles live in the inline CSS string inside `FormBuilder.tsx` (injected via a `<style>` element ~line 684; e.g. `.fb-prow` at ~line 187). Add these two rules into that string, right after the `.fb-pinp:focus{...}` rule (~line 190):

```css
.fb-valsection{margin-top:14px;border-top:1px solid var(--fb-border);padding-top:12px}
.fb-valhdr{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--fb-t3);margin-bottom:8px}
```

- [ ] **Step 4: Currency preview in `FieldPreview` (~line 633, the `default` case)**

Replace the `default:` case body with:

```tsx
    default:
      if (field.format === 'currency') {
        return <input className="fb-fi" type="text" placeholder="$0.00" readOnly />;
      }
      return <input className="fb-fi" type="text" placeholder={field.placeholder || ''} readOnly />;
```

- [ ] **Step 5: Build & manual check**

Run: `tsc --noEmit && bun run build`
Expected: clean build. Then `bun run dev` + backend, open Form Builder, select a Text/Number field → confirm Format dropdown + adaptive Min/Max labels appear under Required; selecting Currency shows `$0.00` in the card preview.

- [ ] **Step 6: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx <css-file>
git commit -m "feat(form-builder): Format + Min/Max validation controls in Properties"
```

---

## Phase 4 — Backend threading (×3 server files)

### Task 9: `POST /api/forms` — write `VALIDATION`

**Files:**
- Modify: `server.cjs` (~9053-9065), `server.js` (~9045-9057), `server-production.js` (~9045-9057)

- [ ] **Step 1: Add the escaped value (after the `escapedOptions` line, ~9054)**

```js
                const escapedValidation = field.VALIDATION != null ? `'${String(field.VALIDATION).replace(/'/g, "''")}'` : 'NULL';
```

- [ ] **Step 2: Add the column to the INSERT list and VALUES**

Change the column list to include `VALIDATION` and the VALUES to include `${escapedValidation}`:

```js
                    INSERT INTO GUARDIAN.FIELDS (
                        FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED, [OPTIONS], VALIDATION,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID, ORGANIZATION_ID
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        '${escapedFieldName}', ${field.FIELD_TYPE_ID}, ${field.IS_REQUIRED ? 1 : 0}, ${field.IS_ACTIVE !== false ? 1 : 0}, 0, ${escapedOptions}, ${escapedValidation},
                        GETDATE(), GETDATE(), ${req.userId}, ${req.userId}, ${orgIdForFieldsSql}
                    )
```

- [ ] **Step 3: Apply identically to the other two files**

Run: `grep -n "FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED, \[OPTIONS\], VALIDATION" server.cjs server.js server-production.js`
Expected: one match per file.

- [ ] **Step 4: Smoke-start the server**

Run: `node -c server.js && node -c server-production.js && node -c server.cjs`
Expected: no syntax errors (exit 0).

- [ ] **Step 5: Commit**

```bash
git add server.cjs server.js server-production.js
git commit -m "feat(api): persist VALIDATION on POST /api/forms field insert"
```

---

### Task 10: `PUT /api/forms/:formId` — write `VALIDATION` (insert + update)

**Files:**
- Modify: `src/pages/FormBuilderPage.tsx` (update branch ~106-111), `server.cjs` (~7617-7679), `server.js` (~7609-7671), `server-production.js` (~7609-7671)

> **Important:** unlike create (which sends `DbField` via `convertFormFieldsToDbFields`), the update path sends **raw camelCase `FormField`s** as `formFields` (see `updateFormTemplate`). So the server update path will NOT see `field.VALIDATION` unless the client attaches it. Step 1 attaches it client-side so the server stays symmetric with create (`field.VALIDATION`).

- [ ] **Step 1: Client — attach serialized `VALIDATION` to each updated field**

In `FormBuilderPage.tsx`, import the serializer and map `savableFields` before the `updateFormTemplate` call (~106):

```ts
import { serializeValidation } from '../utils/fieldValidation';
// ...
const fieldsForUpdate = savableFields.map((f) => ({
  ...f,
  VALIDATION: serializeValidation({ format: f.format, min: f.min, max: f.max }),
}));
await formService.updateFormTemplate(numericFormId, {
  name: data.name,
  description: data.description,
  formFields: fieldsForUpdate,
});
```

- [ ] **Step 2: Server new-field INSERT — add column + value (~7617)**

Add `VALIDATION` to the column list and `${field.VALIDATION || null}` to VALUES:

```js
                    FIELD_NAME, FIELD_TYPE_ID, ORGANIZATION_ID, IS_ACTIVE, IS_DELETED, IS_PUBLIC, IS_SENSITIVE,
                    [OPTIONS], VALIDATION,
```
```js
                    ${field.fieldName}, ${field.fieldTypeId || 1}, ${req.companyId}, 1, 0, 1, 0,
                    ${field.options || null}, ${field.VALIDATION || null},
```

- [ ] **Step 3: Server existing-field UPDATE — add column**

In the `UPDATE GUARDIAN.FIELDS SET ...` block (~7670), add:

```js
    VALIDATION = ${field.VALIDATION || null},
```
immediately after the `[OPTIONS] = ${field.options || null},` line.

- [ ] **Step 4: Apply Steps 2-3 identically to the other two files**

Run: `grep -n "VALIDATION = " server.cjs server.js server-production.js`
Expected: one match per file.

- [ ] **Step 5: Syntax check**

Run: `node -c server.cjs && node -c server.js && node -c server-production.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FormBuilderPage.tsx server.cjs server.js server-production.js
git commit -m "feat(api): persist VALIDATION on PUT /api/forms (insert + update)"
```

---

### Task 11: `POST`/`PUT /api/fields` — thread `VALIDATION`

**Files:**
- Modify: `server.cjs` (POST ~8414-8491; PUT ~8557-8606) + `server.js`/`server-production.js` (~8 lines earlier)

- [ ] **Step 1: Extract from `req.body`**

In both the POST and PUT `const { ... } = req.body;` destructures (which already include `DISPLAY_FORMAT`), add `VALIDATION,` next to `DISPLAY_FORMAT,`.

- [ ] **Step 2: POST INSERT — add column + value**

Add `VALIDATION` to the INSERT column list (next to `DISPLAY_FORMAT`) and `${VALIDATION || null},` to the VALUES (next to `${DISPLAY_FORMAT || null},`).

- [ ] **Step 3: PUT UPDATE — add assignment**

In the `UPDATE GUARDIAN.FIELDS SET` block add:

```js
    VALIDATION = ${VALIDATION || null},
```
next to the existing `DISPLAY_FORMAT = ${DISPLAY_FORMAT || null},` line.

- [ ] **Step 4: Response maps — include `VALIDATION`**

In both endpoints' response `.map(...)` objects (which already emit `DISPLAY_FORMAT: field.DISPLAY_FORMAT,`) add `VALIDATION: field.VALIDATION,`.

- [ ] **Step 5: Apply to all 3 files; syntax check**

Run: `node -c server.cjs && node -c server.js && node -c server-production.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server.cjs server.js server-production.js
git commit -m "feat(api): thread VALIDATION through POST/PUT /api/fields"
```

---

### Task 12: SELECT + response maps — return `VALIDATION`

**Files:**
- Modify (×3 servers): `GET /api/forms/:id` (cjs ~7461 SELECT, ~7485 map), `GET /api/requests/:id/form` (cjs ~6793 SELECT, ~6898 map), `GET /api/fields` (cjs ~8353 SELECT, ~8377 map)

- [ ] **Step 1: Add `f.VALIDATION` to each SELECT column list**

In each of the three `SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, ...` statements, add `f.VALIDATION,` right after `f.DISPLAY_FORMAT,`.

- [ ] **Step 2: Add `VALIDATION` to each response `.map(...)` object**

In each mapping object that emits `DISPLAY_FORMAT: field.DISPLAY_FORMAT,`, add:

```js
        VALIDATION: field.VALIDATION,
```

- [ ] **Step 3: Apply to all 3 server files**

Run: `grep -c "VALIDATION: field.VALIDATION" server.cjs server.js server-production.js`
Expected: each file's count = (number of read endpoints touched), equal across files.

- [ ] **Step 4: Syntax check**

Run: `node -c server.cjs && node -c server.js && node -c server-production.js`
Expected: exit 0.

- [ ] **Step 5: End-to-end round-trip test (staging migration must be applied — Task 4 Step 5)**

Start backend + frontend. In Form Builder create a template with a Currency field (Min 0 / Max 1000000) + an Email field; Save. Reopen the template.
Expected: Format = Currency/Email and Min/Max persist (round-trip via `GET /api/forms/:id`).

- [ ] **Step 6: Commit**

```bash
git add server.cjs server.js server-production.js
git commit -m "feat(api): return VALIDATION from field read endpoints"
```

---

## Phase 5 — Enforcement in the fill renderers

> All four renderers import from `src/utils/fieldValidation`. Each shows a per-field
> error and blocks submit. Currency inputs use `maskCurrencyInput` on change and
> `formatCurrency` for display; the **stored** value is the raw numeric string
> (`parseCurrency`).

### Task 13: Requests — `SmartFormLayout` / `FieldCell`

**Files:**
- Modify: `src/components/SmartFormLayout.tsx` (`FieldCell` ~115-200; props), `src/components/SectionedFormRenderer.tsx` (pass-through of `validationErrors`), `src/components/AddRequestModal.tsx` (submit ~345/464), `src/components/RequestModal.tsx` (submit ~872)

- [ ] **Step 1: Render currency + show error in `FieldCell`**

At the top of `SmartFormLayout.tsx`:

```ts
import { parseValidation, maskCurrencyInput, formatCurrency } from '../utils/fieldValidation';
```

In `FieldCell`, before the default text input (the `<input type={getInputType()}>` branch ~189), compute rules and, when `rules.format === 'currency'`, render a masked input:

```tsx
  const rules = parseValidation((field as any).VALIDATION);
  // ...
  if (rules.format === 'currency') {
    return (
      <input
        className={error ? 'sw-field sw-field--error' : 'sw-field'}
        inputMode="decimal"
        value={value ? formatCurrency(value) : ''}
        onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
        placeholder="$0.00"
      />
    );
  }
```

Where `error` comes from a `validationErrors?: Record<string, string>` prop (extend the existing `validationErrors?: Set<string>` to also accept a message map; read `validationErrors?.[String(field.FIELD_ID)]`). Render `{error && <div className="sw-field-error">{error}</div>}` under each input.

- [ ] **Step 2: Gate submit in `AddRequestModal` and `RequestModal`**

Import and run `validateAll` before the existing submit. Build the field list from the form's fields:

```ts
import { parseValidation, validateAll } from '../utils/fieldValidation';

const errs = validateAll(
  fields.map((f: any) => ({ key: String(f.FIELD_ID), rules: parseValidation(f.VALIDATION), required: !!f.IS_REQUIRED })),
  Object.fromEntries(Object.entries(fieldValues).map(([k, v]) => [k, String(v ?? '')])),
);
if (Object.keys(errs).length) { setValidationErrors(errs); /* abort submit */ return; }
```

Wire `errs` into the `validationErrors` state already used for the Fidelity flow; pass it down through `SectionedFormRenderer` to `SmartFormLayout`.

- [ ] **Step 3: Build & manual test**

Run: `tsc --noEmit && bun run build`
Then fill a Request built from a template with a Currency field: typing letters is rejected, value shows `$1,234.56`, submitting an out-of-range value shows an inline error and blocks submit; a valid submit stores the raw number.

- [ ] **Step 4: Commit**

```bash
git add src/components/SmartFormLayout.tsx src/components/SectionedFormRenderer.tsx src/components/AddRequestModal.tsx src/components/RequestModal.tsx
git commit -m "feat(requests): enforce field validation + currency mask in SmartFormLayout"
```

---

### Task 14: Fidelity — `FidelitySubjectFormLayout`

**Files:**
- Modify: `src/components/FidelitySubjectFormLayout.tsx` (`DocInput` ~199-216; uses existing `validationErrors: Set<string>`)

- [ ] **Step 1: Currency mask in `DocInput`**

Import helpers; when the field's parsed rules format is `currency`, render a masked `DocInput` (value via `formatCurrency`, onChange via `maskCurrencyInput`), mirroring Task 13 Step 1.

- [ ] **Step 2: Populate `validationErrors` from `validateAll`**

In `AddRequestModal`'s Fidelity submit path (`validateFidelityRequiredFields` ~272-311), after the existing required checks, also run `validateAll` over the Fidelity fields and merge failing field names/ids into the existing `Set` used for `sw-field--error` highlighting; abort submit if non-empty.

- [ ] **Step 3: Build & manual test**

Run: `tsc --noEmit && bun run build`
Then on a Fidelity-Subject request, a currency/email field with bad input highlights red and blocks submit.

- [ ] **Step 4: Commit**

```bash
git add src/components/FidelitySubjectFormLayout.tsx src/components/AddRequestModal.tsx
git commit -m "feat(fidelity): enforce field validation + currency mask"
```

---

### Task 15: Notices — `CreateNoticeModalV2`

**Files:**
- Modify: `src/components/CreateNoticeModalV2/index.tsx` (ViewField map ~127-130; `FieldInput` ~821-877; `submit()` ~213-283), `src/types/template.ts` (ensure `VALIDATION`)

- [ ] **Step 1: Ensure `VALIDATION` reaches the component**

In `src/types/template.ts`, add `VALIDATION?: string | null;` to the template field interface (alongside `DISPLAY_FORMAT`). In the `viewFields` map (~127), carry it onto the `ViewField`: add `validation: f.VALIDATION` to the mapped object and `validation?: string | null` to the `ViewField` type.

- [ ] **Step 2: Currency input + error in `FieldInput`**

Import `parseValidation, maskCurrencyInput, formatCurrency` and, in `FieldInput` (~821), before the default text `<input>`, branch on `parseValidation(field.validation).format === 'currency'` to render a masked input (value `formatCurrency(value)`, onChange `maskCurrencyInput`). Show `errors[field.id]` text under the input.

- [ ] **Step 3: Gate `submit()`**

Extend the existing required-only check (~220-225) with:

```ts
import { parseValidation, validateAll } from '../../utils/fieldValidation';

const fieldErrors = validateAll(
  viewFields.map((f) => ({ key: f.id, rules: parseValidation((f as any).validation), required: f.required })),
  templateValues,
);
if (Object.keys(fieldErrors).length) { setFieldErrors(fieldErrors); return setError('Please fix the highlighted fields.'); }
```

Add `fieldErrors` state and pass it to the field render loop (~789-811) so `FieldInput` can show per-field messages.

- [ ] **Step 4: Build & manual test (the screenshot's case)**

Run: `tsc --noEmit && bun run build`
Create a Notice from a template that has a Currency field (like "Loss Exposure"): currency masking works, invalid/out-of-range blocks send with an inline error, raw value is stored in `templateValuesByFieldId`.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreateNoticeModalV2/index.tsx src/types/template.ts
git commit -m "feat(notices): enforce field validation + currency in CreateNoticeModalV2"
```

---

### Task 16: Securities — `SendNoticeForm` (+ backend field source)

**Files:**
- Modify: `src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx` (render ~276-289; `buildPayload`/submit ~134-220)
- Investigate + modify: the securities template-field source that feeds this form (find with `grep -rn "IS_READ_ONLY\|FIELD_LABEL" server*.js server.cjs server/routes 2>/dev/null`)

- [ ] **Step 1: Thread `VALIDATION` (and field type) into the securities template fields**

Locate the endpoint that returns the SendNoticeForm fields (legacy `server.*` and/or `server/routes/*.ts`). Add `VALIDATION` (and the field type description) to that SELECT + response map, mirroring Task 12. If it lives in the TS server, rebuild with `npm run build:server`.

- [ ] **Step 2: Render format-appropriate inputs**

In `SendNoticeForm.tsx`, replace the blanket `<Form.Control type="text">` (~276) with a branch: when `parseValidation(f.VALIDATION).format === 'currency'`, render a masked input (value `formatCurrency`, onChange `maskCurrencyInput`); otherwise keep text. Show inline error per field.

- [ ] **Step 3: Gate `buildPayload`/submit**

In `buildPayload` (~134-151), after the existing recipient/SECURITY_SYMBOL checks, run `validateAll` over `fields` keyed by `FIELD_NAME` against `values`; if any errors, set them into a new `fieldErrors` state and return null/abort so neither `submitDirect` nor `submitForApproval` proceeds.

- [ ] **Step 4: Build & manual test**

Run: `tsc --noEmit && bun run build` (and `npm run build:server` if the TS server was touched).
On a Securities Notice, a currency field masks/validates and blocks send when invalid.

- [ ] **Step 5: Commit**

```bash
git add src/components/SecuritiesNoticeTemplate/SendNoticeForm.tsx server.cjs server.js server-production.js
git commit -m "feat(securities): enforce field validation + currency in SendNoticeForm"
```

---

## Phase 6 — Final verification & docs

### Task 17: Full verification pass

- [ ] **Step 1: Unit tests**

Run: `bun test src/utils/fieldValidation.test.ts`
Expected: all pass.

- [ ] **Step 2: Type + build**

Run: `tsc --noEmit && bun run build`
Expected: clean.

- [ ] **Step 3: Server syntax**

Run: `node -c server.cjs && node -c server.js && node -c server-production.js`
Expected: exit 0.

- [ ] **Step 4: Manual matrix (staging DB migrated)**

Build one template containing: Currency (min 0/max 1,000,000), Email, Letters-only, and a plain text field with Min/Max characters. Save → reopen (all round-trip). Then fill it as **Request**, **Fidelity-Subject** (if applicable), **Notice**, and **Securities** — confirm masking, inline errors, submit gating, and that valid submissions store the raw value.

- [ ] **Step 5: Update docs**

In `CLAUDE.md`, under Forms & Fields, note the new `VALIDATION` column and the Properties-tab Format/Min/Max controls; remove any mention of the Validation/Conditions tabs.

```bash
git add CLAUDE.md
git commit -m "docs: document field validation (VALIDATION column + Properties controls)"
```

### Task 18: Ship (staging-first)

- [ ] **Step 1: Confirm staging DB migration applied** (Task 4 Step 5).
- [ ] **Step 2: Push to staging remote** and monitor the pipeline until the new build lands (~8 min); report success/failure.
- [ ] **Step 3: Do NOT push `origin`** until the prod DB has the `VALIDATION` column applied (per the hold-origin rule).
```
