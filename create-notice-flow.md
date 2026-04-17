# Create Notice — Flow Specification

## Overview

A two-step modal flow for creating and sending notices. Users select a template on step 1, then populate notice details and template-specific fields on step 2.

---

## Step 1 — Select template

**Modal title:** Create notice

Users select from a list of available notice templates. One template is pre-selected by default (first in list).

### Template card states

| State | Border | Background |
|-------|--------|------------|
| Default | `1px solid #E0E0E0` | `#FFFFFF` |
| Selected | `1.5px solid #2F8CED` | `#EBF5FE` |

### Radio indicator

| State | Fill | Inner dot |
|-------|------|-----------|
| Unselected | Transparent, `1.5px solid #BDBDBD` | None |
| Selected | `#2F8CED` solid | `6px` white circle |

### Template icon

- Size: `34 × 34px`, `border-radius: 4px`
- Default background: `#E0E0E0`, icon stroke `#828282`
- Selected background: `#B5D4F4`, icon stroke `#2F8CED`

### Available templates

| Template | Description |
|----------|-------------|
| Intel dissemination notice | Standard template for distributing finished intelligence |
| Threat advisory | Urgent template for time-sensitive threat notifications |
| Situational awareness brief | Periodic updates for leadership stakeholders |

### Footer

- Left: `* Required fields` + `All actions are logged for CJS audit compliance` — `12px`, `#828282`
- Right: Cancel (secondary button) + Next (primary button)

---

## Step 2 — Fill notice form

**Modal title:** Create notice — save as draft or send.

### Template banner

Displayed immediately below the modal header. Always visible on step 2.

- Background: `#EBF5FE`
- Border-bottom: `1px solid #B5D4F4`
- Padding: `10px 24px`
- Template name: Montserrat, `13px`, `600`, `#032424`
- Template description: Inter, `12px`, `#4F4F4F`
- "Change" link (right-aligned): `13px`, `#2F8CED`, returns user to step 1

---

## Form sections

Sections are separated by a labeled divider:
- Font: Montserrat, `11px`, `600`, `#828282`, uppercase, `letter-spacing: 0.07em`
- Border-bottom: `1px solid #E0E0E0`

### Section 1 — Notice details

Standard fields present on all templates.

| Field | Type | Required | Width |
|-------|------|----------|-------|
| Notice title | Text input | Yes | Full |
| Sensitivity classification | Select | Yes | Half |
| Distribution type | Select | Yes | Half |
| Recipients | Text input (search) | Yes | Full |

**Sensitivity classification options:** Low, Medium, High

**Distribution type options:** Internal only, External, Restricted

---

### Section 2 — Template fields

Fields injected dynamically based on selected template. Visually distinguished from notice detail fields.

**Template field styling:**

- Background: `#EBF5FE`
- Border: `1px solid #B5D4F4`
- Border-radius: `4px`
- Padding: `10px 12px`
- Label: Montserrat, `11px`, `600`, `#1a5f8a`, uppercase
- Layout: two-column for adjacent text inputs; single column for textareas

#### Intel dissemination notice fields

| Field | Type | Required |
|-------|------|----------|
| Subject / intel ID | Text | Yes |
| Classification level | Text | Yes |
| Source summary | Textarea | Yes |
| Key findings | Textarea | Yes |
| Handling caveats | Text | No |

#### Threat advisory fields

| Field | Type | Required |
|-------|------|----------|
| Threat actor / group | Text | Yes |
| Threat type | Text | Yes |
| Affected systems / areas | Text | Yes |
| Severity | Text | Yes |
| Immediate actions required | Textarea | Yes |
| Reporting point of contact | Text | No |

#### Situational awareness brief fields

| Field | Type | Required |
|-------|------|----------|
| Reporting period | Text | Yes |
| Area of focus | Text | Yes |
| Current situation summary | Textarea | Yes |
| Key developments | Textarea | Yes |
| Outlook / forecast | Textarea | No |
| Recommended leadership actions | Textarea | No |

---

### Section 3 — Notice body

Rich text editor. Present on all templates.

**Toolbar controls:** paragraph style selector, Bold, Italic, Underline, unordered list, ordered list, link

- Toolbar background: `#F5F5F5`, border-bottom: `1px solid #E0E0E0`
- Editor area: white background, `80px` min height, no border (contained by outer border)
- Outer border: `1px solid #E0E0E0`, `border-radius: 4px`

---

## Footer — step 2

- Left: compliance note (same as step 1)
- Right (left to right): Back (secondary) → Save draft (ghost/outlined) → Send notice (primary)

---

## Button styles (Guardian system)

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| Primary | `#2F8CED` | `#FFFFFF` | None |
| Secondary | `#FFFFFF` | `#4F4F4F` | `1px solid #BDBDBD` |
| Ghost | `transparent` | `#2F8CED` | `1px solid #2F8CED` |

- Font: Inter, `14px`, `500`
- Border-radius: `4px`
- Padding: `10px 28px` (primary/secondary), `10px 20px` (ghost)

---

## Input styles (Guardian system)

- Font: Inter, `14px`, `#1F1F1F`
- Placeholder: `#828282`
- Border: `1px solid #E0E0E0`
- Border-radius: `4px`
- Padding: `10px 12px`
- Focus border: `1px solid #2F8CED`

---

## Typography (Guardian system)

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Modal title | Montserrat | `20px` | `600` | `#032424` |
| Section divider | Montserrat | `11px` | `600` | `#828282` |
| Template field label | Montserrat | `11px` | `600` | `#1a5f8a` |
| Template banner name | Montserrat | `13px` | `600` | `#032424` |
| Form labels | Inter | `14px` | `500` | `#4F4F4F` |
| Input / body text | Inter | `14px` | `400` | `#1F1F1F` |
| Footer note | Inter | `12px` | `400` | `#828282` |
| Required indicator `*` | Inter | inherited | `400` | `#C10000` |

---

## Overlay

- Background: `rgba(3, 36, 36, 0.6)` (Guardian Primary `#032424` at 60% opacity)
- Modal border-radius: `4px`
- Modal border: `1px solid #E0E0E0`
