# Export Page Design Spec

## Overview

Replace all inline CSV/Excel blob downloads with a dedicated, Guardian-branded Export Page at `/export/:type`. The page provides format selection (CSV, JSON, PDF), a 3-tab data preview (Structured, Table, Raw), and a polished download flow with success modal. The visual design matches the reference template at `subject-workup-export.html`.

## Problem

Current export functionality is fragmented: some pages have basic CSV blob downloads, some have had exports removed, and form submission data has no export capability at all. Inspectors and users need a consistent, flexible way to export data in the format they need.

## Architecture

### Route

`/export/:type` where `type` is one of: `requests`, `tasks`, `progress`, `users`, `forms`

### New Files

| File | Purpose |
|---|---|
| `src/pages/ExportPage.tsx` | Main export page component |
| `src/config/exportConfig.ts` | Per-type config: metadata fields, section definitions, column headers |
| `src/utils/exportUtils.ts` | CSV/JSON generation, PDF print trigger |

### Navigation Flow

Existing export buttons on each page become `navigate('/export/:type', { state: { data, filters, metadata } })` calls. Data is passed via React Router state -- no additional API calls needed since the source page already has the data loaded. If no state is present (direct URL visit), redirect back to the source page.

## Entry Points

| Page | Route | Current State | Change |
|---|---|---|---|
| Request Dashboard | `/requests-dashboard` | No export button (removed) | Add "Export" button to toolbar, navigates to `/export/requests` |
| Request Detail Modal > Details tab | `/requests-dashboard` (modal) | No export for form data | Add "Export" button near form data, navigates to `/export/forms` |
| Request Detail Modal > Tasks tab | `/requests-dashboard` (modal) | Export dropdown exists in TaskTable.tsx | Replace with navigation to `/export/tasks` |
| Request Detail Modal > Results tab | `/requests-dashboard` (modal) | Export dropdown exists in WorkProgressTable.tsx | Replace with navigation to `/export/progress` |
| Admin User Management | `/admin-user-management` | "Export to Excel" button exists | Replace with navigation to `/export/users` |
| My Assigned Requests | `/requests-dashboard` (scroll) | Export removed from code | Add "Export" button, navigates to `/export/requests` with filtered data |

## Export Page Layout

Matches the reference HTML template structure exactly:

### Header
- Guardian teal gradient background (`#0d4f4f` to `#1a6b6b`)
- Shield icon + "Guardian - Export [Type] Data" title
- "Back" button using `window.history.back()`

### Metadata Grid
- Green-bordered card (`#f0fdf4` background, `#86efac` border)
- 4-6 metadata items per type (see Data Mapping below)
- Labels in uppercase green (`#059669`), values in dark text

### Format Selector
- 3 clickable cards: CSV, JSON, PDF
- Selected state: teal border + green background + checkmark
- Each card has icon, format badge, and description

### Data Preview
- Dark header bar (`#0d4f4f`) showing field/section counts
- 3 tabs: Structured View (default), Table View, Raw Data
- Structured View: collapsible sections with label/value rows, checklist grids
- Table View: flat table with Field Name, Value, Section, Required, Last Modified columns
- Raw Data: JSON syntax-highlighted on dark background (`#1a1a2e` bg, `#2dd4bf` text)

### Export Actions Footer
- Left: field/section count summary
- Right: "Preview Export" button (switches to relevant tab) + "Export Now" button (teal primary)

### Success Modal
- Overlay with centered modal card
- Green checkmark icon
- "Export Complete!" heading
- Animated progress bar (cosmetic, fills over ~500ms)
- Filename display in monospace
- File size estimate
- "Download File" primary button + "Close" outline button

## Data Mapping Per Type

### Requests (`/export/requests`)

**Metadata:**
- Total Records: count of filtered requests
- Date Range: earliest to latest submission date
- Status Filter: current filter applied (or "All")
- Exported By: current user's name
- Company: current user's company
- Export Date: current timestamp

**Sections (Structured View):**
- Request rows grouped by status (Pending, In Progress, Completed, Cancelled)
- Each row: Tracking ID, Request Name, Status, Submitted Date, Requestor, Assigned To

**Table View columns:** Tracking ID, Request Name, Status, Submitted, Requestor, Assigned To

### Tasks (`/export/tasks`)

**Metadata:**
- Request ID: parent request tracking ID
- Total Tasks: count
- By Status: Pending/In Progress/Completed/Cancelled counts
- Exported By: current user's name
- Export Date: current timestamp

**Sections:**
- Tasks grouped by status
- Each row: Task ID, Description, Status, Assigned To, Created Date

**Table View columns:** Task ID, Description, Status, Assigned To, Created Date

### Progress (`/export/progress`)

**Metadata:**
- Request ID: parent request tracking ID
- Total Entries: count
- Total Hours: sum of hours worked
- Exported By: current user's name
- Export Date: current timestamp

**Sections:**
- Progress entries grouped by type
- Each row: Type, Title, Description, User, Date, Hours Worked, Visible to Requestor

**Table View columns:** Type, Title, Description, User, Date, Hours, Visible

### Users (`/export/users`)

**Metadata:**
- Company: current user's company name
- Active Users: count
- Pending Invites: count
- Exported By: current user's name
- Export Date: current timestamp

**Sections:**
- Active Users section: Name, Email, Role, Status, Date Added
- Invited Users section: Email, Role, Status, Date Sent, Expires

**Table View columns:** Name, Email, Role, Status, Type (User/Invite), Date

### Forms (`/export/forms`)

**Metadata:**
- Form Template: template name
- Case/Request ID: tracking ID
- Submitted By: requestor name
- Submission Date: form submission timestamp
- Status: form/request status
- Assigned To: processor/analyst name

**Sections:**
- Form field values grouped by form sections dynamically based on the form template structure
- Section names come from the form template definition (e.g., "Subject Information", "Demographics") -- not hardcoded
- Each section shows label/value pairs for all fields in that section
- Checklist fields render as checked/unchecked grid
- Empty fields show "Not provided" in italic gray
- If the form has no sections, all fields appear in a single "Form Data" section

**Related Data subsection** (amber background):
- Form Instance ID
- Linked Attachments count
- Associated Tasks count
- Notifications Sent count

**Table View columns:** Field Name, Value, Section, Required, Last Modified

## Export Format Implementation

### CSV
Generated in-browser. Structure:
```
"[Type] Export - [Title]"
"Export Date","[timestamp]"
"Exported By","[user name]"

"[SECTION NAME]"
"Field","Value"
"[field1]","[value1]"
"[field2]","[value2]"
...
```
Downloaded as blob with MIME type `text/csv`.

### JSON
Serialized structured object:
```json
{
  "metadata": { ... },
  "sections": {
    "section_name": { ... }
  },
  "related_data": { ... }
}
```
Downloaded as blob with MIME type `application/json`.

### PDF
Uses `window.print()` with embedded `@media print` CSS:
- Hide header action buttons, format selector, tab navigation, export actions footer
- Show all sections expanded in Structured View
- Guardian teal branding in section headers
- Page break rules between large sections
- Clean typography optimized for print

### Filename Convention
`{identifier}_{type}_{date}.{ext}`

Examples:
- `REQ-2026-0142_requests_2026-04-07.csv`
- `TSK-request-290_tasks_2026-04-07.json`
- `users_export_2026-04-07.pdf`
- `SW-2026-0142_subject-workup_2026-04-07.csv`

## Styling

All styles are embedded in `ExportPage.tsx` (or a co-located CSS file) matching the reference template exactly:

- **Colors:** Guardian teal (`#0d4f4f`, `#1a6b6b`, `#2dd4bf`), background gray (`#f0f2f5`), text dark (`#1a1a2e`)
- **Fonts:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`)
- **Cards:** White backgrounds, `border-radius: 12px`, subtle shadows
- **Buttons:** Teal primary, white/transparent secondary, outlined tertiary
- **Responsive:** Stacks format cards vertically on mobile, full-width buttons, single-column data rows

## Dependencies

No new libraries required:
- CSV: string concatenation + Blob
- JSON: `JSON.stringify` + Blob
- PDF: `window.print()` + `@media print` CSS
- Navigation: existing React Router
- Icons: existing Lucide React icons

## Component Props

```typescript
// Route state passed from source pages
interface ExportPageState {
  data: any[];           // The actual data rows
  metadata: Record<string, string>;  // Key-value pairs for metadata grid
  title?: string;        // Override for page title (e.g., form template name)
  identifier?: string;   // For filename (e.g., tracking ID, "users")
}
```

## Config Structure

```typescript
// exportConfig.ts
interface ExportTypeConfig {
  pageTitle: string;
  icon: string;
  metadataFields: { label: string; key: string }[];
  sections: {
    title: string;
    icon: string;
    groupBy?: string;        // field to group rows by
    fields: { label: string; key: string; required?: boolean }[];
  }[];
  tableColumns: { header: string; key: string }[];
}

const exportConfigs: Record<string, ExportTypeConfig> = {
  requests: { ... },
  tasks: { ... },
  progress: { ... },
  users: { ... },
  forms: { ... },
};
```

## Error Handling

- **No data in route state:** Redirect to home page with toast "No data to export"
- **Empty data array:** Show the export page with "No records to export" message in the preview area
- **PDF print cancelled:** No action needed, user controls the print dialog
- **Large datasets:** No pagination needed in export -- all filtered data is included

## Testing

Playwright tests should verify:
1. Navigation from each source page to the correct export route
2. Metadata grid populates correctly per type
3. Format selection toggles between CSV/JSON/PDF
4. Tab switching between Structured/Table/Raw views
5. Export Now triggers success modal
6. Download produces valid file content
7. Back button returns to source page
8. Empty data state displays correctly
9. Responsive layout on mobile viewport
