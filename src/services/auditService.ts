// src/services/auditService.ts
//
// Phase 8 / US-CCL-04 — frontend client for the audit log API.
//
// list()       → GET /api/audit (paginated, filterable). Server gates by
//                audit.viewFull (admins) or audit.viewScoped (manager, same
//                company in MVP).
// exportCsv()  → GET /api/audit/export?format=csv     (Blob download)
// exportPdf()  → GET /api/audit/export?format=pdf     (Blob download)
//
// Style mirrors src/services/platformAdminService.ts; download semantics
// mirror src/services/mynotices.ts → downloadCSVDashboard.
import api from '../utils/api';

export interface AuditEntry {
  ENTRY_ID: string;
  EVENT_TYPE: string;
  ACTOR_USER_ID: number | null;
  ACTOR_ROLE_ID: number | null;
  TARGET_TYPE: string;
  TARGET_ID: string | null;
  EVENT_DETAIL: string | null;
  COMPANY_ID: number | null;
  FIRST_TIME_FLAG: boolean | null;
  DISCLAIMER_STATE: boolean | null;
  CREATED_AT: string;
}

export interface AuditListResponse {
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  eventType?: string;
  actorRoleId?: number;
  actorUserId?: number;
  targetId?: string;
  page?: number;
  pageSize?: number;
}

function buildParams(f: AuditFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.eventType) out.eventType = f.eventType;
  if (typeof f.actorRoleId === 'number') out.actorRoleId = String(f.actorRoleId);
  if (typeof f.actorUserId === 'number') out.actorUserId = String(f.actorUserId);
  if (f.targetId) out.targetId = f.targetId;
  if (f.page) out.page = String(f.page);
  if (f.pageSize) out.pageSize = String(f.pageSize);
  return out;
}

async function downloadBlob(url: string, params: Record<string, string>, filename: string) {
  const res = await api.get(url, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([res.data]);
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}

const auditService = {
  list: (filters: AuditFilters = {}) =>
    api.get<AuditListResponse>('/api/audit', { params: buildParams(filters) }),

  exportCsv: (filters: AuditFilters = {}) =>
    downloadBlob('/api/audit/export', { ...buildParams(filters), format: 'csv' }, 'audit-log.csv'),

  exportPdf: (filters: AuditFilters = {}) =>
    downloadBlob('/api/audit/export', { ...buildParams(filters), format: 'pdf' }, 'audit-log.pdf'),
};

export default auditService;
