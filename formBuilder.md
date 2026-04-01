# Guardian Form Builder — Integration Spec

> **For the AI agent:** This document contains everything needed to add a fully functional dynamic form builder to the Guardian MVP application. Read every section before writing any code. Guardian is a **React 18 + Vite + TypeScript** frontend with an **Express.js backend** (`server.cjs`). It is NOT Next.js. Follow Guardian's existing patterns exactly — company isolation, JWT auth, SQL Server queries, and the three-server sync rule.

---

## Guardian stack facts (read before touching anything)

| Concern | Reality |
|---|---|
| Frontend | React 18 + TypeScript, built with **Vite** |
| Routing | **React Router DOM v7** — routes live in `App.tsx` or equivalent router file |
| Styling | **Tailwind CSS** + Bootstrap utilities |
| UI primitives | React Bootstrap, Lucide React, React Icons |
| Backend | **Express.js** in `server.cjs` (dev source of truth) |
| Database | **Microsoft SQL Server** via Prisma `$queryRawUnsafe` |
| DB schema prefix | All tables are in the `GUARDIAN` schema (e.g. `GUARDIAN.FORMS`) |
| Auth | JWT tokens — `getAuthenticatedUserCompany` middleware on protected routes |
| Package manager | **Bun** (use `bun install`, `bun run`, `bun test`) |
| Dev ports | Frontend: **5175** · Backend: **3001** |
| Server files | `server.cjs` (dev) · `server-production.js` (prod source) · `server.js` (prod deployed) |
| Test runner | **Bun test** — NOT Vitest, NOT Jest |

---

## ⚠️ Critical rules before starting

1. **Three-server sync** — every API endpoint added to `server.cjs` must also be added to `server-production.js` and `server.js` identically. Skipping this means the endpoint will 404 in production.
2. **Company isolation** — every DB query must filter by `COMPANY_ID` extracted from the JWT via `getAuthenticatedUserCompany` middleware. No exceptions.
3. **SQL Server query syntax** — use `${variable}` interpolation inside `prisma.$queryRawUnsafe(...)`, NOT `?` placeholders.
4. **TypeScript** — all new frontend files use `.tsx` / `.ts` extensions.
5. **Bun** — use `bun install`, not `npm install`.
6. **Existing tables** — `GUARDIAN.FORMS` and `GUARDIAN.FIELDS` already exist. The form builder adds a JSON schema column and a versions table rather than replacing these.

---

## What gets built

A three-panel drag-and-drop form builder page at `/form-builder`:

- **Left panel** — field type palette (click to add, drag to insert at position) + tree view
- **Center canvas** — sortable field cards with live previews
- **Right panel** — per-field properties, data, layout, validation, conditions tabs
- **Toolbar** — Editor / Preview / JSON Code views, Undo, Clear, Save

---

## Dependencies to install

**None.** The component uses the browser's native HTML5 Drag and Drop API via React's built-in drag event props (`onDragStart`, `onDragOver`, `onDrop`). No third-party DnD library is required.

> **Why native DnD instead of @dnd-kit?** The native HTML5 DnD API is fully supported in all modern browsers, requires zero dependencies, and — critically — requires `e.dataTransfer.setData()` to be called in `dragstart` for `drop` events to fire in Chrome. The interleaved drop-line approach used here gives precise, unambiguous insert positions without the collision-detection complexity of a DnD library.

---

## File structure to create

```
src/
  components/
    FormBuilder/
      FormBuilder.tsx          ← main component (full source at bottom of this doc)
      index.ts                 ← barrel export
```

That's it for new files. Everything else is a modification to existing files.

---

## Step 1 — Barrel export

**File:** `src/components/FormBuilder/index.ts`

```ts
export { default } from './FormBuilder';
```

---

## Step 2 — Add the route to React Router

Find Guardian's router configuration file (likely `src/App.tsx` or `src/router.tsx`). Add the `/form-builder` route inside the authenticated/protected route wrapper — the same wrapper used for `/dashboard`, `/requests`, etc.

```tsx
// In the existing protected routes section:
import FormBuilder from './components/FormBuilder';

// Add alongside existing routes:
<Route path="/form-builder" element={<FormBuilder />} />
```

> **Agent note:** The FormBuilder component manages its own full-viewport layout. Wrap it in whatever authentication guard Guardian uses for protected pages (the same one wrapping the dashboard). Do NOT add extra padding or max-width containers — the builder needs 100% of the viewport.

---

## Step 3 — Add the nav link

Find Guardian's main sidebar navigation component (search for `Dashboard` or `Requests` in the nav files). Add a Form Builder link using the same pattern as existing nav items:

```tsx
import { FileText } from 'lucide-react'; // or whichever icon fits

// Add to the nav items list:
<NavItem to="/form-builder" icon={<FileText size={16} />} label="Form Builder" />
```

Use whatever `NavItem` / `NavLink` component pattern Guardian already uses — match it exactly.

---

## Step 4 — Database: add schema column and versions table

Guardian's `GUARDIAN.FORMS` table already exists. The form builder stores the drag-and-drop schema as JSON in a new `BUILDER_SCHEMA` column and tracks versions in a new `GUARDIAN.FORM_BUILDER_VERSIONS` table.

Run these SQL migrations against the SQL Server database:

```sql
-- Add BUILDER_SCHEMA column to existing GUARDIAN.FORMS table
-- NVARCHAR(MAX) is SQL Server's equivalent of TEXT/JSON
ALTER TABLE GUARDIAN.FORMS
ADD BUILDER_SCHEMA NVARCHAR(MAX) NULL;

-- New table for version history
CREATE TABLE GUARDIAN.FORM_BUILDER_VERSIONS (
  VERSION_ID    INT IDENTITY(1,1) PRIMARY KEY,
  FORM_ID       INT NOT NULL,
  VERSION_NUM   INT NOT NULL,
  SCHEMA_JSON   NVARCHAR(MAX) NOT NULL,
  CREATED_BY    INT NOT NULL,
  CREATED_AT    DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT FK_FBV_FORM FOREIGN KEY (FORM_ID) REFERENCES GUARDIAN.FORMS(FORM_ID)
);
```

After running migrations, regenerate the Prisma client:

```bash
bun prisma generate
```

---

## Step 5 — API endpoints in server.cjs

Add these four endpoints to `server.cjs`. Then **immediately copy the identical blocks** to `server-production.js` and `server.js`.

Find an existing protected endpoint block in `server.cjs` (e.g. the `GET /api/forms` endpoint) to understand the exact middleware pattern Guardian uses — copy that pattern.

```js
// ── GET /api/form-builder/forms ──────────────────────────────────────
// Returns all form builder forms for the authenticated user's company.
app.get('/api/form-builder/forms', getAuthenticatedUserCompany, async (req, res) => {
  try {
    const companyId = req.companyId;
    const forms = await prisma.$queryRawUnsafe(`
      SELECT FORM_ID, FORM_NAME, FORM_TYPE, STATUS, BUILDER_SCHEMA, CREATED_AT, UPDATED_AT
      FROM GUARDIAN.FORMS
      WHERE COMPANY_ID = ${companyId}
        AND BUILDER_SCHEMA IS NOT NULL
      ORDER BY UPDATED_AT DESC
    `);
    res.json(forms);
  } catch (error) {
    console.error('GET /api/form-builder/forms error:', error);
    res.status(500).json({ error: 'Failed to fetch form builder forms' });
  }
});

// ── POST /api/form-builder/forms ─────────────────────────────────────
// Creates or updates a form builder form (with automatic versioning).
// Body: { formName, formType, schema: Field[], formId? }
app.post('/api/form-builder/forms', getAuthenticatedUserCompany, async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId    = req.userId;
    const { formName, formType, schema, formId } = req.body;

    if (!formName || !schema) {
      return res.status(400).json({ error: 'formName and schema are required' });
    }

    const schemaJson = JSON.stringify(schema);
    const type       = formType || 'Requests';

    if (formId) {
      // Update existing form
      await prisma.$queryRawUnsafe(`
        UPDATE GUARDIAN.FORMS
        SET FORM_NAME = '${formName.replace(/'/g, "''")}',
            FORM_TYPE = '${type}',
            BUILDER_SCHEMA = '${schemaJson.replace(/'/g, "''")}',
            UPDATED_AT = GETDATE()
        WHERE FORM_ID = ${formId}
          AND COMPANY_ID = ${companyId}
      `);

      // Save version snapshot
      const versionResult = await prisma.$queryRawUnsafe(`
        SELECT ISNULL(MAX(VERSION_NUM), 0) + 1 AS NEXT_VERSION
        FROM GUARDIAN.FORM_BUILDER_VERSIONS
        WHERE FORM_ID = ${formId}
      `);
      const nextVersion = versionResult[0]?.NEXT_VERSION ?? 1;

      await prisma.$queryRawUnsafe(`
        INSERT INTO GUARDIAN.FORM_BUILDER_VERSIONS
          (FORM_ID, VERSION_NUM, SCHEMA_JSON, CREATED_BY)
        VALUES
          (${formId}, ${nextVersion}, '${schemaJson.replace(/'/g, "''")}', ${userId})
      `);

      return res.json({ formId, saved: true });
    } else {
      // Create new form — look up ORGANIZATION_ID from company
      const orgResult = await prisma.$queryRawUnsafe(`
        SELECT ORGANIZATION_ID FROM GUARDIAN.COMPANY WHERE COMPANY_ID = ${companyId}
      `);
      const organizationId = orgResult[0]?.ORGANIZATION_ID;

      const insertResult = await prisma.$queryRawUnsafe(`
        INSERT INTO GUARDIAN.FORMS
          (FORM_NAME, FORM_TYPE, STATUS, COMPANY_ID, ORGANIZATION_ID, BUILDER_SCHEMA, CREATED_AT, UPDATED_AT)
        OUTPUT INSERTED.FORM_ID
        VALUES
          ('${formName.replace(/'/g, "''")}', '${type}', 'draft',
           ${companyId}, ${organizationId},
           '${schemaJson.replace(/'/g, "''")}',
           GETDATE(), GETDATE())
      `);

      const newFormId = insertResult[0]?.FORM_ID;

      await prisma.$queryRawUnsafe(`
        INSERT INTO GUARDIAN.FORM_BUILDER_VERSIONS
          (FORM_ID, VERSION_NUM, SCHEMA_JSON, CREATED_BY)
        VALUES
          (${newFormId}, 1, '${schemaJson.replace(/'/g, "''")}', ${userId})
      `);

      return res.status(201).json({ formId: newFormId, saved: true });
    }
  } catch (error) {
    console.error('POST /api/form-builder/forms error:', error);
    res.status(500).json({ error: 'Failed to save form' });
  }
});

// ── GET /api/form-builder/forms/:formId ──────────────────────────────
// Returns a single form with its full version history.
app.get('/api/form-builder/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { formId } = req.params;

    const forms = await prisma.$queryRawUnsafe(`
      SELECT FORM_ID, FORM_NAME, FORM_TYPE, STATUS, BUILDER_SCHEMA, CREATED_AT, UPDATED_AT
      FROM GUARDIAN.FORMS
      WHERE FORM_ID = ${formId}
        AND COMPANY_ID = ${companyId}
    `);

    if (!forms.length) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const versions = await prisma.$queryRawUnsafe(`
      SELECT VERSION_ID, VERSION_NUM, CREATED_BY, CREATED_AT
      FROM GUARDIAN.FORM_BUILDER_VERSIONS
      WHERE FORM_ID = ${formId}
      ORDER BY VERSION_NUM DESC
    `);

    res.json({ ...forms[0], versions });
  } catch (error) {
    console.error('GET /api/form-builder/forms/:formId error:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// ── GET /api/form-builder/field-types ────────────────────────────────
// Returns available field types from the GUARDIAN.FIELD_TYPE table.
app.get('/api/form-builder/field-types', getAuthenticatedUserCompany, async (req, res) => {
  try {
    const types = await prisma.$queryRawUnsafe(`
      SELECT FIELD_TYPE_ID, FIELD_TYPE_NAME, FIELD_TYPE_DESCRIPTION
      FROM GUARDIAN.FIELD_TYPE
      ORDER BY FIELD_TYPE_NAME
    `);
    res.json(types);
  } catch (error) {
    console.error('GET /api/form-builder/field-types error:', error);
    res.status(500).json({ error: 'Failed to fetch field types' });
  }
});
```

### Sync to all three server files

After adding to `server.cjs`, copy the identical blocks into `server-production.js` and `server.js`, then commit all three together:

```bash
git add server.cjs server-production.js server.js
git commit -m "feat: add form builder API endpoints to all server files"
```

### Update CLAUDE.md

Add these four lines to the **Forms & Fields** section of `CLAUDE.md`:

```
- `GET /api/form-builder/forms` - Get all form builder forms for company
- `POST /api/form-builder/forms` - Create or update a form builder form (with versioning)
- `GET /api/form-builder/forms/:formId` - Get specific form with version history
- `GET /api/form-builder/field-types` - Get available field types from FIELD_TYPE table
```

---

## Step 6 — Wire the Save button

The `handleSave` function inside `FormBuilder.tsx` reads the JWT from `localStorage` — the same pattern used by Guardian's other components. It is already implemented in the full source below. To verify it's correct, search for `handleSave` in the component source and confirm it:

1. Reads `localStorage.getItem('token')` and validates it is not null or the string `'null'`
2. POSTs to `/api/form-builder/forms` with a `Bearer` token in the `Authorization` header
3. Sends `{ formName, formType, schema, formId }` where `formId` is `null` on new forms and the server-returned ID on updates

---

## CSS variables

The component injects these into `:root`. Map `--fb-accent` to Guardian's primary brand colour if it differs from `#3B6EF0`. All variables are **prefixed `--fb-`** to avoid colliding with any existing Guardian CSS variables.

```css
--fb-accent:        #3B6EF0
--fb-accent-light:  rgba(59,110,240,.08)
--fb-accent-faint:  rgba(59,110,240,.35)
--fb-accent-glow:   rgba(59,110,240,.14)
--fb-bg:            #F3F5F9
--fb-panel:         #ffffff
--fb-input:         #FAFBFC
--fb-secondary:     #F7F8FA
--fb-border:        #E4E6EB
--fb-text:          #1A1D23
--fb-text-2:        #6B7280
--fb-text-3:        #9EA5B3
--fb-danger:        #E53935
```

---

## Drag-and-drop mechanics (important — read before modifying)

The component uses the **browser's native HTML5 Drag and Drop API** via React drag event props. Do not replace this with a DnD library without understanding the following constraints.

### Why native DnD

Three bugs that existed in the previous `@dnd-kit` implementation (and are now fixed):

1. **Chrome requires `setData`** — Chrome will not fire `drop` events unless `dragstart` calls `e.dataTransfer.setData('text/plain', someString)`. Both palette items and canvas cards call this.

2. **Interleaved drop-line approach** — Rather than trying to detect "top half vs bottom half" of a card during `dragover` (fragile, imprecise), the canvas renders thin `div.drop-line` elements *between* every card. Each line has a `data-insert` attribute indicating the index to insert at. When the user hovers over a line it turns blue; dropping fires `handleDrop(insertAt)`.

3. **Shared drag ref** — A `useRef` object `drag.current` holds `{ type: 'palette'|'canvas', payload: string }` set in `onDragStart`. All drop handlers read from this ref, avoiding stale-closure bugs.

### Insert index math

When reordering a canvas card downward, the source card is removed first, which shifts all subsequent indices down by one. `handleDrop` accounts for this:

```ts
let tgt = insertAt;
if (tgt > srcIdx) tgt--;   // adjust for removal
if (tgt === srcIdx) return; // same position — no-op
const [moved] = newFields.splice(srcIdx, 1);
newFields.splice(tgt, 0, moved);
```

---

## Component behaviour reference

### Three views (toolbar toggle)

| View | Description |
|---|---|
| **Editor** | Three-panel layout — palette left, canvas center, properties right |
| **Preview** | Renders the live form as end users see it |
| **Code** | Exported JSON schema with Copy button |

### Left panel tabs

| Tab | Description |
|---|---|
| **Elements** | Field type palette. Click to append, drag to insert at any position |
| **Tree** | Ordered list of all canvas fields — click to select and edit |

### Right panel tabs

| Tab | Description |
|---|---|
| **Properties** | Label, name/key, placeholder, help text, required toggle |
| **Data** | Options editor for select / radio / checkbox types |
| **Layout** | Size (sm/md/lg) and column span (1/3, 2/3, full) |
| **Validation** | Validation rule checkboxes (required, min, max, email, url, regex…) |
| **Conditions** | Stub — wire to condition engine in a future phase |
| **Theme** | Accent colour swatches + border radius slider |
| **Export** | Copy JSON schema to clipboard |
| **Model** | Live read-only JSON schema preview |

### Form schema shape (what gets saved to `BUILDER_SCHEMA`)

```json
[
  {
    "type": "text",
    "name": "full_name",
    "label": "Full Name",
    "placeholder": "Enter your full name",
    "required": true,
    "size": "md",
    "columns": 3,
    "options": [],
    "validations": ["required"],
    "conditions": []
  }
]
```

### Supported field types

| Type | Category |
|---|---|
| `text`, `textarea`, `number`, `email`, `password`, `url` | Basic |
| `select`, `multiselect`, `checkboxes`, `radio`, `toggle` | Select |
| `date`, `time`, `datetime` | Date & Time |
| `header`, `divider`, `group` | Layout |
| `file`, `image` | File |

---

## Full component source

Place this file at `src/components/FormBuilder/FormBuilder.tsx`. It has no external DnD dependencies — only React and the standard browser DnD API.

```tsx
import { useState, useRef, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────── */
interface FieldOption {
  label: string;
  value: string;
}

interface Field {
  id:          string;
  type:        string;
  label:       string;
  name:        string;
  placeholder: string;
  description: string;
  required:    boolean;
  size:        'sm' | 'md' | 'lg';
  columns:     1 | 2 | 3;
  options:     FieldOption[];
  validations: string[];
  conditions:  any[];
}

interface FieldDef  { type: string; label: string; icon: string; }
interface FieldGroup{ label: string; fields: FieldDef[]; }

type View     = 'editor' | 'preview' | 'code';
type RightTab = 'properties' | 'theme' | 'export' | 'model';
type SubTab   = 'properties' | 'data' | 'layout' | 'validation' | 'conditions';

/* ─── Field catalogue ────────────────────────────────────── */
const FIELD_GROUPS: FieldGroup[] = [
  { label: 'Basic', fields: [
    { type: 'text',     label: 'Text',     icon: 'T'  },
    { type: 'textarea', label: 'Textarea',  icon: '¶'  },
    { type: 'number',   label: 'Number',    icon: '#'  },
    { type: 'email',    label: 'Email',     icon: '@'  },
    { type: 'password', label: 'Password',  icon: '••' },
    { type: 'url',      label: 'URL',       icon: '↗'  },
  ]},
  { label: 'Select', fields: [
    { type: 'select',      label: 'Select',      icon: '▾' },
    { type: 'multiselect', label: 'Multiselect', icon: '☰' },
    { type: 'checkboxes',  label: 'Checkboxes',  icon: '✓' },
    { type: 'radio',       label: 'Radio',       icon: '◎' },
    { type: 'toggle',      label: 'Toggle',      icon: '⬡' },
  ]},
  { label: 'Date & Time', fields: [
    { type: 'date',     label: 'Date',     icon: '▦'  },
    { type: 'time',     label: 'Time',     icon: '◷'  },
    { type: 'datetime', label: 'DateTime', icon: '▦◷' },
  ]},
  { label: 'Layout', fields: [
    { type: 'header',  label: 'Header',  icon: 'H1' },
    { type: 'divider', label: 'Divider', icon: '—'  },
    { type: 'group',   label: 'Group',   icon: '[]' },
  ]},
  { label: 'File', fields: [
    { type: 'file',  label: 'File',  icon: '↑' },
    { type: 'image', label: 'Image', icon: '▣' },
  ]},
];

const OPT_TYPES = ['select', 'multiselect', 'checkboxes', 'radio'];

/* ─── Helpers ────────────────────────────────────────────── */
const mkId = () => `fld_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

function mkField(type: string): Field {
  return {
    id: mkId(), type,
    label:       type.charAt(0).toUpperCase() + type.slice(1),
    name:        type + '_' + Math.random().toString(36).slice(2, 5),
    placeholder: '', description: '', required: false,
    size: 'md', columns: 3,
    options: OPT_TYPES.includes(type)
      ? [{ label: 'Option 1', value: 'option_1' }, { label: 'Option 2', value: 'option_2' }]
      : [],
    validations: [], conditions: [],
  };
}

function buildSchema(fields: Field[]) {
  return fields.map(({ type, name, label, placeholder, required, options, validations, conditions }) => ({
    type, name, label,
    ...(placeholder        && { placeholder }),
    ...(required           && { required }),
    ...(options?.length    && { options }),
    ...(validations?.length && { validations }),
    ...(conditions?.length  && { conditions }),
  }));
}

/* ─── CSS (injected once, --fb- prefixed to avoid collisions) */
const GLOBAL_CSS = `
  .fb-wrap *{box-sizing:border-box}
  .fb-wrap{
    --fb-accent:#3B6EF0;--fb-al:rgba(59,110,240,.08);--fb-af:rgba(59,110,240,.35);
    --fb-ag:rgba(59,110,240,.14);
    --fb-bg:#F3F5F9;--fb-panel:#fff;--fb-input:#FAFBFC;--fb-sec:#F7F8FA;
    --fb-border:#E4E6EB;--fb-t:#1A1D23;--fb-t2:#6B7280;--fb-t3:#9EA5B3;
    --fb-danger:#E53935;--fb-r:8px;
    display:flex;flex-direction:column;height:100vh;overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:14px;color:var(--fb-t);background:var(--fb-bg);
  }
  .fb-wrap ::-webkit-scrollbar{width:5px;height:5px}
  .fb-wrap ::-webkit-scrollbar-track{background:transparent}
  .fb-wrap ::-webkit-scrollbar-thumb{background:var(--fb-border);border-radius:10px}

  /* toolbar */
  .fb-toolbar{display:flex;align-items:center;gap:8px;padding:0 16px;height:52px;
    background:var(--fb-panel);border-bottom:1.5px solid var(--fb-border);flex-shrink:0;z-index:20}
  .fb-logo{display:flex;align-items:center;gap:8px;margin-right:8px}
  .fb-logo-mark{width:28px;height:28px;border-radius:7px;background:var(--fb-accent);
    display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}
  .fb-logo-text{font-size:14px;font-weight:600}
  .fb-spacer{flex:1}
  .fb-vtoggle{display:flex;background:var(--fb-sec);border-radius:var(--fb-r);
    padding:3px;border:1.5px solid var(--fb-border);gap:2px}
  .fb-vbtn{padding:5px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;
    font-weight:500;background:transparent;color:var(--fb-t2);transition:all .12s;font-family:inherit}
  .fb-vbtn.active{background:#fff;color:var(--fb-t);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .fb-count{font-size:12px;color:var(--fb-t3)}
  .fb-badge{font-size:11px;padding:3px 8px;border-radius:20px;background:var(--fb-sec);
    color:var(--fb-t3);border:1px solid var(--fb-border);transition:all .3s}
  .fb-badge.saved{background:#e6f9ec;color:#1a7f37;border-color:#a7f0b6}
  .fb-btn{padding:6px 12px;border:1.5px solid var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);
    font-family:inherit;transition:all .12s}
  .fb-btn:hover:not(:disabled){border-color:var(--fb-accent);color:var(--fb-accent)}
  .fb-btn:disabled{opacity:.4;cursor:not-allowed}
  .fb-btn-p{background:var(--fb-accent);border-color:var(--fb-accent);color:#fff;
    font-size:13px;padding:7px 18px;font-weight:600}
  .fb-btn-p:hover:not(:disabled){background:#2a5ce0;border-color:#2a5ce0;color:#fff}

  /* body */
  .fb-body{display:flex;flex:1;overflow:hidden}

  /* left panel */
  .fb-left{width:248px;background:var(--fb-panel);border-right:1.5px solid var(--fb-border);
    display:flex;flex-direction:column;flex-shrink:0}
  .fb-ptabs{display:flex;border-bottom:1.5px solid var(--fb-border)}
  .fb-ptab{flex:1;padding:11px 0;border:none;background:none;cursor:pointer;font-size:12px;
    font-weight:500;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-ptab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-pbody{flex:1;overflow-y:auto}
  .fb-srchwrap{padding:10px 10px 4px}
  .fb-srch{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:12px;background:var(--fb-sec);color:var(--fb-t);outline:none;font-family:inherit}
  .fb-srch:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-hint{margin:0 10px 4px;font-size:11px;color:var(--fb-t3);line-height:1.4}
  .fb-grp{padding:6px 10px 4px}
  .fb-glbl{margin:0 0 5px;font-size:10px;font-weight:600;color:var(--fb-t3);
    letter-spacing:.08em;text-transform:uppercase}
  .fb-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
  .fb-pitem{display:flex;align-items:center;gap:7px;padding:8px;
    border:1.5px solid var(--fb-border);border-radius:8px;background:var(--fb-panel);
    cursor:grab;user-select:none;transition:border-color .1s,background .1s}
  .fb-pitem:hover{border-color:var(--fb-accent);background:var(--fb-al)}
  .fb-pitem.dragging{opacity:.35;cursor:grabbing}
  .fb-picon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
    border-radius:6px;background:var(--fb-sec);font-size:11px;font-weight:700;
    color:var(--fb-accent);font-family:monospace;flex-shrink:0;pointer-events:none}
  .fb-plbl{font-size:12px;font-weight:500;color:var(--fb-t);pointer-events:none}

  /* tree */
  .fb-tree{padding:10px}
  .fb-titem{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;
    cursor:pointer;margin-bottom:2px;border:1.5px solid transparent}
  .fb-titem:hover{background:var(--fb-sec)}
  .fb-titem.active{background:var(--fb-al);border-color:var(--fb-af)}
  .fb-tnum{color:var(--fb-t3);font-size:11px;width:16px;text-align:center;flex-shrink:0}
  .fb-ttype{font-size:11px;color:var(--fb-t3);font-family:monospace;flex-shrink:0}
  .fb-tname{font-size:13px;color:var(--fb-t);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fb-tdot{width:6px;height:6px;border-radius:50%;background:var(--fb-danger);flex-shrink:0}

  /* canvas */
  .fb-canvas{flex:1;overflow-y:auto;padding:24px 32px}
  .fb-ci{max-width:660px;margin:0 auto}
  .fb-titlerow{margin-bottom:20px;display:flex;align-items:center;gap:12px}
  .fb-titleinp{font-size:20px;font-weight:600;color:var(--fb-t);border:none;background:none;
    outline:none;font-family:inherit;flex:1}
  .fb-draftbadge{font-size:12px;padding:3px 10px;border-radius:20px;background:var(--fb-sec);
    color:var(--fb-t3);border:1.5px solid var(--fb-border);flex-shrink:0}

  /* drop line — the key DnD primitive */
  .fb-dl{height:4px;border-radius:2px;background:var(--fb-accent);
    margin:0;opacity:0;transition:opacity .12s;pointer-events:none;
    box-shadow:0 0 6px var(--fb-ag)}
  .fb-dl.over{opacity:1}
  /* drop target zone — invisible but captures dragover/drop between cards */
  .fb-dz{height:14px;margin:-7px 0;position:relative;z-index:4;cursor:default}

  /* empty canvas */
  .fb-empty{min-height:200px;border-radius:12px;border:2px dashed var(--fb-border);
    display:flex;align-items:center;justify-content:center;text-align:center;transition:all .15s}
  .fb-empty.over{border-color:var(--fb-accent);background:var(--fb-al)}
  .fb-ei{font-size:32px;margin-bottom:10px;opacity:.4}
  .fb-et{font-size:14px;font-weight:500;color:var(--fb-t3);margin-bottom:4px}
  .fb-es{font-size:12px;color:var(--fb-t3)}

  .fb-addbtn{margin-top:12px;width:100%;padding:11px;border:2px dashed var(--fb-border);
    border-radius:10px;background:none;cursor:pointer;color:var(--fb-t3);
    font-size:13px;font-weight:500;font-family:inherit}
  .fb-addbtn:hover{border-color:var(--fb-accent);color:var(--fb-accent)}

  /* canvas card */
  .fb-card{position:relative;padding:14px 16px 14px 36px;border-radius:10px;
    border:2px solid var(--fb-border);background:var(--fb-panel);cursor:pointer;
    transition:border-color .12s,box-shadow .12s;user-select:none}
  .fb-card:hover{border-color:var(--fb-af)}
  .fb-card.selected{border-color:var(--fb-accent);background:#FAFBFF;
    box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-card.dragging{opacity:.3}
  .fb-handle{position:absolute;left:0;top:0;bottom:0;width:30px;
    display:flex;align-items:center;justify-content:center;
    cursor:grab;color:var(--fb-t3);font-size:15px;
    border-radius:10px 0 0 10px;user-select:none;touch-action:none}
  .fb-handle:hover{color:var(--fb-t2)}
  .fb-del{position:absolute;top:8px;right:8px;background:none;border:none;
    cursor:pointer;color:var(--fb-t3);font-size:14px;padding:2px 6px;
    border-radius:5px;line-height:1;display:none;font-family:inherit}
  .fb-card.selected .fb-del{display:block}
  .fb-del:hover{color:var(--fb-danger);background:#fff0f0}
  .fb-cmeta{display:flex;align-items:center;gap:6px;margin-bottom:7px}
  .fb-cname{font-size:11px;font-weight:500;color:var(--fb-t3);font-family:monospace}
  .fb-creq{font-size:10px;color:var(--fb-danger);font-weight:700}
  .fb-clbl{display:block;font-size:13px;font-weight:500;color:var(--fb-t);margin-bottom:6px}
  .fb-ast{color:var(--fb-danger);margin-left:3px}
  .fb-cdesc{margin:6px 0 0;font-size:12px;color:var(--fb-t3)}

  /* field previews */
  .fb-fi{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;
    font-family:inherit;pointer-events:none}
  .fb-fta{height:60px;resize:none}
  .fb-fopts{display:flex;flex-direction:column;gap:6px}
  .fb-fopt{display:flex;align-items:center;gap:8px;font-size:13px;
    color:var(--fb-t2);pointer-events:none}
  .fb-fopt input{accent-color:var(--fb-accent);flex-shrink:0;pointer-events:none}
  .fb-ftog{display:flex;align-items:center;gap:10px;pointer-events:none}
  .fb-ftogtrack{width:36px;height:20px;border-radius:10px;background:var(--fb-accent);
    display:inline-flex;align-items:center;padding:0 2px;flex-shrink:0}
  .fb-ftogthumb{width:16px;height:16px;border-radius:50%;background:#fff;margin-left:auto}
  .fb-fh3{font-size:17px;font-weight:600;color:var(--fb-t)}
  .fb-fhr{border:none;border-top:1.5px solid var(--fb-border);margin:4px 0}
  .fb-ffile{display:flex;align-items:center;gap:8px;color:var(--fb-t3);pointer-events:none}

  /* right panel */
  .fb-right{width:284px;background:var(--fb-panel);border-left:1.5px solid var(--fb-border);
    display:flex;flex-direction:column;flex-shrink:0}
  .fb-rtabs{display:flex;border-bottom:1.5px solid var(--fb-border);overflow-x:auto;flex-shrink:0}
  .fb-rtab{flex:1;padding:11px 4px;border:none;background:none;cursor:pointer;font-size:11px;
    font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-rtab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-rscroll{flex:1;overflow-y:auto}
  .fb-rempty{padding:28px;text-align:center}
  .fb-rempty-arrow{font-size:40px;opacity:.2;margin-bottom:10px}
  .fb-rempty-txt{color:var(--fb-t3);font-size:13px}

  /* props form */
  .fb-stabs{display:flex;border-bottom:1.5px solid var(--fb-border);
    margin-bottom:14px;overflow-x:auto}
  .fb-stab{padding:8px 9px;border:none;background:none;cursor:pointer;font-size:11px;
    font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-stab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-pform{padding:16px}
  .fb-prow{margin-bottom:14px}
  .fb-plbl{display:block;font-size:12px;font-weight:500;color:var(--fb-t2);margin-bottom:5px}
  .fb-pinp{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
  .fb-pinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-mono{font-family:monospace;font-size:12px}
  .fb-togrow{display:flex;align-items:center;gap:8px;cursor:pointer}
  .fb-togwrap{position:relative;width:36px;height:20px;flex-shrink:0}
  .fb-togwrap input{opacity:0;position:absolute;inset:0;cursor:pointer;margin:0;width:100%;height:100%}
  .fb-togbg{width:100%;height:100%;border-radius:10px;background:var(--fb-border);
    transition:background .2s;pointer-events:none}
  .fb-togwrap input:checked~.fb-togbg{background:var(--fb-accent)}
  .fb-togknob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;transition:left .2s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .fb-togwrap input:checked~.fb-togknob{left:18px}
  .fb-toglbl{font-size:13px;color:var(--fb-t)}
  .fb-segs{display:flex;gap:6px}
  .fb-seg{flex:1;padding:7px 0;border:1.5px solid var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);font-family:inherit}
  .fb-seg.active{border-color:var(--fb-accent);background:var(--fb-al);color:var(--fb-accent)}
  .fb-optlist{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
  .fb-optrow{display:flex;gap:5px;align-items:center}
  .fb-optrow .fb-pinp{flex:1}
  .fb-delopt{background:none;border:none;cursor:pointer;color:var(--fb-t3);
    font-size:14px;padding:0 4px;font-family:inherit;flex-shrink:0}
  .fb-delopt:hover{color:var(--fb-danger)}
  .fb-addopt{width:100%;padding:7px;border:1.5px dashed var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;color:var(--fb-accent);font-size:12px;font-weight:500;font-family:inherit}
  .fb-valrule{display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;
    font-size:13px;font-family:monospace;color:var(--fb-t)}
  .fb-valrule input{accent-color:var(--fb-accent);width:14px;height:14px;cursor:pointer}
  .fb-stubbtn{width:100%;padding:10px;border:1.5px dashed var(--fb-border);border-radius:8px;
    background:none;cursor:pointer;color:var(--fb-accent);font-size:13px;
    font-weight:500;font-family:inherit}
  .fb-muted{font-size:12px;color:var(--fb-t3);text-align:center;margin-top:16px}

  /* theme / export / model */
  .fb-tpanel,.fb-epanel,.fb-mpanel{padding:16px}
  .fb-swatches{display:flex;gap:8px;flex-wrap:wrap}
  .fb-swatch{width:28px;height:28px;border-radius:7px;border:2px solid transparent;cursor:pointer}
  .fb-swatch:hover{transform:scale(1.12)}
  .fb-swatch.active{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--fb-accent)}
  .fb-range{margin-top:8px}
  .fb-range input[type=range]{width:100%;accent-color:var(--fb-accent)}
  .fb-enote{font-size:13px;color:var(--fb-t2);margin-bottom:12px}
  .fb-copybtn{width:100%;padding:10px;background:var(--fb-accent);border:none;
    border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}
  .fb-copybtn:hover{background:#2a5ce0}
  .fb-mjson{margin:0;font-size:11px;line-height:1.7;color:var(--fb-t2);background:var(--fb-sec);
    padding:14px;border-radius:8px;overflow-x:auto;font-family:monospace;white-space:pre-wrap}

  /* preview */
  .fb-preview{flex:1;overflow-y:auto;padding:32px 24px}
  .fb-pcard{max-width:560px;margin:0 auto;background:var(--fb-panel);border-radius:14px;
    border:1.5px solid var(--fb-border);padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
  .fb-pform{display:flex;flex-direction:column;gap:20px}
  .fb-pgrp{display:flex;flex-direction:column;gap:6px}
  .fb-pfl{font-size:14px;font-weight:500;color:var(--fb-t)}
  .fb-pfl .fb-ast{color:var(--fb-danger);margin-left:3px}
  .fb-pfinp{width:100%;padding:9px 12px;border:1.5px solid var(--fb-border);border-radius:8px;
    font-size:14px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
  .fb-pfinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-pfhelp{font-size:12px;color:var(--fb-t3)}
  .fb-pfsub{padding:11px 24px;background:var(--fb-accent);border:none;border-radius:8px;
    color:#fff;font-size:14px;font-weight:600;cursor:pointer;align-self:flex-start;font-family:inherit}
  .fb-pfempty{text-align:center;color:var(--fb-t3);padding:40px 0}

  /* code */
  .fb-code{flex:1;overflow-y:auto;padding:24px}
  .fb-ccard{max-width:720px;margin:0 auto;background:var(--fb-panel);border-radius:12px;
    border:1.5px solid var(--fb-border);overflow:hidden}
  .fb-chdr{padding:12px 16px;border-bottom:1.5px solid var(--fb-border);
    display:flex;align-items:center}
  .fb-ctitle{font-size:12px;font-weight:500;color:var(--fb-t2)}
  .fb-cjson{margin:0;padding:20px;font-size:12px;line-height:1.7;color:var(--fb-t2);
    font-family:monospace;white-space:pre-wrap;overflow-x:auto}
`;

/* ─── FieldPreview ───────────────────────────────────────── */
function FieldPreview({ field }: { field: Field }) {
  const opts = field.options ?? [];
  switch (field.type) {
    case 'textarea':
      return <textarea className="fb-fi fb-fta" placeholder={field.placeholder || 'Enter text…'} readOnly />;
    case 'select': case 'multiselect':
      return (
        <select className="fb-fi" disabled>
          <option>{field.placeholder || 'Select an option…'}</option>
          {opts.map(o => <option key={o.value}>{o.label}</option>)}
        </select>
      );
    case 'checkboxes':
      return <div className="fb-fopts">{opts.map(o => <label key={o.value} className="fb-fopt"><input type="checkbox" readOnly />{o.label}</label>)}</div>;
    case 'radio':
      return <div className="fb-fopts">{opts.map(o => <label key={o.value} className="fb-fopt"><input type="radio" readOnly name={field.id} />{o.label}</label>)}</div>;
    case 'toggle':
      return <div className="fb-ftog"><span className="fb-ftogtrack"><span className="fb-ftogthumb" /></span><span style={{ fontSize: 13, color: 'var(--fb-t2)' }}>{field.label}</span></div>;
    case 'header':
      return <div className="fb-fh3">{field.label}</div>;
    case 'divider':
      return <hr className="fb-fhr" />;
    case 'file': case 'image':
      return <div className="fb-fi fb-ffile"><span>{field.type === 'image' ? '▣' : '↑'}</span><span>Click to upload</span></div>;
    default:
      return <input className="fb-fi" type={field.type === 'password' ? 'password' : 'text'} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}…`} readOnly />;
  }
}

/* ─── PropsPanel ─────────────────────────────────────────── */
function PropsPanel({ field, subTab, setSubTab, onChange }: {
  field:     Field;
  subTab:    SubTab;
  setSubTab: (t: SubTab) => void;
  onChange:  (f: Field) => void;
}) {
  const TABS: SubTab[] = ['properties', 'data', 'layout', 'validation', 'conditions'];

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="fb-prow">
      <label className="fb-plbl">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fb-pform">
      <div className="fb-stabs">
        {TABS.map(t => <button key={t} className={`fb-stab${subTab === t ? ' active' : ''}`} onClick={() => setSubTab(t)}>{t}</button>)}
      </div>

      {subTab === 'properties' && (
        <>
          <Row label="Label"><input className="fb-pinp" value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} /></Row>
          <Row label="Name / Key"><input className="fb-pinp fb-mono" value={field.name} onChange={e => onChange({ ...field, name: e.target.value })} /></Row>
          <Row label="Placeholder"><input className="fb-pinp" value={field.placeholder} onChange={e => onChange({ ...field, placeholder: e.target.value })} /></Row>
          <Row label="Help text"><input className="fb-pinp" value={field.description} onChange={e => onChange({ ...field, description: e.target.value })} /></Row>
          <Row label="Required">
            <label className="fb-togrow">
              <div className="fb-togwrap">
                <input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} />
                <div className="fb-togbg" /><div className="fb-togknob" />
              </div>
              <span className="fb-toglbl">Required field</span>
            </label>
          </Row>
        </>
      )}

      {subTab === 'data' && (
        field.options?.length > 0 ? (
          <Row label="Options">
            <div className="fb-optlist">
              {field.options.map((opt, i) => (
                <div key={i} className="fb-optrow">
                  <input className="fb-pinp" value={opt.label} placeholder="Label"
                    onChange={e => { const o = [...field.options]; o[i] = { ...o[i], label: e.target.value }; onChange({ ...field, options: o }); }} />
                  <input className="fb-pinp fb-mono" value={opt.value} placeholder="value"
                    onChange={e => { const o = [...field.options]; o[i] = { ...o[i], value: e.target.value }; onChange({ ...field, options: o }); }} />
                  <button className="fb-delopt" type="button" onClick={() => onChange({ ...field, options: field.options.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
            <button className="fb-addopt" type="button"
              onClick={() => onChange({ ...field, options: [...field.options, { label: `Option ${field.options.length + 1}`, value: `option_${field.options.length + 1}` }] })}>
              + Add option
            </button>
          </Row>
        ) : <p style={{ color: 'var(--fb-t3)', fontSize: 13 }}>No data options for this field type.</p>
      )}

      {subTab === 'layout' && (
        <>
          <Row label="Size">
            <div className="fb-segs">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <button key={s} type="button" className={`fb-seg${field.size === s ? ' active' : ''}`} onClick={() => onChange({ ...field, size: s })}>{s.toUpperCase()}</button>
              ))}
            </div>
          </Row>
          <Row label="Column span">
            <div className="fb-segs">
              {([[1, '1/3'], [2, '2/3'], [3, 'Full']] as const).map(([v, l]) => (
                <button key={v} type="button" className={`fb-seg${field.columns === v ? ' active' : ''}`} onClick={() => onChange({ ...field, columns: v })}>{l}</button>
              ))}
            </div>
          </Row>
        </>
      )}

      {subTab === 'validation' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--fb-t2)', marginBottom: 12 }}>Add validation rules.</p>
          {['required', 'min', 'max', 'email', 'url', 'regex', 'numeric', 'alpha'].map(rule => (
            <label key={rule} className="fb-valrule">
              <input type="checkbox" checked={field.validations?.includes(rule)}
                onChange={e => {
                  const v = field.validations || [];
                  onChange({ ...field, validations: e.target.checked ? [...v, rule] : v.filter(r => r !== rule) });
                }} />
              {rule}
            </label>
          ))}
        </div>
      )}

      {subTab === 'conditions' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--fb-t2)', marginBottom: 12 }}>Show or hide this field based on other field values.</p>
          <button className="fb-stubbtn" type="button">+ Add condition</button>
          <p className="fb-muted">No conditions — always shown.</p>
        </div>
      )}
    </div>
  );
}

/* ─── PreviewMode ────────────────────────────────────────── */
function PreviewMode({ fields }: { fields: Field[] }) {
  const S = 'fb-pfinp';
  const renderInput = (f: Field) => {
    switch (f.type) {
      case 'textarea':   return <textarea className={S} style={{ minHeight: 80, resize: 'vertical' }} placeholder={f.placeholder} />;
      case 'select': case 'multiselect':
        return <select className={S} style={{ appearance: 'none' }}><option value="">{f.placeholder || 'Select…'}</option>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
      case 'checkboxes': return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.options?.map(o => <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: 'var(--fb-accent)' }} />{o.label}</label>)}</div>;
      case 'radio':      return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.options?.map(o => <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}><input type="radio" name={f.id} style={{ accentColor: 'var(--fb-accent)' }} />{o.label}</label>)}</div>;
      case 'toggle':     return <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><div style={{ position: 'relative', width: 40, height: 22 }}><input type="checkbox" style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', margin: 0 }} /><div style={{ width: '100%', height: '100%', borderRadius: 11, background: 'var(--fb-border)' }} /><div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} /></div><span style={{ fontSize: 14 }}>{f.label}</span></label>;
      case 'header':     return <h3 style={{ margin: '6px 0 2px', fontSize: 20, fontWeight: 600, color: 'var(--fb-t)' }}>{f.label}</h3>;
      case 'divider':    return <hr style={{ border: 'none', borderTop: '1.5px solid var(--fb-border)', margin: '4px 0' }} />;
      case 'file': case 'image': return <div className={S} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--fb-t3)' }}><span>{f.type === 'image' ? '▣' : '↑'}</span><span>Click to upload</span></div>;
      default: return <input className={S} type={f.type === 'password' ? 'password' : 'text'} placeholder={f.placeholder} />;
    }
  };

  if (!fields.length) return <div className="fb-pfempty">Add fields to preview your form.</div>;
  const noLabel = ['header', 'divider', 'toggle'];
  return (
    <form className="fb-pform" onSubmit={e => e.preventDefault()}>
      {fields.map(f => (
        <div key={f.id} className="fb-pgrp">
          {!noLabel.includes(f.type) && <label className="fb-pfl">{f.label}{f.required && <span className="fb-ast">*</span>}</label>}
          {renderInput(f)}
          {f.description && <p className="fb-pfhelp">{f.description}</p>}
        </div>
      ))}
      <button type="submit" className="fb-pfsub">Submit</button>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════════ */
export default function GuardianFormBuilder() {
  const [fields, setFields] = useState<Field[]>([
    { ...mkField('text'),     label: 'Full Name',     name: 'full_name',  placeholder: 'Enter your full name', required: true },
    { ...mkField('email'),    label: 'Email Address', name: 'email',      placeholder: 'you@example.com',      required: true },
    { ...mkField('select'),   label: 'Department',    name: 'department', placeholder: 'Select a department',
      options: [{ label: 'Engineering', value: 'eng' }, { label: 'Design', value: 'design' }, { label: 'Product', value: 'product' }] },
    { ...mkField('textarea'), label: 'Message',       name: 'message',    placeholder: 'Your message…',
      description: 'Please be as detailed as possible.' },
  ]);

  const [formName,      setFormName]      = useState('Untitled Form');
  const [formStatus,    setFormStatus]    = useState<'draft' | 'saved'>('draft');
  const [currentFormId, setCurrentFormId] = useState<number | null>(null);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [leftTab,       setLeftTab]       = useState<'elements' | 'tree'>('elements');
  const [rightTab,      setRightTab]      = useState<RightTab>('properties');
  const [subTab,        setSubTab]        = useState<SubTab>('properties');
  const [view,          setView]          = useState<View>('editor');
  const [search,        setSearch]        = useState('');
  const [history,       setHistory]       = useState<Field[][]>([]);
  const [saving,        setSaving]        = useState(false);
  const [dropOver,      setDropOver]      = useState<number | null>(null); // which drop-zone index is hovered
  const [accentColor,   setAccentColor]   = useState('#3B6EF0');

  // ── Drag state ref (shared across all drag handlers, avoids stale closures)
  const drag = useRef<{ type: 'palette' | 'canvas' | null; payload: string | null }>({
    type: null, payload: null,
  });

  const selectedField = fields.find(f => f.id === selectedId) ?? null;

  const pushHistory = useCallback((snapshot: Field[]) => {
    setHistory(h => [...h.slice(-30), JSON.parse(JSON.stringify(snapshot))]);
  }, []);

  const updateField = (updated: Field) => setFields(prev => prev.map(f => f.id === updated.id ? updated : f));

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'null') return;
    setSaving(true);
    try {
      const res = await fetch('/api/form-builder/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ formName, formType: 'Requests', schema: buildSchema(fields), formId: currentFormId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentFormId(data.formId);
        setFormStatus('saved');
        setTimeout(() => setFormStatus('draft'), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Drop handler (shared by all drop zones) ───────────────────────────
  const handleDrop = useCallback((insertAt: number) => {
    setDropOver(null);
    if (drag.current.type === 'palette' && drag.current.payload) {
      const newField = mkField(drag.current.payload);
      pushHistory(fields);
      setFields(prev => {
        const arr = [...prev];
        arr.splice(insertAt, 0, newField);
        return arr;
      });
      setSelectedId(newField.id);
      setRightTab('properties');
      setSubTab('properties');
    } else if (drag.current.type === 'canvas' && drag.current.payload) {
      const srcId  = drag.current.payload;
      const srcIdx = fields.findIndex(f => f.id === srcId);
      if (srcIdx === -1) return;
      let tgt = insertAt;
      if (tgt > srcIdx) tgt--;     // account for removal shifting indices
      if (tgt === srcIdx) return;  // dropped in same position
      pushHistory(fields);
      setFields(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(srcIdx, 1);
        arr.splice(tgt, 0, moved);
        return arr;
      });
    }
    drag.current = { type: null, payload: null };
  }, [fields, pushHistory]);

  // ── Palette ───────────────────────────────────────────────────────────
  const filteredGroups = search
    ? [{ label: 'Results', fields: FIELD_GROUPS.flatMap(g => g.fields).filter(f => f.label.toLowerCase().includes(search.toLowerCase())) }]
    : FIELD_GROUPS;

  const addField = (type: string) => {
    const nf = mkField(type);
    pushHistory(fields);
    setFields(prev => [...prev, nf]);
    setSelectedId(nf.id);
    setRightTab('properties');
    setSubTab('properties');
  };

  // ── Canvas ────────────────────────────────────────────────────────────
  // Drop zones are rendered between each card (and before/after the list).
  // Index i means "insert before field[i]" (or append when i === fields.length).
  const DropZone = ({ index }: { index: number }) => (
    <div
      className="fb-dz"
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = drag.current.type === 'canvas' ? 'move' : 'copy'; setDropOver(index); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(null); }}
      onDrop={e => { e.preventDefault(); handleDrop(index); }}
    >
      <div className={`fb-dl${dropOver === index ? ' over' : ''}`} />
    </div>
  );

  // ── Accent colour ─────────────────────────────────────────────────────
  const applyAccent = (hex: string) => {
    setAccentColor(hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const el = document.querySelector('.fb-wrap') as HTMLElement;
    if (el) {
      el.style.setProperty('--fb-accent', hex);
      el.style.setProperty('--fb-al',  `rgba(${r},${g},${b},.08)`);
      el.style.setProperty('--fb-ag',  `rgba(${r},${g},${b},.14)`);
      el.style.setProperty('--fb-af',  `rgba(${r},${g},${b},.35)`);
    }
  };

  const SWATCHES = ['#3B6EF0', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="fb-wrap">

        {/* ── Toolbar ── */}
        <div className="fb-toolbar">
          <div className="fb-logo">
            <div className="fb-logo-mark">G</div>
            <span className="fb-logo-text">Form Builder</span>
          </div>
          <div className="fb-vtoggle">
            {(['editor', 'preview', 'code'] as View[]).map(v => (
              <button key={v} className={`fb-vbtn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="fb-spacer" />
          <span className="fb-count">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
          <span className={`fb-badge${formStatus === 'saved' ? ' saved' : ''}`}>{formStatus}</span>
          <button className="fb-btn" disabled={!history.length} onClick={() => {
            if (!history.length) return;
            setFields(history[history.length - 1]);
            setHistory(h => h.slice(0, -1));
            setSelectedId(null);
          }}>↩ Undo</button>
          <button className="fb-btn" onClick={() => { pushHistory(fields); setFields([]); setSelectedId(null); }}>Clear</button>
          <button className="fb-btn fb-btn-p" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>

        {/* ── Body ── */}
        <div className="fb-body">

          {/* ── Left panel ── */}
          {view === 'editor' && (
            <div className="fb-left">
              <div className="fb-ptabs">
                {(['elements', 'tree'] as const).map(t => (
                  <button key={t} className={`fb-ptab${leftTab === t ? ' active' : ''}`} onClick={() => setLeftTab(t)}>{t}</button>
                ))}
              </div>

              {leftTab === 'elements' ? (
                <div className="fb-pbody">
                  <div className="fb-srchwrap">
                    <input className="fb-srch" placeholder="Search elements…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <p className="fb-hint">Click to add · drag onto canvas to insert</p>
                  {filteredGroups.map(group => (
                    <div key={group.label} className="fb-grp">
                      <p className="fb-glbl">{group.label}</p>
                      <div className="fb-pgrid">
                        {group.fields.map(fd => (
                          <div key={fd.type} className="fb-pitem"
                            draggable
                            onClick={() => addField(fd.type)}
                            onDragStart={e => {
                              drag.current = { type: 'palette', payload: fd.type };
                              e.dataTransfer.effectAllowed = 'copy';
                              // REQUIRED by Chrome — drop won't fire without setData
                              e.dataTransfer.setData('text/plain', 'palette:' + fd.type);
                              (e.currentTarget as HTMLElement).classList.add('dragging');
                            }}
                            onDragEnd={e => {
                              (e.currentTarget as HTMLElement).classList.remove('dragging');
                              drag.current = { type: null, payload: null };
                              setDropOver(null);
                            }}
                          >
                            <span className="fb-picon">{fd.icon}</span>
                            <span className="fb-plbl">{fd.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="fb-pbody">
                  <div className="fb-tree">
                    {fields.length === 0 && <p className="fb-muted" style={{ marginTop: 24 }}>No fields yet.</p>}
                    {fields.map((f, i) => (
                      <div key={f.id} className={`fb-titem${selectedId === f.id ? ' active' : ''}`}
                        onClick={() => { setSelectedId(f.id); setRightTab('properties'); setSubTab('properties'); }}>
                        <span className="fb-tnum">{i + 1}</span>
                        <span className="fb-ttype">{f.type}</span>
                        <span className="fb-tname">{f.label}</span>
                        {f.required && <span className="fb-tdot" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Canvas / Preview / Code ── */}
          {view === 'editor' && (
            <div className="fb-canvas">
              <div className="fb-ci">
                <div className="fb-titlerow">
                  <input className="fb-titleinp" value={formName} onChange={e => setFormName(e.target.value)} />
                  <span className="fb-draftbadge">Draft</span>
                </div>

                {fields.length === 0 ? (
                  <div className={`fb-empty${dropOver === 0 ? ' over' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDropOver(0); }}
                    onDragLeave={() => setDropOver(null)}
                    onDrop={e => { e.preventDefault(); handleDrop(0); }}>
                    <div>
                      <div className="fb-ei">⊕</div>
                      <p className="fb-et">Drag fields here or click in the palette</p>
                      <p className="fb-es">Start building your form</p>
                    </div>
                  </div>
                ) : (
                  <div onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                    {/* First drop zone (insert at top) */}
                    <DropZone index={0} />

                    {fields.map((field, i) => (
                      <div key={field.id}>
                        <div
                          className={`fb-card${selectedId === field.id ? ' selected' : ''}`}
                          onClick={e => {
                            if ((e.target as HTMLElement).closest('.fb-del') || (e.target as HTMLElement).closest('.fb-handle')) return;
                            setSelectedId(field.id);
                            setRightTab('properties');
                            setSubTab('properties');
                          }}
                          draggable
                          onDragStart={e => {
                            drag.current = { type: 'canvas', payload: field.id };
                            e.dataTransfer.effectAllowed = 'move';
                            // REQUIRED by Chrome — drop won't fire without setData
                            e.dataTransfer.setData('text/plain', 'canvas:' + field.id);
                            setTimeout(() => (e.target as HTMLElement).classList.add('dragging'), 0);
                          }}
                          onDragEnd={e => {
                            (e.currentTarget as HTMLElement).classList.remove('dragging');
                            drag.current = { type: null, payload: null };
                            setDropOver(null);
                          }}
                        >
                          <div className="fb-handle" title="Drag to reorder">⠿</div>
                          <button className="fb-del" type="button" onClick={e => {
                            e.stopPropagation();
                            pushHistory(fields);
                            setFields(prev => prev.filter(f => f.id !== field.id));
                            if (selectedId === field.id) setSelectedId(null);
                          }}>✕</button>
                          <div className="fb-cmeta">
                            <span className="fb-cname">{field.name}</span>
                            {field.required && <span className="fb-creq">required</span>}
                          </div>
                          {!['header', 'divider', 'toggle'].includes(field.type) && (
                            <label className="fb-clbl">
                              {field.label}{field.required && <span className="fb-ast">*</span>}
                            </label>
                          )}
                          <FieldPreview field={field} />
                          {field.description && <p className="fb-cdesc">{field.description}</p>}
                        </div>

                        {/* Drop zone after each card */}
                        <DropZone index={i + 1} />
                      </div>
                    ))}

                    <button className="fb-addbtn" onClick={() => { const nf = mkField('text'); pushHistory(fields); setFields(prev => [...prev, nf]); setSelectedId(nf.id); }}>
                      + Add field
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'preview' && (
            <div className="fb-preview">
              <div className="fb-pcard"><PreviewMode fields={fields} /></div>
            </div>
          )}

          {view === 'code' && (
            <div className="fb-code">
              <div className="fb-ccard">
                <div className="fb-chdr">
                  <span className="fb-ctitle">Form Schema — JSON</span>
                  <div className="fb-spacer" />
                  <button className="fb-btn" onClick={() => navigator.clipboard?.writeText(JSON.stringify(buildSchema(fields), null, 2))}>Copy</button>
                </div>
                <pre className="fb-cjson">{JSON.stringify(buildSchema(fields), null, 2)}</pre>
              </div>
            </div>
          )}

          {/* ── Right panel ── */}
          {view === 'editor' && (
            <div className="fb-right">
              <div className="fb-rtabs">
                {(['properties', 'theme', 'export', 'model'] as RightTab[]).map(t => (
                  <button key={t} className={`fb-rtab${rightTab === t ? ' active' : ''}`} onClick={() => setRightTab(t)}>{t}</button>
                ))}
              </div>
              <div className="fb-rscroll">

                {rightTab === 'properties' && !selectedField && (
                  <div className="fb-rempty">
                    <div className="fb-rempty-arrow">☜</div>
                    <p className="fb-rempty-txt">Select a field on the canvas to edit its properties.</p>
                  </div>
                )}

                {rightTab === 'properties' && selectedField && (
                  <PropsPanel field={selectedField} subTab={subTab} setSubTab={setSubTab} onChange={updateField} />
                )}

                {rightTab === 'model' && (
                  <div className="fb-mpanel">
                    <pre className="fb-mjson">{JSON.stringify(buildSchema(fields), null, 2)}</pre>
                  </div>
                )}

                {rightTab === 'theme' && (
                  <div className="fb-tpanel">
                    <label className="fb-plbl" style={{ marginBottom: 10 }}>Accent color</label>
                    <div className="fb-swatches">
                      {SWATCHES.map(c => (
                        <div key={c} className={`fb-swatch${accentColor === c ? ' active' : ''}`}
                          style={{ background: c }} onClick={() => applyAccent(c)} />
                      ))}
                    </div>
                    <label className="fb-plbl" style={{ marginTop: 16, marginBottom: 8 }}>Border radius</label>
                    <div className="fb-range">
                      <input type="range" min="0" max="16" defaultValue="8"
                        onChange={e => (document.querySelector('.fb-wrap') as HTMLElement)?.style.setProperty('--fb-r', e.target.value + 'px')} />
                    </div>
                  </div>
                )}

                {rightTab === 'export' && (
                  <div className="fb-epanel">
                    <p className="fb-enote">Export your form schema to use in Guardian.</p>
                    <button className="fb-copybtn" onClick={() => navigator.clipboard?.writeText(JSON.stringify(buildSchema(fields), null, 2))}>
                      Copy JSON to clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
```

---

## Agent checklist

- [ ] No new packages to install — native HTML5 DnD, no `@dnd-kit`
- [ ] Create `src/components/FormBuilder/FormBuilder.tsx` (full source above)
- [ ] Create `src/components/FormBuilder/index.ts` (barrel export)
- [ ] Run SQL migrations to add `BUILDER_SCHEMA` column and `GUARDIAN.FORM_BUILDER_VERSIONS` table
- [ ] Run `bun prisma generate` after migration
- [ ] Add four Express endpoints to `server.cjs` (Step 5)
- [ ] Copy identical endpoints to `server-production.js` and `server.js`
- [ ] Commit all three server files together: `git add server.cjs server-production.js server.js`
- [ ] Add `/form-builder` route to the React Router config inside the auth-protected route group
- [ ] Add Form Builder nav link to Guardian's sidebar using the existing `NavItem` pattern
- [ ] Map `--fb-accent` CSS variable to Guardian's brand colour if needed (default is `#3B6EF0`)
- [ ] Run `bun test` — all existing tests still pass
- [ ] Run `bun run lint` — no new lint errors
- [ ] Run `tsc --noEmit` — no TypeScript errors
- [ ] Verify the builder renders at `http://localhost:5175/form-builder`
- [ ] Verify drag from palette inserts field at the correct position
- [ ] Verify drag handle on canvas card reorders correctly
- [ ] Verify Save calls `POST /api/form-builder/forms` with JWT token and saves to `GUARDIAN.FORMS`
- [ ] Update `CLAUDE.md` to add the four new API endpoints under the Forms & Fields section
