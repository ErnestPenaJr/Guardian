// src/pages/AuditLog.tsx
//
// Phase 8 / US-CCL-04 — Audit Log page.
//
// Composes filters + paginated table + export bar. Gated server-side
// (server/routes/audit.ts → 403 for non-admin/manager) and client-side
// (can(user, 'audit.viewFull') || can(user, 'audit.viewScoped')); users
// without either permission key are bounced to /home.
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';
import auditService, {
  type AuditEntry,
  type AuditFilters,
} from '../services/auditService';
import AuditLogFilters from '../components/AuditLog/AuditLogFilters';
import AuditLogTable from '../components/AuditLog/AuditLogTable';
import AuditLogExportBar from '../components/AuditLog/AuditLogExportBar';

const DEFAULT_PAGE_SIZE = 50;

const AuditLogPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AuditFilters>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await auditService.list(filters);
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Failed to load audit log';
      setError(message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (authLoading) return;
    // Skip fetch if the user isn't permitted — the Navigate redirect below
    // will fire before this effect's data is ever displayed.
    if (!can(user, 'audit.viewFull') && !can(user, 'audit.viewScoped')) return;
    void fetchRows();
  }, [authLoading, user, fetchRows]);

  if (authLoading) return null;
  if (!can(user, 'audit.viewFull') && !can(user, 'audit.viewScoped')) {
    return <Navigate to="/home" replace />;
  }

  const canExport = can(user, 'audit.export');

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compliance audit trail for templates, notices, subpoena riders, and platform
            configuration changes. Filters and pagination apply to the table below.
          </p>
        </div>
        {canExport && <AuditLogExportBar filters={filters} />}
      </div>

      <AuditLogFilters value={filters} onChange={setFilters} />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <AuditLogTable
        rows={rows}
        total={total}
        page={filters.page ?? 1}
        pageSize={filters.pageSize ?? DEFAULT_PAGE_SIZE}
        loading={loading}
        onPageChange={(next) => setFilters((f) => ({ ...f, page: next }))}
      />
    </div>
  );
};

export default AuditLogPage;
