# Export Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline CSV/Excel downloads with a dedicated Guardian-branded Export Page at `/export/:type` supporting CSV, JSON, and PDF formats with data preview and polished download UX.

**Architecture:** Single `ExportPage` component at `/export/:type` driven by a config map (`exportConfig.ts`). Each source page navigates here via React Router state, passing its data. Export utilities handle CSV/JSON generation and PDF print. No new libraries needed.

**Tech Stack:** React, TypeScript, React Router DOM, React Bootstrap, Lucide icons, `@media print` CSS for PDF

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/config/exportConfig.ts` | Create | Per-type config: metadata fields, section definitions, table columns |
| `src/utils/exportUtils.ts` | Create | CSV string generation, JSON serialization, PDF print trigger, file download |
| `src/pages/ExportPage.tsx` | Create | Full export page: header, metadata grid, format selector, 3-tab preview, success modal |
| `src/pages/ExportPage.css` | Create | All styles matching the reference HTML template |
| `src/App.tsx` | Modify | Add `/export/:type` route |
| `src/pages/RequestDashboard.tsx` | Modify | Add Export button to toolbar, navigate to `/export/requests` |
| `src/components/RequestModal.tsx` | Modify | Add Export button to modal header, navigate to `/export/forms` |
| `src/components/TaskTable.tsx` | Modify | Replace Export dropdown with navigation to `/export/tasks` |
| `src/components/WorkProgressTable.tsx` | Modify | Replace Export dropdown with navigation to `/export/progress` |
| `src/pages/AdminUserManagement.tsx` | Modify | Replace Export button with navigation to `/export/users` |

---

### Task 1: Create Export Config

**Files:**
- Create: `src/config/exportConfig.ts`

- [ ] **Step 1: Create the export config file**

```typescript
// src/config/exportConfig.ts

export interface ExportSectionField {
  label: string;
  key: string;
  required?: boolean;
}

export interface ExportSection {
  title: string;
  iconType: 'users' | 'folder' | 'file-text' | 'check-square' | 'clock' | 'search' | 'map-pin' | 'phone' | 'monitor' | 'activity';
  groupBy?: string;
  fields: ExportSectionField[];
}

export interface ExportMetadataField {
  label: string;
  key: string;
}

export interface ExportTableColumn {
  header: string;
  key: string;
}

export interface ExportTypeConfig {
  pageTitle: string;
  iconType: 'file-text' | 'check-square' | 'clock' | 'users' | 'folder';
  metadataFields: ExportMetadataField[];
  sections: ExportSection[];
  tableColumns: ExportTableColumn[];
}

export const exportConfigs: Record<string, ExportTypeConfig> = {
  requests: {
    pageTitle: 'Export Request Data',
    iconType: 'file-text',
    metadataFields: [
      { label: 'Total Records', key: 'totalRecords' },
      { label: 'Date Range', key: 'dateRange' },
      { label: 'Status Filter', key: 'statusFilter' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Company', key: 'company' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Requests',
        iconType: 'file-text',
        groupBy: 'STATUS',
        fields: [
          { label: 'Tracking ID', key: 'TRACKINGID', required: true },
          { label: 'Request Name', key: 'REQUEST_NAME', required: true },
          { label: 'Status', key: 'STATUS', required: true },
          { label: 'Submitted', key: 'SUBMITTED_DATE' },
          { label: 'Requestor', key: 'requestorName' },
          { label: 'Assigned To', key: 'assignedTo' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Tracking ID', key: 'TRACKINGID' },
      { header: 'Request Name', key: 'REQUEST_NAME' },
      { header: 'Status', key: 'STATUS' },
      { header: 'Submitted', key: 'SUBMITTED_DATE' },
      { header: 'Requestor', key: 'requestorName' },
      { header: 'Assigned To', key: 'assignedTo' },
    ],
  },
  tasks: {
    pageTitle: 'Export Task Data',
    iconType: 'check-square',
    metadataFields: [
      { label: 'Request ID', key: 'requestId' },
      { label: 'Total Tasks', key: 'totalTasks' },
      { label: 'Pending', key: 'pendingCount' },
      { label: 'In Progress', key: 'inProgressCount' },
      { label: 'Completed', key: 'completedCount' },
      { label: 'Exported By', key: 'exportedBy' },
    ],
    sections: [
      {
        title: 'Tasks',
        iconType: 'check-square',
        groupBy: 'STATUS',
        fields: [
          { label: 'Task ID', key: 'TASK_ID', required: true },
          { label: 'Description', key: 'DESCRIPTION', required: true },
          { label: 'Status', key: 'STATUS', required: true },
          { label: 'Assigned To', key: 'assignedUser' },
          { label: 'Created', key: 'CREATE_DATE' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Task ID', key: 'TASK_ID' },
      { header: 'Description', key: 'DESCRIPTION' },
      { header: 'Status', key: 'STATUS' },
      { header: 'Assigned To', key: 'assignedUser' },
      { header: 'Created', key: 'CREATE_DATE' },
    ],
  },
  progress: {
    pageTitle: 'Export Progress Data',
    iconType: 'clock',
    metadataFields: [
      { label: 'Request ID', key: 'requestId' },
      { label: 'Total Entries', key: 'totalEntries' },
      { label: 'Total Hours', key: 'totalHours' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Progress Entries',
        iconType: 'clock',
        groupBy: 'PROGRESS_TYPE',
        fields: [
          { label: 'Type', key: 'PROGRESS_TYPE', required: true },
          { label: 'Title', key: 'TITLE', required: true },
          { label: 'Description', key: 'DESCRIPTION' },
          { label: 'User', key: 'userName' },
          { label: 'Date', key: 'CREATED_DATE' },
          { label: 'Hours', key: 'HOURS_WORKED' },
          { label: 'Visible to Requestor', key: 'IS_VISIBLE_TO_REQUESTOR' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Type', key: 'PROGRESS_TYPE' },
      { header: 'Title', key: 'TITLE' },
      { header: 'Description', key: 'DESCRIPTION' },
      { header: 'User', key: 'userName' },
      { header: 'Date', key: 'CREATED_DATE' },
      { header: 'Hours', key: 'HOURS_WORKED' },
      { header: 'Visible', key: 'IS_VISIBLE_TO_REQUESTOR' },
    ],
  },
  users: {
    pageTitle: 'Export User Data',
    iconType: 'users',
    metadataFields: [
      { label: 'Company', key: 'company' },
      { label: 'Active Users', key: 'activeUsers' },
      { label: 'Pending Invites', key: 'pendingInvites' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Active Users',
        iconType: 'users',
        fields: [
          { label: 'Name', key: 'name', required: true },
          { label: 'Email', key: 'email', required: true },
          { label: 'Role', key: 'role' },
          { label: 'Status', key: 'status' },
          { label: 'Date Added', key: 'dateCreated' },
        ],
      },
      {
        title: 'Invited Users',
        iconType: 'users',
        fields: [
          { label: 'Email', key: 'email', required: true },
          { label: 'Role', key: 'role' },
          { label: 'Status', key: 'status' },
          { label: 'Date Sent', key: 'dateSent' },
          { label: 'Expires', key: 'expires' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Status', key: 'status' },
      { header: 'Type', key: 'type' },
      { header: 'Date', key: 'date' },
    ],
  },
  forms: {
    pageTitle: 'Export Form Data',
    iconType: 'folder',
    metadataFields: [
      { label: 'Form Template', key: 'formTemplate' },
      { label: 'Request ID', key: 'requestId' },
      { label: 'Submitted By', key: 'submittedBy' },
      { label: 'Submission Date', key: 'submissionDate' },
      { label: 'Status', key: 'status' },
      { label: 'Assigned To', key: 'assignedTo' },
    ],
    sections: [], // Dynamic -- built from form template structure at runtime
    tableColumns: [
      { header: 'Field Name', key: 'fieldName' },
      { header: 'Value', key: 'fieldValue' },
      { header: 'Section', key: 'section' },
      { header: 'Required', key: 'required' },
    ],
  },
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit src/config/exportConfig.ts 2>&1 | head -20`

Expected: No errors (or only unrelated errors from other files)

- [ ] **Step 3: Commit**

```bash
git add src/config/exportConfig.ts
git commit -m "feat: add export type config for Export Page"
```

---

### Task 2: Create Export Utilities

**Files:**
- Create: `src/utils/exportUtils.ts`

- [ ] **Step 1: Create the export utilities file**

```typescript
// src/utils/exportUtils.ts

import { ExportTypeConfig, ExportSection, ExportSectionField } from '../config/exportConfig';

export interface ExportData {
  type: string;
  data: Record<string, any>[];
  metadata: Record<string, string>;
  title?: string;
  identifier?: string;
  dynamicSections?: ExportSection[];
}

/**
 * Format a date string for display
 */
function formatDate(value: any): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get a nested property value from an object using dot notation
 */
function getNestedValue(obj: Record<string, any>, key: string): any {
  return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Format a field value for display
 */
export function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  // Check if it looks like a date
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  return String(value);
}

/**
 * Escape a CSV field value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

/**
 * Generate CSV content from export data
 */
export function generateCSV(
  exportData: ExportData,
  config: ExportTypeConfig,
): string {
  const sections = exportData.dynamicSections || config.sections;
  const lines: string[] = [];

  // Header
  lines.push(escapeCSV(`${config.pageTitle}`));
  lines.push(`${escapeCSV('Export Date')},${escapeCSV(new Date().toISOString())}`);
  Object.entries(exportData.metadata).forEach(([key, value]) => {
    lines.push(`${escapeCSV(key)},${escapeCSV(value)}`);
  });
  lines.push('');

  if (sections.length > 0) {
    // Section-based export
    sections.forEach((section) => {
      lines.push(escapeCSV(section.title.toUpperCase()));
      const headerRow = section.fields.map((f) => escapeCSV(f.label)).join(',');
      lines.push(headerRow);

      const sectionData = section.groupBy
        ? exportData.data
        : exportData.data;

      sectionData.forEach((row) => {
        const dataRow = section.fields
          .map((f) => escapeCSV(formatFieldValue(getNestedValue(row, f.key))))
          .join(',');
        lines.push(dataRow);
      });
      lines.push('');
    });
  } else {
    // Table-based export (fallback)
    const headerRow = config.tableColumns.map((c) => escapeCSV(c.header)).join(',');
    lines.push(headerRow);
    exportData.data.forEach((row) => {
      const dataRow = config.tableColumns
        .map((c) => escapeCSV(formatFieldValue(getNestedValue(row, c.key))))
        .join(',');
      lines.push(dataRow);
    });
  }

  return lines.join('\n');
}

/**
 * Generate JSON content from export data
 */
export function generateJSON(
  exportData: ExportData,
  config: ExportTypeConfig,
): string {
  const sections = exportData.dynamicSections || config.sections;
  const output: Record<string, any> = {
    metadata: {
      exportType: exportData.type,
      exportDate: new Date().toISOString(),
      ...exportData.metadata,
    },
  };

  if (sections.length > 0) {
    sections.forEach((section) => {
      const sectionKey = section.title.toLowerCase().replace(/\s+/g, '_');
      output[sectionKey] = exportData.data.map((row) => {
        const entry: Record<string, any> = {};
        section.fields.forEach((f) => {
          entry[f.key] = getNestedValue(row, f.key) ?? null;
        });
        return entry;
      });
    });
  } else {
    output.data = exportData.data;
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Trigger file download from string content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger PDF export via window.print()
 */
export function triggerPDFExport(): void {
  window.print();
}

/**
 * Generate export filename
 */
export function getExportFilename(
  type: string,
  identifier: string | undefined,
  format: 'csv' | 'json' | 'pdf',
): string {
  const date = new Date().toISOString().split('T')[0];
  const prefix = identifier || type;
  return `${prefix}_${type}_${date}.${format}`;
}

/**
 * Estimate file size from content string
 */
export function estimateFileSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit src/utils/exportUtils.ts 2>&1 | head -20`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportUtils.ts
git commit -m "feat: add CSV/JSON/PDF export utilities"
```

---

### Task 3: Create Export Page CSS

**Files:**
- Create: `src/pages/ExportPage.css`

- [ ] **Step 1: Create the CSS file matching the reference HTML template**

```css
/* src/pages/ExportPage.css */

/* ===== Export Page Styles ===== */
.export-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #f0f2f5;
  color: #1a1a2e;
  line-height: 1.5;
  min-height: 100vh;
}

/* Header */
.export-header {
  background: linear-gradient(135deg, #0d4f4f 0%, #1a6b6b 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.export-header h1 {
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.export-header-actions {
  display: flex;
  gap: 12px;
}

/* Buttons */
.export-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.export-btn-primary {
  background: #2dd4bf;
  color: #0d4f4f;
}

.export-btn-primary:hover {
  background: #5eead4;
  transform: translateY(-1px);
}

.export-btn-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.export-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.25);
}

.export-btn-outline {
  background: white;
  color: #0d4f4f;
  border: 1px solid #d1d5db;
}

.export-btn-outline:hover {
  background: #f9fafb;
  border-color: #0d4f4f;
}

/* Main Content */
.export-main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

/* Export Panel */
.export-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  overflow: hidden;
}

.export-panel-header {
  background: #f8fafc;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-panel-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #0d4f4f;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.export-panel-body {
  padding: 24px;
}

/* Metadata Grid */
.export-metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: #f0fdf4;
  border-radius: 8px;
  border: 1px solid #86efac;
}

.export-metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.export-metadata-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #059669;
  letter-spacing: 0.5px;
}

.export-metadata-value {
  font-size: 14px;
  color: #1a1a2e;
  font-weight: 500;
}

/* Export Format Options */
.export-options {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.export-option {
  flex: 1;
  min-width: 280px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  background: white;
}

.export-option:hover {
  border-color: #0d4f4f;
  background: #f8fafc;
}

.export-option.selected {
  border-color: #0d4f4f;
  background: #f0fdfa;
}

.export-option.selected::after {
  content: '\2713';
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  background: #0d4f4f;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.export-option h3 {
  font-size: 16px;
  font-weight: 600;
  color: #0d4f4f;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.export-option p {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.export-format-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

/* Data Preview */
.export-data-preview {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.export-preview-header {
  background: #0d4f4f;
  color: white;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-preview-tabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.export-preview-tab {
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.export-preview-tab:hover {
  color: #0d4f4f;
  background: #f0fdfa;
}

.export-preview-tab.active {
  color: #0d4f4f;
  border-bottom-color: #0d4f4f;
  background: white;
}

.export-preview-content {
  max-height: 500px;
  overflow-y: auto;
}

/* Sections */
.export-data-section {
  border-bottom: 1px solid #e2e8f0;
}

.export-data-section:last-child {
  border-bottom: none;
}

.export-section-header {
  background: #f8fafc;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #0d4f4f;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: none;
  width: 100%;
  text-align: left;
}

.export-section-header:hover {
  background: #f0fdfa;
}

.export-section-content {
  padding: 16px;
}

.export-data-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.export-data-row:last-child {
  border-bottom: none;
}

.export-data-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.export-data-value {
  font-size: 13px;
  color: #1a1a2e;
}

.export-data-value.empty {
  color: #94a3b8;
  font-style: italic;
}

/* Checklist */
.export-checklist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
}

.export-checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 4px;
  font-size: 12px;
}

.export-checklist-item.checked {
  background: #f0fdf4;
  color: #059669;
}

.export-checklist-item.unchecked {
  color: #94a3b8;
}

.export-check-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
}

.export-check-icon.checked {
  background: #059669;
  color: white;
}

.export-check-icon.unchecked {
  background: #e2e8f0;
  color: transparent;
}

/* Related Data */
.export-related-data {
  margin-top: 16px;
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

.export-related-data h4 {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-related-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 13px;
}

.export-related-item:last-child {
  margin-bottom: 0;
}

/* Table View */
.export-csv-preview {
  overflow-x: auto;
}

.export-csv-preview table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.export-csv-preview th {
  background: #0d4f4f;
  color: white;
  padding: 10px 12px;
  text-align: left;
  font-weight: 500;
  white-space: nowrap;
}

.export-csv-preview td {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.export-csv-preview tr:hover td {
  background: #f8fafc;
}

/* Raw Data View */
.export-raw-data {
  background: #1a1a2e;
  color: #2dd4bf;
  padding: 20px;
  border-radius: 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.6;
  font-family: monospace;
  white-space: pre-wrap;
  margin: 0;
}

/* Export Actions */
.export-actions-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
  margin-top: 24px;
}

.export-info {
  font-size: 13px;
  color: #64748b;
}

.export-info strong {
  color: #1a1a2e;
}

.export-action-buttons {
  display: flex;
  gap: 12px;
}

/* Success Modal */
.export-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  text-align: center;
  animation: exportModalSlide 0.3s ease;
}

@keyframes exportModalSlide {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.export-modal-icon {
  width: 64px;
  height: 64px;
  background: #f0fdf4;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.export-modal h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.export-modal p {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 24px;
}

.export-progress-bar {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 24px;
}

.export-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0d4f4f, #2dd4bf);
  width: 0%;
  transition: width 0.5s ease;
}

.export-download-info {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.export-download-info .filename {
  font-family: monospace;
  font-size: 14px;
  color: #0d4f4f;
  font-weight: 500;
}

.export-download-info .filesize {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

/* Empty State */
.export-empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #64748b;
}

.export-empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

/* Print Styles for PDF Export */
@media print {
  .export-header-actions,
  .export-options,
  .export-preview-tabs,
  .export-actions-footer,
  .export-modal-overlay,
  .export-format-badge {
    display: none !important;
  }

  .export-page {
    background: white;
  }

  .export-header {
    background: #0d4f4f !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .export-panel {
    box-shadow: none;
    break-inside: avoid;
  }

  .export-preview-content {
    max-height: none;
    overflow: visible;
  }

  .export-section-content {
    display: block !important;
  }

  .export-data-section {
    break-inside: avoid;
  }

  .export-metadata-grid {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .export-options {
    flex-direction: column;
  }

  .export-option {
    min-width: 100%;
  }

  .export-data-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .export-actions-footer {
    flex-direction: column;
    gap: 16px;
  }

  .export-action-buttons {
    width: 100%;
    flex-direction: column;
  }

  .export-btn {
    width: 100%;
    justify-content: center;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ExportPage.css
git commit -m "feat: add Export Page styles matching reference template"
```

---

### Task 4: Create Export Page Component

**Files:**
- Create: `src/pages/ExportPage.tsx`

- [ ] **Step 1: Create the ExportPage component**

```typescript
// src/pages/ExportPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  ArrowLeft,
  Download,
  FileText,
  CheckSquare,
  Clock,
  Users,
  Folder,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { exportConfigs, ExportSection } from '../config/exportConfig';
import {
  generateCSV,
  generateJSON,
  downloadFile,
  triggerPDFExport,
  getExportFilename,
  estimateFileSize,
  formatFieldValue,
  ExportData,
} from '../utils/exportUtils';
import './ExportPage.css';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportPageLocationState {
  data: Record<string, any>[];
  metadata: Record<string, string>;
  title?: string;
  identifier?: string;
  dynamicSections?: ExportSection[];
}

const iconMap: Record<string, React.ReactNode> = {
  'file-text': <FileText size={20} />,
  'check-square': <CheckSquare size={20} />,
  'clock': <Clock size={20} />,
  'users': <Users size={20} />,
  'folder': <Folder size={20} />,
  'search': <FileText size={20} />,
  'map-pin': <FileText size={20} />,
  'phone': <FileText size={20} />,
  'monitor': <FileText size={20} />,
  'activity': <FileText size={20} />,
};

const ExportPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ExportPageLocationState | null;

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [activePreviewTab, setActivePreviewTab] = useState<'structured' | 'table' | 'raw'>('structured');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const config = type ? exportConfigs[type] : null;

  // Redirect if no data or invalid type
  useEffect(() => {
    if (!state || !state.data || !config) {
      navigate('/', { replace: true });
    }
  }, [state, config, navigate]);

  if (!state || !config) return null;

  const { data, metadata, title, identifier, dynamicSections } = state;
  const sections = dynamicSections || config.sections;
  const totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0) || config.tableColumns.length;

  const exportData: ExportData = {
    type: type!,
    data,
    metadata,
    title,
    identifier,
    dynamicSections,
  };

  const generatedContent = useMemo(() => {
    if (selectedFormat === 'csv') return generateCSV(exportData, config);
    if (selectedFormat === 'json') return generateJSON(exportData, config);
    return '';
  }, [selectedFormat, exportData, config]);

  const fileSize = useMemo(() => {
    if (generatedContent) return estimateFileSize(generatedContent);
    return '~' + estimateFileSize(generateCSV(exportData, config));
  }, [generatedContent, exportData, config]);

  const filename = getExportFilename(type!, identifier, selectedFormat);

  const handleExportNow = () => {
    if (selectedFormat === 'pdf') {
      triggerPDFExport();
      return;
    }
    setShowSuccessModal(true);
    setTimeout(() => setProgressWidth(100), 100);
  };

  const handleDownload = () => {
    const mimeType = selectedFormat === 'csv' ? 'text/csv' : 'application/json';
    const content = selectedFormat === 'csv'
      ? generateCSV(exportData, config)
      : generateJSON(exportData, config);
    downloadFile(content, filename, mimeType);
    setShowSuccessModal(false);
    setProgressWidth(0);
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setProgressWidth(0);
  };

  const toggleSection = (index: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handlePreviewExport = () => {
    const tabMap: Record<ExportFormat, 'table' | 'raw' | 'structured'> = {
      csv: 'table',
      json: 'raw',
      pdf: 'structured',
    };
    setActivePreviewTab(tabMap[selectedFormat]);
  };

  const pageTitle = title || config.pageTitle;

  return (
    <div className="export-page">
      {/* Header */}
      <header className="export-header">
        <h1>
          <Shield size={28} />
          Guardian - {pageTitle}
        </h1>
        <div className="export-header-actions">
          <button className="export-btn export-btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="export-main-content">
        <div className="export-panel">
          <div className="export-panel-header">
            <h2>
              <Download size={20} />
              {pageTitle}
            </h2>
            {identifier && (
              <span className="export-format-badge">
                {identifier}
              </span>
            )}
          </div>

          <div className="export-panel-body">
            {/* Metadata Grid */}
            <div className="export-metadata-grid">
              {config.metadataFields.map((field) => (
                <div key={field.key} className="export-metadata-item">
                  <span className="export-metadata-label">{field.label}</span>
                  <span className="export-metadata-value">
                    {metadata[field.key] || 'N/A'}
                  </span>
                </div>
              ))}
            </div>

            {/* Format Selection */}
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '16px' }}>
              Select Export Format
            </h3>
            <div className="export-options">
              <div
                className={`export-option ${selectedFormat === 'csv' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('csv')}
              >
                <h3>
                  <FileText size={20} />
                  CSV Export
                  <span className="export-format-badge">.csv</span>
                </h3>
                <p>Spreadsheet-compatible format. Best for data analysis in Excel, Google Sheets, or database import.</p>
              </div>
              <div
                className={`export-option ${selectedFormat === 'json' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('json')}
              >
                <h3>
                  <FileText size={20} />
                  JSON Export
                  <span className="export-format-badge">.json</span>
                </h3>
                <p>Structured data format. Preserves all relationships and nested data. Ideal for system integration.</p>
              </div>
              <div
                className={`export-option ${selectedFormat === 'pdf' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('pdf')}
              >
                <h3>
                  <FileText size={20} />
                  PDF Report
                  <span className="export-format-badge">.pdf</span>
                </h3>
                <p>Formatted printable report. Best for archival, sharing, and official documentation purposes.</p>
              </div>
            </div>

            {/* Data Preview */}
            {data.length > 0 ? (
              <div className="export-data-preview">
                <div className="export-preview-header">
                  <span>Data Preview</span>
                  <span style={{ fontWeight: 400, opacity: 0.8 }}>
                    {data.length} records &bull; {sections.length || 1} sections
                  </span>
                </div>

                <div className="export-preview-tabs">
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'structured' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('structured')}
                  >
                    Structured View
                  </button>
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'table' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('table')}
                  >
                    Table View
                  </button>
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'raw' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('raw')}
                  >
                    Raw Data
                  </button>
                </div>

                {/* Structured View */}
                {activePreviewTab === 'structured' && (
                  <div className="export-preview-content">
                    {sections.length > 0 ? (
                      sections.map((section, sIdx) => (
                        <div key={sIdx} className="export-data-section">
                          <button
                            className="export-section-header"
                            onClick={() => toggleSection(sIdx)}
                          >
                            {iconMap[section.iconType] || <FileText size={16} />}
                            {section.title}
                            <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#64748b' }}>
                              {section.fields.length} fields
                            </span>
                          </button>
                          {!collapsedSections.has(sIdx) && (
                            <div className="export-section-content">
                              {data.map((row, rIdx) => (
                                <React.Fragment key={rIdx}>
                                  {data.length > 1 && (
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0d4f4f', padding: '4px 0', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
                                      Record {rIdx + 1}
                                    </div>
                                  )}
                                  {section.fields.map((field) => {
                                    const value = formatFieldValue(
                                      field.key.includes('.')
                                        ? field.key.split('.').reduce((acc: any, part: string) => acc?.[part], row)
                                        : row[field.key]
                                    );
                                    return (
                                      <div key={field.key} className="export-data-row">
                                        <span className="export-data-label">{field.label}</span>
                                        <span className={`export-data-value ${value === 'Not provided' ? 'empty' : ''}`}>
                                          {value}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="export-section-content">
                        {data.map((row, rIdx) => (
                          <React.Fragment key={rIdx}>
                            {config.tableColumns.map((col) => (
                              <div key={col.key} className="export-data-row">
                                <span className="export-data-label">{col.header}</span>
                                <span className={`export-data-value ${!row[col.key] ? 'empty' : ''}`}>
                                  {formatFieldValue(row[col.key])}
                                </span>
                              </div>
                            ))}
                            {rIdx < data.length - 1 && <hr style={{ margin: '12px 0', borderColor: '#e2e8f0' }} />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Table View */}
                {activePreviewTab === 'table' && (
                  <div className="export-preview-content export-csv-preview">
                    <table>
                      <thead>
                        <tr>
                          {config.tableColumns.map((col) => (
                            <th key={col.key}>{col.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, idx) => (
                          <tr key={idx}>
                            {config.tableColumns.map((col) => (
                              <td key={col.key}>{formatFieldValue(row[col.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Raw Data View */}
                {activePreviewTab === 'raw' && (
                  <div className="export-preview-content">
                    <pre className="export-raw-data">
                      {generateJSON(exportData, config)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="export-empty-state">
                <h3>No records to export</h3>
                <p>There is no data available for export. Go back and try with different filters.</p>
              </div>
            )}

            {/* Export Actions */}
            {data.length > 0 && (
              <div className="export-actions-footer">
                <div className="export-info">
                  <strong>{data.length} records</strong> will be exported across{' '}
                  <strong>{sections.length || 1} sections</strong>
                  <br />
                  Including metadata and all visible data fields
                </div>
                <div className="export-action-buttons">
                  <button className="export-btn export-btn-outline" onClick={handlePreviewExport}>
                    <Eye size={16} />
                    Preview Export
                  </button>
                  <button className="export-btn export-btn-primary" onClick={handleExportNow}>
                    <Download size={16} />
                    Export Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="export-modal-overlay" onClick={handleCloseModal}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-icon">
              <CheckCircle size={32} color="#059669" />
            </div>
            <h3>Export Complete!</h3>
            <p>Your data has been successfully exported and is ready for download.</p>

            <div className="export-progress-bar">
              <div
                className="export-progress-fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            <div className="export-download-info">
              <div className="filename">{filename}</div>
              <div className="filesize">File size: {fileSize}</div>
            </div>

            <button
              className="export-btn export-btn-primary"
              style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
              onClick={handleDownload}
            >
              <Download size={16} />
              Download File
            </button>
            <button
              className="export-btn export-btn-outline"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleCloseModal}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | grep -i "ExportPage\|exportConfig\|exportUtils" | head -20`

Expected: No errors referencing these files

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExportPage.tsx
git commit -m "feat: add ExportPage component with format selection, preview tabs, and download modal"
```

---

### Task 5: Add Export Route to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the import for ExportPage**

In `src/App.tsx`, add this import after the existing page imports (around line 38):

```typescript
import ExportPage from './pages/ExportPage';
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, add this route inside the `<Routes>` block, after the existing protected routes (around line 80, before the closing `</Routes>`):

```typescript
<Route path="/export/:type" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
```

- [ ] **Step 3: Verify the app compiles and the route works**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | grep -i error | head -10`

Then in the browser, navigate to `http://localhost:5175/export/requests` -- it should redirect to home since no state is passed (expected behavior).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /export/:type route to App router"
```

---

### Task 6: Wire Up Request Dashboard Export Button

**Files:**
- Modify: `src/pages/RequestDashboard.tsx`

- [ ] **Step 1: Add useNavigate import**

In `src/pages/RequestDashboard.tsx`, the file already imports from `react-router-dom` via `useRequestState`. Add `useNavigate` to the imports at the top of the file. Find the existing imports and add:

```typescript
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook inside the component**

Inside the `RequestDashboard` component function, add the navigate hook near the top with the other hooks:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Add the Export button to the toolbar**

In `src/pages/RequestDashboard.tsx`, find the toolbar area with the "Refresh" and "Create Request" buttons (around line 1020-1066). Add an Export button after the Refresh button. Find this code:

```typescript
{hasCreateRequestAccess && (
```

Add this **before** that line:

```typescript
{/* Export button */}
<button
  className="btn btn-outline-primary ms-2 d-flex align-items-center gap-2"
  onClick={() => {
    const exportData = (requests || []).map((r: any) => ({
      TRACKINGID: r.TRACKINGID,
      REQUEST_NAME: r.REQUEST_NAME,
      STATUS: r.STATUS === 'P' ? 'Pending' : r.STATUS === 'IP' ? 'In Progress' : r.STATUS === 'C' ? 'Completed' : r.STATUS === 'X' ? 'Cancelled' : r.STATUS,
      SUBMITTED_DATE: r.SUBMITTED_DATE,
      requestorName: r.requestor ? `${r.requestor.FIRST_NAME} ${r.requestor.LAST_NAME}` : r.requestorName || '',
      assignedTo: r.assigned ? `${r.assigned.FIRST_NAME} ${r.assigned.LAST_NAME}` : r.assignedName || 'Unassigned',
    }));
    navigate('/export/requests', {
      state: {
        data: exportData,
        metadata: {
          totalRecords: String(exportData.length),
          dateRange: exportData.length > 0 ? `${new Date(exportData[exportData.length - 1].SUBMITTED_DATE).toLocaleDateString()} - ${new Date(exportData[0].SUBMITTED_DATE).toLocaleDateString()}` : 'N/A',
          statusFilter: 'All',
          exportedBy: user?.fullName || user?.email || 'Unknown',
          company: user?.companyName || 'N/A',
          exportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        },
        identifier: 'all-requests',
      },
    });
  }}
>
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
  Export
</button>
```

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:5175/requests-dashboard`. Confirm the Export button appears in the toolbar next to Refresh. Click it and verify it navigates to the Export Page with request data populated.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RequestDashboard.tsx
git commit -m "feat: add Export button to Request Dashboard toolbar"
```

---

### Task 7: Wire Up TaskTable Export Navigation

**Files:**
- Modify: `src/components/TaskTable.tsx`

- [ ] **Step 1: Add useNavigate import**

In `src/components/TaskTable.tsx`, add `useNavigate` to the react-router-dom imports. Find the existing imports and add:

```typescript
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook**

Inside the `TaskTable` component function, add:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Replace the handleExport function**

In `src/components/TaskTable.tsx`, replace the existing `handleExport` function (lines 276-289) with:

```typescript
// Export tasks data - navigate to Export Page
const handleExport = () => {
  const exportData = tasks.map((task: any) => ({
    TASK_ID: task.TASK_ID,
    DESCRIPTION: task.DESCRIPTION,
    STATUS: task.STATUS,
    assignedUser: task.assignedUser?.FULL_NAME || task.assignedUser || 'Unassigned',
    CREATE_DATE: task.CREATE_DATE,
  }));
  const statusCounts = tasks.reduce((acc: Record<string, number>, t: any) => {
    acc[t.STATUS] = (acc[t.STATUS] || 0) + 1;
    return acc;
  }, {});
  navigate('/export/tasks', {
    state: {
      data: exportData,
      metadata: {
        requestId: `Request #${requestId}`,
        totalTasks: String(tasks.length),
        pendingCount: String(statusCounts['Pending'] || 0),
        inProgressCount: String(statusCounts['In Progress'] || 0),
        completedCount: String(statusCounts['Completed'] || 0),
        exportedBy: 'Current User',
      },
      identifier: `request-${requestId}-tasks`,
    },
  });
};
```

- [ ] **Step 4: Update the Export dropdown to a single button**

In `src/components/TaskTable.tsx`, find the Export dropdown JSX (around lines 600-614) and replace the entire `{/* Export dropdown */}` block with:

```typescript
{/* Export button */}
<Button variant="outline-primary" size="sm" onClick={handleExport}>
  <Download size={16} className="me-1" />
  Export
</Button>
```

- [ ] **Step 5: Verify in browser**

Navigate to a request with tasks, click the Tasks tab, and click Export. Verify it navigates to the Export Page with task data.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskTable.tsx
git commit -m "feat: replace TaskTable inline export with Export Page navigation"
```

---

### Task 8: Wire Up WorkProgressTable Export Navigation

**Files:**
- Modify: `src/components/WorkProgressTable.tsx`

- [ ] **Step 1: Add useNavigate import**

In `src/components/WorkProgressTable.tsx`, add:

```typescript
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook**

Inside the `WorkProgressTable` component function, add:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Replace the handleExport function**

In `src/components/WorkProgressTable.tsx`, replace the existing `handleExport` function (lines 289-302) with:

```typescript
// Export progress data - navigate to Export Page
const handleExport = () => {
  const exportData = progressEntries.map((entry: any) => ({
    PROGRESS_TYPE: entry.PROGRESS_TYPE,
    TITLE: entry.TITLE,
    DESCRIPTION: entry.DESCRIPTION,
    userName: entry.user?.FULL_NAME || '',
    CREATED_DATE: entry.CREATED_DATE,
    HOURS_WORKED: entry.HOURS_WORKED || 0,
    IS_VISIBLE_TO_REQUESTOR: entry.IS_VISIBLE_TO_REQUESTOR ? 'Yes' : 'No',
  }));
  const totalHours = progressEntries.reduce((sum: number, e: any) => sum + (e.HOURS_WORKED || 0), 0);
  navigate('/export/progress', {
    state: {
      data: exportData,
      metadata: {
        requestId: `Request #${requestId}`,
        totalEntries: String(progressEntries.length),
        totalHours: `${totalHours.toFixed(1)} hours`,
        exportedBy: 'Current User',
        exportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      },
      identifier: `request-${requestId}-progress`,
    },
  });
};
```

- [ ] **Step 4: Update the Export dropdown to a single button**

In `src/components/WorkProgressTable.tsx`, find the Export dropdown JSX (around lines 391-405) and replace the entire `{/* Export dropdown */}` block with:

```typescript
{/* Export button */}
<Button variant="outline-primary" size="sm" onClick={handleExport}>
  <Download size={16} className="me-1" />
  Export
</Button>
```

- [ ] **Step 5: Verify in browser**

Navigate to a request detail, go to the progress/results tab, click Export. Verify it navigates to the Export Page.

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkProgressTable.tsx
git commit -m "feat: replace WorkProgressTable inline export with Export Page navigation"
```

---

### Task 9: Wire Up AdminUserManagement Export Navigation

**Files:**
- Modify: `src/pages/AdminUserManagement.tsx`

- [ ] **Step 1: Add useNavigate import**

In `src/pages/AdminUserManagement.tsx`, add:

```typescript
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook**

Inside the `AdminUserManagement` component function, add:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Replace the handleExport function**

In `src/pages/AdminUserManagement.tsx`, replace the existing `handleExport` function (lines 562-602) with:

```typescript
// Export user data - navigate to Export Page
const handleExport = () => {
  const userData = users.map((user: any) => ({
    name: user.name || '',
    email: user.email || '',
    role: user.roles && Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles.map((role: any) => role.name || role.displayName || 'Unknown').join(', ')
      : 'No Role',
    status: user.status === 'A' ? 'Active' : user.status === 'S' ? 'Suspended' : 'Inactive',
    dateCreated: user.dateCreated && user.dateCreated !== 'Invalid Date'
      ? new Date(user.dateCreated).toLocaleDateString()
      : 'N/A',
    type: 'User',
    date: user.dateCreated && user.dateCreated !== 'Invalid Date'
      ? new Date(user.dateCreated).toLocaleDateString()
      : 'N/A',
  }));
  const inviteData = invites.map((invite: any) => ({
    name: invite.EMAIL || invite.email || '',
    email: invite.EMAIL || invite.email || '',
    role: (() => {
      const roleId = invite.ROLE_ID || invite.roleId;
      const role = roles.find((r: any) => r.id === roleId);
      return role ? (role.name || role.displayName || 'Unknown') : 'Unknown';
    })(),
    status: invite.status
      ? invite.status.charAt(0).toUpperCase() + invite.status.slice(1)
      : invite.STATUS === 'P' ? 'Pending' : invite.STATUS === 'A' ? 'Accepted' : 'Expired',
    dateSent: (invite.CREATED_AT || invite.createdAt)
      ? new Date(invite.CREATED_AT || invite.createdAt).toLocaleDateString()
      : 'N/A',
    expires: '',
    type: 'Invite',
    date: (invite.CREATED_AT || invite.createdAt)
      ? new Date(invite.CREATED_AT || invite.createdAt).toLocaleDateString()
      : 'N/A',
  }));
  navigate('/export/users', {
    state: {
      data: [...userData, ...inviteData],
      metadata: {
        company: 'Current Company',
        activeUsers: String(users.length),
        pendingInvites: String(invites.length),
        exportedBy: 'Current User',
        exportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      },
      identifier: 'user-management',
    },
  });
};
```

- [ ] **Step 4: Optionally remove the XLSX and file-saver imports if no longer used elsewhere**

Check if `XLSX` and `saveAs` are used elsewhere in the file. If not, remove:

```typescript
// Remove these imports if no longer needed:
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:5175/admin-user-management`. Click the "Export to Excel" button. Verify it navigates to the Export Page with user data.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminUserManagement.tsx
git commit -m "feat: replace AdminUserManagement inline export with Export Page navigation"
```

---

### Task 10: Add Export Button to Request Detail Modal

**Files:**
- Modify: `src/components/RequestModal.tsx`

- [ ] **Step 1: Add useNavigate import**

In `src/components/RequestModal.tsx`, add `useNavigate` to imports:

```typescript
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook**

Inside the `RequestModal` component function, add:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Add the handleFormExport function**

Add this function inside the component, after the existing handler functions:

```typescript
// Export form data - navigate to Export Page
const handleFormExport = () => {
  const formData = formFieldValues.map((fv: any) => ({
    fieldName: fv.fieldName || fv.FIELD_NAME || '',
    fieldValue: fv.fieldValue || fv.FIELD_VALUE || '',
    section: 'Form Data',
    required: 'N/A',
  }));
  onClose();
  navigate('/export/forms', {
    state: {
      data: formData,
      metadata: {
        formTemplate: formTemplate?.name || request.REQUEST_NAME || 'Form',
        requestId: request.TRACKINGID || `REQ-${request.REQUEST_ID}`,
        submittedBy: request.requestor
          ? `${request.requestor.FIRST_NAME} ${request.requestor.LAST_NAME}`
          : request.requestorName || 'Unknown',
        submissionDate: request.SUBMITTED_DATE
          ? new Date(request.SUBMITTED_DATE).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'N/A',
        status: request.STATUS || 'Unknown',
        assignedTo: request.assigned
          ? `${request.assigned.FIRST_NAME} ${request.assigned.LAST_NAME}`
          : request.assignedName || 'Unassigned',
      },
      title: `Export ${formTemplate?.name || 'Form'} Data`,
      identifier: request.TRACKINGID || `REQ-${request.REQUEST_ID}`,
    },
  });
};
```

- [ ] **Step 4: Add Export button to the modal header**

In `src/components/RequestModal.tsx`, find the modal header area where the request title and close button are rendered. Look for the close button (the `X` icon button). Add an Export button before the close button:

Find the pattern with the close/X button in the modal header and add before it:

```typescript
<button
  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
  onClick={handleFormExport}
  title="Export form data"
>
  <Download size={14} />
  Export
</button>
```

- [ ] **Step 5: Verify in browser**

Navigate to Request Dashboard, click View on a request. Verify the Export button appears in the modal header. Click it and verify it navigates to the Export Page with form field data.

- [ ] **Step 6: Commit**

```bash
git add src/components/RequestModal.tsx
git commit -m "feat: add Export button to Request Detail modal for form data export"
```

---

### Task 11: Verify All Entry Points with Playwright

**Files:**
- No file changes -- browser testing only

- [ ] **Step 1: Test Request Dashboard export**

1. Navigate to `http://localhost:5175/requests-dashboard`
2. Click the "Export" button in the toolbar
3. Verify the Export Page loads at `/export/requests`
4. Verify metadata grid shows correct record count
5. Verify all three format options are clickable
6. Verify Structured View shows request data
7. Click "Table View" tab -- verify table renders
8. Click "Raw Data" tab -- verify JSON renders
9. Click "Export Now" -- verify success modal appears
10. Click "Download File" -- verify CSV downloads
11. Click "Back" -- verify return to Request Dashboard

- [ ] **Step 2: Test Task export from request detail**

1. Navigate to `http://localhost:5175/requests-dashboard`
2. Click "View" on a request that has tasks
3. Click the "Tasks" tab
4. Click "Export" button
5. Verify navigation to `/export/tasks` with task data

- [ ] **Step 3: Test User Management export**

1. Navigate to `http://localhost:5175/admin-user-management`
2. Click "Export to Excel" button
3. Verify navigation to `/export/users` with user data
4. Select JSON format, click Export Now, download -- verify valid JSON

- [ ] **Step 4: Test Form Data export from request modal**

1. Navigate to `http://localhost:5175/requests-dashboard`
2. Click "View" on a request
3. Click "Export" button in modal header
4. Verify navigation to `/export/forms` with form field data
5. Select PDF format, click Export Now -- verify print dialog opens

- [ ] **Step 5: Test empty state**

Navigate directly to `http://localhost:5175/export/requests` (no state). Verify it redirects to home page.

- [ ] **Step 6: Test responsive layout**

Resize browser to 768px width. Verify format cards stack vertically, buttons go full-width, data rows become single-column.

- [ ] **Step 7: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: address issues found during Playwright export testing"
```
