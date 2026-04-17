# Notice workflow — implementation spec

## Overview

The notice workflow covers two distinct user journeys that must be implemented end-to-end:

1. **Template authoring** — an admin creates a notice template in the Custom Workflow Templates system using the Form Builder, defines its fields, and publishes it.
2. **Notice creation** — a user selects an active notice template, fills in notice details and template-specific fields, and either saves a draft or sends the notice.

Both journeys are connected: templates created in journey 1 appear dynamically in journey 2. There are no hardcoded templates.

---

## Journey 1 — Template authoring

### Screen 1A: Custom Workflow Templates modal

**Trigger:** User clicks `+ Create New Template` from the Custom Workflow Templates management screen.

**Modal title:** Custom workflow templates

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Template name | Text input | Yes | Free text, max recommended 80 chars |
| Template type | Select | No | Must default to first option; options include `Notice — Notification forms` and `Request — Workflow forms` |
| Description | Textarea | No | Max 500 chars; show character counter `{n}/500` below right |

**Template type filter:** Only templates with `template_type = "notice"` will be surfaced in the Create Notice modal. The `template_type` value must be stored on save and used as a filter in journey 2.

#### Validation

- Template name is required. Show inline error `"Template name is required"` on submit if empty.
- Description character count must not exceed 500. Disable further input at limit.

#### Actions

| Button | Style | Behaviour |
|---|---|---|
| Continue to field builder | Green primary (`#27AE60`) | Saves template metadata and opens Form Builder (screen 1B) |
| Cancel | Secondary outlined | Closes modal without saving |

#### Footer note

`* Required fields`

---

### Screen 1B: Form Builder

**Trigger:** User clicks "Continue to field builder" on screen 1A. Template is saved in `Draft` status before the Form Builder opens.

**Layout:** Full-page editor. Three areas:
- Top bar — template name, status badge, field count, action buttons
- Left sidebar — draggable/clickable field type palette
- Main canvas — form preview with live field rendering

#### Top bar

| Element | Detail |
|---|---|
| App identifier | "FB" badge + "Form Builder" label |
| Template name | Editable inline — `Montserrat`, `600`, `#032424` |
| Status badge | `Draft` (grey outlined) until published; `Active` (green) after publish |
| Field count | `{n} fields` — updates live as fields are added/removed |
| Save & publish button | Blue primary (`#2F8CED`); on click: validates, sets `status = "active"`, closes builder, returns user to Notices Dashboard with success banner |

#### Left sidebar — field type palette

Group fields under the following category headers (Montserrat, `10px`, `600`, uppercase, `#828282`):

- **Basic:** Text input, Textarea, Number, Email, Phone
- **Selection:** Dropdown, Radio button, Checkbox
- **Date & time:** Date, Time, DateTime
- **Specialized:** URL, Password, Hidden
- **File:** File upload
- **Layout:** Header, Divider

Each field tile: `background: #fff`, `border: 1px solid #E0E0E0`, `border-radius: 4px`, `padding: 7px 10px`, `font-size: 12px`. Click or drag onto canvas to add.

#### Main canvas

- Shows template name and description at top (read-only display)
- Fields render in a two-column grid by default; textareas span full width
- Each field card shows: field type label (uppercase, `#828282`), field name (editable), and a preview of the input element
- Active/selected field card: `border: 1.5px solid #2F8CED`
- `+ Add field` drop zone at the bottom: `border: 1.5px dashed #BDBDBD`, `border-radius: 4px`

#### On publish

1. Set `template.status = "active"`
2. Set `template.template_type = "notice"` (inherited from screen 1A selection)
3. Redirect to Notices Dashboard
4. Display success banner (see screen 1C)

---

### Screen 1C: Notices Dashboard — post-publish state

**Trigger:** Automatic redirect after successful publish from Form Builder.

#### Success banner

Displayed at top of dashboard content area. Dismissable.

- Background: `#EBF5FE`
- Border: `1px solid #B5D4F4`
- Border-radius: `4px`
- Icon: green checkmark circle (`#27AE60`)
- Message: `"{template_name}" template published successfully.`
- Subtext: `It is now available when creating a new notice.`

The published template is now returned by the notice template API and will appear in the Create Notice modal.

---

## Journey 2 — Notice creation

### Trigger

User clicks `Create Notice` button on the Notices Dashboard.

---

### Screen 2A: Create notice — select template (step 1 of 2)

**Modal title:** `Create notice`

**On open:** Fetch all active notice templates from the Custom Workflow Templates API (`status = "active"`, `template_type = "notice"`), ordered by creation date ascending. Pre-select the first result.

#### Template list

Render one radio card per template:

```
[ radio ] [ icon ] Template name                    [CUSTOM]
                   Template description
```

**Radio card — default state**

| Property | Value |
|---|---|
| Border | `1px solid #E0E0E0` |
| Background | `#FFFFFF` |
| Border-radius | `4px` |
| Padding | `12px 14px` |

**Radio card — selected state**

| Property | Value |
|---|---|
| Border | `1.5px solid #2F8CED` |
| Background | `#EBF5FE` |

**Radio indicator**

| State | Style |
|---|---|
| Unselected | `17×17px` circle, `border: 1.5px solid #BDBDBD`, transparent fill |
| Selected | `#2F8CED` fill, `6px` white inner dot |

**Template icon**

- Size: `32×32px`, `border-radius: 4px`
- Default: `background: #E0E0E0`, SVG stroke `#828282`
- Selected: `background: #B5D4F4`, SVG stroke `#2F8CED`

**CUSTOM badge**

All user-created templates display a `CUSTOM` badge (right-aligned):

- Background: `#EBF5FE`
- Border: `1px solid #B5D4F4`
- Text: Montserrat, `10px`, `600`, `#1a5f8a`, uppercase
- Border-radius: `3px`
- Padding: `2px 7px`

#### Empty state

If no active notice templates exist:

> No notice templates available. Create one in Custom Workflow Templates.

Include a link to the Custom Workflow Templates management screen.

#### Error state

If the API call fails, show:

> Failed to load templates. [Retry]

Do not render a blank list.

#### Footer

- Left: `* Required fields · All actions are logged for CJS audit compliance` — Inter, `11px`, `#828282`
- Right: `Cancel` (secondary) + `Next` (primary blue `#2F8CED`)

---

### Screen 2B: Create notice — fill form (step 2 of 2)

**Modal title:** `Create notice — save as draft or send`

#### Template banner

Pinned immediately below the modal header. Always visible.

| Property | Value |
|---|---|
| Background | `#EBF5FE` |
| Border-bottom | `1px solid #B5D4F4` |
| Padding | `9px 20px` |
| Template name | Montserrat, `13px`, `600`, `#032424` |
| Template description | Inter, `12px`, `#4F4F4F` |
| "Change" link | Right-aligned, `13px`, `#2F8CED`; returns to screen 2A |

---

#### Section 1 — Notice details

Section header style: Montserrat, `10px`, `600`, `#828282`, uppercase, `letter-spacing: 0.07em`, `border-bottom: 1px solid #E0E0E0`

| Field | Type | Required | Layout |
|---|---|---|---|
| Notice title | Text input | Yes | Full width |
| Sensitivity classification | Select | Yes | Half width |
| Distribution type | Select | Yes | Half width |
| Recipients | Text input with search | Yes | Full width |

**Sensitivity classification options:** Low, Medium, High

**Distribution type options:** Internal only, External, Restricted

**Recipients field:** Typeahead search against users and contact groups. Supports multi-select. Display selected recipients as removable chips inside the field.

---

#### Section 2 — Template fields

Section header: `TEMPLATE FIELDS — {TEMPLATE_NAME}` (same style as section 1 header)

Rendered dynamically from `template.fields[]` returned by the API. The field schema for each entry must include at minimum:

```json
{
  "id": "string",
  "label": "string",
  "type": "text | textarea | dropdown | radio | checkbox | date | file_upload | ...",
  "required": true | false,
  "placeholder": "string",
  "options": ["string"] // for dropdown, radio, checkbox only
}
```

**Template field container**

- Background: `#EBF5FE`
- Border: `1px solid #B5D4F4`
- Border-radius: `4px`
- Padding: `12px`
- All template fields rendered inside this container

**Individual template field card**

- Background: `#EBF5FE`
- Border: `1px solid #B5D4F4`
- Border-radius: `4px`
- Padding: `9px 11px`
- Label: Montserrat, `10px`, `600`, `#1a5f8a`, uppercase

**Layout rules**

- Two adjacent `text` / `number` / `email` fields → two-column grid (`1fr 1fr`)
- Any `textarea`, `file_upload`, or standalone field → full width
- Required indicator `*` color: `#C10000`

**Supported field type rendering**

| Field type | Renders as |
|---|---|
| `text` | `<input type="text">` |
| `textarea` | `<textarea>` min-height `54px` |
| `number` | `<input type="number">` |
| `email` | `<input type="email">` |
| `dropdown` | `<select>` with `options[]` |
| `radio` | Radio button group |
| `checkbox` | Checkbox group |
| `date` | Date picker input |
| `file_upload` | File upload control |

---

#### Section 3 — Notice body

Rich text editor, present on all templates regardless of template fields.

Section header: `NOTICE BODY` (same style)

**Toolbar controls (left to right):** Paragraph style selector, Bold, Italic, Underline, Unordered list, Ordered list, Insert link

- Toolbar: `background: #F5F5F5`, `border-bottom: 1px solid #E0E0E0`, `padding: 6px 8px`
- Editor area: `background: #fff`, min-height `80px`, no inner border
- Outer wrapper: `border: 1px solid #E0E0E0`, `border-radius: 4px`

---

#### Footer — step 2

- Left: compliance note (same as step 1)
- Right (left to right):
  - `Back` — secondary; returns to screen 2A
  - `Save draft` — ghost/outlined (`border: 1px solid #2F8CED`, text `#2F8CED`); saves notice with `status = "draft"`
  - `Send notice` — primary blue (`#2F8CED`); validates required fields, submits notice, closes modal, refreshes dashboard list

---

## Validation — step 2

On clicking `Send notice`, validate:

- Notice title: required, not empty
- Sensitivity classification: required
- Distribution type: required
- Recipients: at least one recipient selected
- All template fields where `required: true`: not empty
- Notice body: optional (do not block send if empty)

Show inline error messages below each failing field. Scroll to first error.

On clicking `Save draft`, skip validation — allow partial saves.

---

## Data model

### Template object

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "template_type": "notice | request",
  "status": "draft | active | inactive",
  "fields": [
    {
      "id": "uuid",
      "label": "string",
      "type": "text | textarea | dropdown | radio | checkbox | date | number | email | file_upload",
      "required": true,
      "placeholder": "string",
      "options": [],
      "order": 0
    }
  ],
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "created_by": "user_id"
}
```

### Notice object

```json
{
  "id": "uuid",
  "title": "string",
  "template_id": "uuid",
  "sensitivity_classification": "low | medium | high",
  "distribution_type": "internal_only | external | restricted",
  "recipients": ["user_id | group_id"],
  "template_field_values": {
    "field_id": "value"
  },
  "body": "html string",
  "status": "draft | sent",
  "created_at": "ISO8601",
  "sent_at": "ISO8601 | null",
  "created_by": "user_id"
}
```

---

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/templates?type=notice&status=active` | Fetch active notice templates for Create Notice modal |
| `POST` | `/api/templates` | Create new template (from screen 1A) |
| `PUT` | `/api/templates/{id}` | Update template fields (from Form Builder) |
| `PATCH` | `/api/templates/{id}/publish` | Set status to `active` |
| `POST` | `/api/notices` | Create notice (draft or sent) |
| `GET` | `/api/notices` | Fetch all notices for dashboard list |

---

## Design tokens (Guardian system)

### Colors

| Token | Hex | Usage |
|---|---|---|
| Primary dark | `#032424` | Modal titles, template names |
| Info blue | `#2F8CED` | Primary buttons, selected states, focus borders, links |
| Success green | `#27AE60` | Publish button, success banner icons |
| Error red | `#C10000` | Required field indicators, validation errors |
| Text primary | `#1F1F1F` | Body text, input values |
| Text secondary | `#4F4F4F` | Labels, descriptions |
| Text muted | `#828282` | Placeholder, helper text, section headers |
| Text disabled | `#BDBDBD` | Disabled elements, borders |
| Border default | `#E0E0E0` | Input borders, card borders, dividers |
| Border info | `#B5D4F4` | Template field container borders, selected card borders |
| Fill info light | `#EBF5FE` | Template field backgrounds, selected card backgrounds, banner background |
| Fill surface | `#F5F5F5` | Toolbar backgrounds, sidebar backgrounds |

### Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Modal title | Montserrat | `17–20px` | `600` | `#032424` |
| Section header | Montserrat | `10px` | `600` | `#828282` |
| Template field label | Montserrat | `10px` | `600` | `#1a5f8a` |
| Template banner name | Montserrat | `13px` | `600` | `#032424` |
| Form labels | Inter | `13–14px` | `500` | `#4F4F4F` |
| Body / input text | Inter | `13–14px` | `400` | `#1F1F1F` |
| Helper / footer text | Inter | `11–12px` | `400` | `#828282` |
| Required `*` | Inter | inherited | `400` | `#C10000` |
| CUSTOM badge | Montserrat | `10px` | `600` | `#1a5f8a` |

### Buttons

| Variant | Background | Text | Border | Padding |
|---|---|---|---|---|
| Primary | `#2F8CED` | `#FFFFFF` | None | `9px 22px` |
| Green primary | `#27AE60` | `#FFFFFF` | None | `9px 22px` |
| Secondary | `#FFFFFF` | `#4F4F4F` | `1px solid #BDBDBD` | `9px 22px` |
| Ghost | Transparent | `#2F8CED` | `1px solid #2F8CED` | `9px 18px` |

All buttons: Inter, `13px`, `500`, `border-radius: 4px`

### Inputs

- Font: Inter, `13px`, `#1F1F1F`
- Placeholder: `#828282`
- Border: `1px solid #E0E0E0`, `border-radius: 4px`, `padding: 9px 11px`
- Focus: `border-color: #2F8CED`

### Modal

- Background: `#FFFFFF`
- Border: `1px solid #E0E0E0`
- Border-radius: `4px`
- Overlay: `rgba(3, 36, 36, 0.55)`

---

## Compliance requirements

- All notice creation and send actions must be logged for CJS audit compliance
- The footer of every modal step must display: `* Required fields · All actions are logged for CJS audit compliance`
- `sent_at` timestamp must be stored on the notice record when `Send notice` is submitted
- `created_by` must be populated from the authenticated user session on both template and notice records
