// src/components/AuditLog/AuditLogFilters.tsx
//
// Phase 8 / US-CCL-04 — filter bar for the audit log page.
// Emits a filters object on every change.
import React from 'react';
import type { AuditFilters } from '../../services/auditService';

/**
 * Audit event type list — parallel to `AUDIT_EVENT_TYPES` exported by
 * server/lib/audit.ts. Keep this in sync; the frontend can't import
 * server modules directly from the bundler.
 */
export const AUDIT_EVENT_TYPES: readonly string[] = [
  'TEMPLATE_CREATED',
  'TEMPLATE_MODIFIED',
  'FIELD_RESTRICTION_CHANGED',
  'DISCLAIMER_TOGGLED',
  'MANAGER_APPROVAL_CONFIG_CHANGED',
  'NOTICE_SUBMITTED_FOR_APPROVAL',
  'NOTICE_APPROVED',
  'NOTICE_REJECTED',
  'NOTICE_SENT',
  'SUBPOENA_RIDER_GENERATED',
  'SUBPOENA_RECEIVED',
  'RECORDS_RELEASED',
  'FIRST_TIME_RECIPIENT_CONFIRMED',
  'JAFAR_FIELD_LOCKED',
  'JAFAR_DISCLAIMER_UPDATED',
  'JAFAR_FILE_TYPES_UPDATED',
];

/**
 * Role-ID to display label mapping (mirrors src/utils/permissions.ts).
 * Includes only the roles that actually appear as audit actors in MVP.
 */
const ACTOR_ROLES: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1, label: 'Admin' },
  { id: 3, label: 'Processor' },
  { id: 4, label: 'Manager' },
  { id: 5, label: 'External User' },
  { id: 6, label: 'Super Admin (JAFAR)' },
];

interface Props {
  value: AuditFilters;
  onChange: (next: AuditFilters) => void;
}

const AuditLogFilters: React.FC<Props> = ({ value, onChange }) => {
  const set = <K extends keyof AuditFilters>(key: K, v: AuditFilters[K]) => {
    onChange({ ...value, [key]: v, page: 1 });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={value.from ?? ''}
            onChange={(e) => set('from', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={value.to ?? ''}
            onChange={(e) => set('to', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
          <select
            value={value.eventType ?? ''}
            onChange={(e) => set('eventType', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All events</option>
            {AUDIT_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Actor Role</label>
          <select
            value={value.actorRoleId ?? ''}
            onChange={(e) =>
              set('actorRoleId', e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All roles</option>
            {ACTOR_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} (ID {r.id})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Actor User ID</label>
          <input
            type="number"
            value={value.actorUserId ?? ''}
            onChange={(e) =>
              set('actorUserId', e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="e.g. 42"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target ID</label>
          <input
            type="text"
            value={value.targetId ?? ''}
            onChange={(e) => set('targetId', e.target.value || undefined)}
            placeholder="NOTICE_ID, TEMPLATE_ID, ..."
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm font-mono"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange({ page: 1, pageSize: value.pageSize ?? 50 })}
          className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
};

export default AuditLogFilters;
