# Form Builder Upgrade — Design Spec

## Summary

Replace the embedded SimpleFormBuilder-in-a-modal experience with a dedicated full-page form builder at `/form-builder`. The CustomWorkflowTemplateModal stays as a lightweight template management panel; clicking "Edit Fields" or "Create" navigates to the new page. The new page is a three-panel drag-and-drop editor with preview, code view, undo, and a polished properties panel — all wired to the existing database-backed field storage (no JSON schema column, no new tables).

---

## Architecture Decision: Option B

- **CustomWorkflowTemplateModal** remains a modal for template CRUD (list, search, filter, activate/deactivate, delete)
- **FormBuilderPage** is a new full-viewport page at `/form-builder/:formId?` for building/editing fields
- **SimpleFormBuilder** stays untouched — still used by `NewRequestModal` and `FormTemplateEditorModal`

---

## Components

### 1. FormBuilderPage (`src/pages/FormBuilderPage.tsx`)

Wrapper page component that:
- Reads `formId` from URL params (`useParams`)
- Reads `formName`, `formType`, `returnTo` from URL search params
- If `formId` exists: loads form + fields via `formService.getFormById(formId)`, converts to `FormField[]` via `formService.convertDbFieldsToFormFields()`
- If no `formId`: starts with empty fields and uses search params for form metadata
- Passes data to `FormBuilder` component
- Handles save: calls `formService.createForm()` or `formService.updateForm()` with `formService.convertFormFieldsToDbFields()`
- On save/cancel: navigates to `returnTo` param (defaults to `/admin`)

### 2. FormBuilder (`src/components/FormBuilder/FormBuilder.tsx`)

The core three-panel UI component. Receives props, emits changes. No direct API calls — the page handles persistence.

**Props:**
```ts
interface FormBuilderProps {
  initialFields: FormField[];
  fieldTypes: UiFieldType[];        // from fieldTypeService
  formName: string;
  formType: string;
  formDescription: string;
  onSave: (data: { name: string; description: string; type: string; fields: FormField[] }) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}
```

**Internal state:**
- `fields: FormField[]` — the canvas fields
- `selectedId: string | null` — which field is selected
- `view: 'editor' | 'preview' | 'code'` — toolbar toggle
- `leftTab: 'elements' | 'tree'` — left panel toggle
- `rightTab: 'properties' | 'theme' | 'export' | 'model'` — right panel main tabs
- `subTab: 'properties' | 'data' | 'layout' | 'validation' | 'conditions'` — right panel sub-tabs
- `history: FormField[][]` — undo stack (max 30 snapshots)
- `search: string` — palette filter
- `dropOver: number | null` — which drop zone is hovered
- `formName / formDescription / formType` — editable in toolbar/canvas header
- `saving: boolean` — save loading state

### 3. Barrel export (`src/components/FormBuilder/index.ts`)

```ts
export { default } from './FormBuilder';
```

---

## Three-Panel Layout

```
+--------------------------------------------------+
| Toolbar: [Logo] [Form Name] [Editor|Preview|Code] [Undo] [Clear] [Save] |
+----------+----------------------------+----------+
| Left     | Center Canvas              | Right    |
| 248px    | flex: 1                    | 284px    |
|          |                            |          |
| [Elements| [Drop zone 0]             | [Props]  |
|  |Tree]  | [Field Card 1]            | [Theme]  |
|          | [Drop zone 1]             | [Export] |
| Palette  | [Field Card 2]            | [Model]  |
| grid     | [Drop zone 2]             |          |
| (2 col)  | [+ Add field]             | Sub-tabs:|
|          |                            | Props    |
| or       |                            | Data     |
| Tree     |                            | Layout   |
| view     |                            | Validation|
|          |                            | Conditions|
+----------+----------------------------+----------+
```

Full viewport height (`100vh`), no outer scroll. Each panel scrolls independently.

---

## Drag-and-Drop: Native HTML5 API

No external DnD library. Uses React's built-in drag event props.

### Palette items (left panel)
- `draggable={true}`
- `onDragStart`: sets `drag.current = { type: 'palette', payload: fieldType }` and calls `e.dataTransfer.setData('text/plain', fieldType)` (required for Chrome)

### Canvas cards
- Drag handle div with `draggable={true}`
- `onDragStart`: sets `drag.current = { type: 'canvas', payload: fieldId }` and calls `e.dataTransfer.setData('text/plain', fieldId)`

### Drop zones (interleaved between cards)
- Thin `div` elements rendered between every card and at the start/end
- `onDragOver`: `e.preventDefault()`, set `dropOver` index, show blue highlight line
- `onDragLeave`: clear `dropOver` if not entering a child
- `onDrop`: call `handleDrop(insertIndex)`

### handleDrop logic
```
if palette drag:
  create new FormField from field type
  splice into fields at insertIndex
  select the new field

if canvas drag (reorder):
  find source index
  adjust target if moving downward (target--)
  if same position, no-op
  splice source out, splice into new position
  update sequence numbers on all fields
```

### Click-to-add (palette)
Clicking a palette item appends a new field at the end (no drag needed).

---

## Field Types

### Database field types (primary source)
Loaded via `fieldTypeService.getUiFieldTypes()` on mount. These map to `GUARDIAN.FIELD_TYPE` rows and include: Text Input, Textarea, Number, Select/Dropdown, Radio, Checkbox, Date, Time, DateTime, Email, Phone, File, and any specialized types (SSN, DOB, Account Number, Address).

### Layout elements (client-side only)
These are structural and do not get saved to `GUARDIAN.FIELDS`. They exist only in the canvas for visual organization:
- **Header** — renders as an `<h3>`, label-only
- **Divider** — renders as `<hr>`

Layout elements are identified by their `fieldType` value (`header`, `divider`). The save logic filters them out before calling `convertFormFieldsToDbFields()`.

### Palette grouping
Groups in the left panel:
1. **Basic** — Text, Textarea, Number, Email, Phone (from DB)
2. **Selection** — Dropdown, Radio, Checkbox (from DB)
3. **Date & Time** — Date, Time, DateTime (from DB)
4. **Specialized** — SSN, DOB, Account Number, Address (from DB, if present)
5. **File** — File upload (from DB)
6. **Layout** — Header, Divider (client-side)

Each item shows an icon and label in a 2-column grid.

---

## Right Panel — Properties Editor

When a field is selected on the canvas, the right panel shows its editable properties.

### Sub-tab: Properties
- **Label** — text input, maps to `FormField.fieldName`
- **Placeholder** — text input, maps to `FormField.placeholder`
- **Help text** — text input, maps to `FormField.helpText`
- **Required** — toggle switch, maps to `FormField.required`

### Sub-tab: Data
- **Options editor** — only visible for Select, Radio, Checkbox types
- Each option has label + value inputs, with delete button
- "Add option" button appends new option
- Options stored in `FormField.options` as comma-separated or JSON string (matching existing pattern)

### Sub-tab: Layout
- **Size** — segmented control: SM / MD / LG (stored in a new optional `FormField.size` property, used for preview only)
- **Column span** — segmented control: 1/3 / 2/3 / Full (stored in a new optional `FormField.columns` property, used for preview only)

Layout properties are cosmetic for the builder preview. They do not affect database storage.

### Sub-tab: Validation
- Checkbox list of validation rules: required, min, max, email, url, regex, numeric, alpha
- Stored in `FormField.validation` as comma-separated string (matching existing pattern)

### Sub-tab: Conditions
- Stub with "Add condition" button and "No conditions" message
- Future phase — no implementation needed now

---

## Toolbar

Left to right:
1. **Logo mark** — blue square with "FB" text
2. **Form name** — editable inline text input (large, 20px font)
3. **Draft/Saved badge** — shows "Draft" by default, flashes "Saved" for 3s after save
4. **Spacer**
5. **Field count** — "X fields"
6. **View toggle** — segmented: Editor | Preview | Code
7. **Undo button** — pops last snapshot from history stack, disabled when empty
8. **Clear button** — clears all fields with GuardianSweetAlert confirmation
9. **Cancel button** — navigates back to returnTo
10. **Save button** — primary blue, calls `onSave`, disabled while saving

---

## Views

### Editor (default)
Three-panel layout as described above.

### Preview
Hides left and right panels. Renders a centered card (max-width 560px) with the form as end-users would see it. Each field renders its appropriate input control. Submit button at the bottom (non-functional, preview only).

### Code
Hides left and right panels. Renders a centered code card (max-width 720px) showing the field schema as formatted JSON with a "Copy to clipboard" button. This is read-only and for inspection only.

---

## Undo

- `pushHistory(fields)` called before any mutation (add, delete, reorder, field property change)
- Stack limited to 30 entries
- Undo button pops the last entry and sets it as current fields
- No redo (keeps it simple)

---

## Canvas Cards

Each field on the canvas renders as a card:
- **Drag handle** — left edge, grip icon, triggers drag
- **Meta row** — field type badge + "required" indicator
- **Label** — the field name, bold
- **Field preview** — read-only rendering of the input type (text input, select, checkboxes, etc.)
- **Help text** — if present, shown below preview in gray
- **Delete button** — visible only when card is selected, top-right corner
- **Selected state** — blue border + light blue background + glow shadow

Clicking a card selects it and opens its properties in the right panel.

---

## Data Flow

### Loading (edit mode)
```
URL: /form-builder/42?returnTo=/admin
  |
  v
FormBuilderPage reads formId=42
  |
  v
formService.getFormById(42) -> { form: DbForm, fields: DbField[] }
  |
  v
formService.convertDbFieldsToFormFields(dbFields) -> FormField[]
  |
  v
FormBuilder receives initialFields, formName, formType, formDescription
```

### Loading (create mode)
```
URL: /form-builder/new?name=My+Template&type=requests&returnTo=/admin
  |
  v
FormBuilderPage reads no formId, extracts name/type from search params
  |
  v
FormBuilder receives initialFields=[], formName, formType
```

### Saving
```
User clicks Save
  |
  v
FormBuilder calls onSave({ name, description, type, fields })
  |
  v
FormBuilderPage filters out layout elements (header, divider)
  |
  v
formService.convertFormFieldsToDbFields(fields) -> DbField[]
  |
  v
If editing: formService.updateForm(formId, dbForm, dbFields)
If creating: formService.createForm(dbForm, dbFields)
  |
  v
Navigate to returnTo URL
```

---

## CustomWorkflowTemplateModal Changes

### Remove
- All `showFieldBuilder` state and conditional rendering
- The `SimpleFormBuilder` import and usage
- The `handleFormFieldsChange`, `handleSaveEditedTemplate`, `handleCreateTemplate` functions
- The entire field builder view (lines ~377-499 of current file)

### Keep
- Template list with cards, search, filter, statistics
- Loading state and empty state
- `handleDeleteTemplate` (but switch `confirm()` to `GuardianSweetAlert`)
- `handleToggleStatus`
- Footer

### Modify
- **"Create New Template"** button: instead of `setShowCreateForm(true)`, navigate to `/form-builder/new?returnTo=/admin`
- **Create form section**: replace "Continue to Field Builder" with navigation. The name/description/type fields can either stay in the modal (fill out, then navigate with params) or move to the FormBuilderPage header. Recommendation: **keep the create form in the modal** so the user fills out metadata first, then navigates with those params in the URL.
- **"Edit Fields"** button on each card: navigate to `/form-builder/${template.FORM_ID}?returnTo=/admin`
- `handleEditTemplate`: simplify to just `navigate(`/form-builder/${template.FORM_ID}?returnTo=/admin`)`

---

## Styling

All styles use CSS classes prefixed with `fb-` to avoid collisions with existing Guardian styles. Styles are injected via a `<style>` tag inside the component (same pattern as the spec) or in a dedicated `FormBuilder.css` file imported by the component.

### CSS Variables (scoped to `.fb-wrap`)
```css
--fb-accent:       #3B6EF0
--fb-accent-light: rgba(59,110,240,.08)
--fb-accent-faint: rgba(59,110,240,.35)
--fb-accent-glow:  rgba(59,110,240,.14)
--fb-bg:           #F3F5F9
--fb-panel:        #ffffff
--fb-input:        #FAFBFC
--fb-secondary:    #F7F8FA
--fb-border:       #E4E6EB
--fb-text:         #1A1D23
--fb-text-2:       #6B7280
--fb-text-3:       #9EA5B3
--fb-danger:       #E53935
```

### Theme panel
Accent color swatches allow changing `--fb-accent` at runtime. This is cosmetic — theme choice is not persisted.

---

## Route Configuration

Add to `App.tsx`:
```tsx
import FormBuilderPage from './pages/FormBuilderPage';

// Inside <Routes>, in the protected section:
<Route path="/form-builder/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
<Route path="/form-builder/:formId" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
```

---

## Files Created

| File | Purpose |
|---|---|
| `src/components/FormBuilder/FormBuilder.tsx` | Three-panel form builder component |
| `src/components/FormBuilder/index.ts` | Barrel export |
| `src/pages/FormBuilderPage.tsx` | Page wrapper with routing, data loading, save logic |

## Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Add `/form-builder/:formId?` route |
| `src/components/CustomWorkflowTemplateModal.tsx` | Remove field builder, add navigation |

## Files NOT Modified

| File | Reason |
|---|---|
| `src/components/SimpleFormBuilder.tsx` | Still used by other modals |
| `src/services/formService.ts` | Reused as-is |
| `src/services/fieldTypeService.ts` | Reused as-is |
| `src/types/formBuilder.ts` | Reused as-is. The builder stores `size` and `columns` in component-local state per field (not on `FormField`), so no type changes needed. |
| `server.cjs` / `server-production.js` / `server.js` | No new API endpoints needed |

## Dependencies

**No new npm packages.** The component uses:
- React built-in hooks (`useState`, `useRef`, `useCallback`, `useEffect`)
- React Router (`useParams`, `useSearchParams`, `useNavigate`)
- Native HTML5 Drag and Drop API
- Existing services: `formService`, `fieldTypeService`
- Existing types: `FormField`, `UiFieldType`
- Existing utilities: `GuardianSweetAlert`, `toast`

---

## Out of Scope

- JSON schema storage (`BUILDER_SCHEMA` column) — not needed
- Version history table (`FORM_BUILDER_VERSIONS`) — not needed
- New API endpoints (`/api/form-builder/*`) — not needed
- Conditions engine — stub only, future phase
- Sidebar nav link — can be added later if desired
- `@dnd-kit` removal from SimpleFormBuilder — SimpleFormBuilder stays as-is
