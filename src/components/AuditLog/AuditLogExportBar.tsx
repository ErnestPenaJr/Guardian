// src/components/AuditLog/AuditLogExportBar.tsx
//
// Phase 8 / US-CCL-04 — CSV + PDF export buttons for the audit log.
// Page-level gating ensures these buttons only render when the
// authenticated user has the audit.export permission key (roles 1, 6).
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import auditService, { type AuditFilters } from '../../services/auditService';

interface Props {
  filters: AuditFilters;
}

const AuditLogExportBar: React.FC<Props> = ({ filters }) => {
  const [busy, setBusy] = useState<null | 'csv' | 'pdf'>(null);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setBusy(format);
    try {
      if (format === 'csv') {
        await auditService.exportCsv(filters);
      } else {
        await auditService.exportPdf(filters);
      }
      toast.success(`Audit log ${format.toUpperCase()} downloaded.`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        `Failed to export audit log as ${format.toUpperCase()}`;
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void handleExport('csv')}
        disabled={busy !== null}
        className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
      </button>
      <button
        type="button"
        onClick={() => void handleExport('pdf')}
        disabled={busy !== null}
        className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {busy === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </button>
    </div>
  );
};

export default AuditLogExportBar;
