// src/utils/exportUtils.ts

import { ExportTypeConfig, ExportSection } from '../config/exportConfig';

export interface ExportData {
  type: string;
  data: Record<string, any>[];
  metadata: Record<string, string>;
  title?: string;
  identifier?: string;
  dynamicSections?: ExportSection[];
}

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

function getNestedValue(obj: Record<string, any>, key: string): any {
  return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  return String(value);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

export function generateCSV(
  exportData: ExportData,
  config: ExportTypeConfig,
): string {
  const sections = exportData.dynamicSections || config.sections;
  const lines: string[] = [];

  lines.push(escapeCSV(`${config.pageTitle}`));
  lines.push(`${escapeCSV('Export Date')},${escapeCSV(new Date().toISOString())}`);
  Object.entries(exportData.metadata).forEach(([key, value]) => {
    lines.push(`${escapeCSV(key)},${escapeCSV(value)}`);
  });
  lines.push('');

  if (sections.length > 0) {
    sections.forEach((section) => {
      lines.push(escapeCSV(section.title.toUpperCase()));
      const headerRow = section.fields.map((f) => escapeCSV(f.label)).join(',');
      lines.push(headerRow);

      exportData.data.forEach((row) => {
        const dataRow = section.fields
          .map((f) => escapeCSV(formatFieldValue(getNestedValue(row, f.key))))
          .join(',');
        lines.push(dataRow);
      });
      lines.push('');
    });
  } else {
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

export function triggerPDFExport(): void {
  window.print();
}

export function getExportFilename(
  type: string,
  identifier: string | undefined,
  format: 'csv' | 'json' | 'pdf',
): string {
  const date = new Date().toISOString().split('T')[0];
  const prefix = identifier || type;
  return `${prefix}_${type}_${date}.${format}`;
}

export function estimateFileSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
