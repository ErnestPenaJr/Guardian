// src/components/AuditLog/AuditLogTable.tsx
//
// Phase 8 / US-CCL-04 — paginated audit log table with expandable
// detail JSON rows. Uses a plain HTML table (AG Grid would be overkill
// for the columns the spec calls for, and keeps the bundle slim).
import React, { useState } from 'react';
import type { AuditEntry } from '../../services/auditService';

interface Props {
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (next: number) => void;
}

/** Pretty-print EVENT_DETAIL JSON if possible; otherwise return the raw string. */
function formatDetail(detail: string | null): string {
  if (!detail) return '';
  try {
    const parsed = JSON.parse(detail);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return detail;
  }
}

const AuditLogTable: React.FC<Props> = ({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 font-semibold whitespace-nowrap">Timestamp</th>
              <th className="px-3 py-2 font-semibold">Event Type</th>
              <th className="px-3 py-2 font-semibold">Actor</th>
              <th className="px-3 py-2 font-semibold">Target</th>
              <th className="px-3 py-2 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400 italic">
                  No audit entries match the current filters.
                </td>
              </tr>
            )}
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isOpen = expanded.has(r.ENTRY_ID);
              const detailPretty = formatDetail(r.EVENT_DETAIL);
              const detailPreview =
                r.EVENT_DETAIL && r.EVENT_DETAIL.length > 80
                  ? r.EVENT_DETAIL.slice(0, 80) + '…'
                  : (r.EVENT_DETAIL ?? '—');
              return (
                <React.Fragment key={r.ENTRY_ID}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => toggleRow(r.ENTRY_ID)}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                        aria-label={isOpen ? 'Collapse detail' : 'Expand detail'}
                      >
                        {isOpen ? '▾' : '▸'}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 align-top">
                      {new Date(r.CREATED_AT).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs align-top">{r.EVENT_TYPE}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-xs">
                        {r.ACTOR_USER_ID ?? '—'}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        role {r.ACTOR_ROLE_ID ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs align-top">
                      <div>{r.TARGET_TYPE}</div>
                      <div className="text-gray-500">{r.TARGET_ID ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 align-top max-w-md truncate">
                      {detailPreview}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td />
                      <td colSpan={5} className="px-3 py-3">
                        <pre className="text-xs whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded p-2 max-h-72 overflow-auto">
                          {detailPretty || '(no detail)'}
                        </pre>
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="mr-3">ENTRY_ID: {r.ENTRY_ID}</span>
                          {r.FIRST_TIME_FLAG !== null && (
                            <span className="mr-3">
                              FIRST_TIME_FLAG: {String(r.FIRST_TIME_FLAG)}
                            </span>
                          )}
                          {r.DISCLAIMER_STATE !== null && (
                            <span>DISCLAIMER_STATE: {String(r.DISCLAIMER_STATE)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
        <div>
          Showing <strong>{rows.length}</strong> of <strong>{total}</strong> entries
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogTable;
