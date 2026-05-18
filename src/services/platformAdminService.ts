// src/services/platformAdminService.ts
//
// Thin client wrapper around the JAFAR platform-config endpoints
// (PUT /api/platform/disclaimer, PUT /api/platform/fields/:name/lock,
//  PUT /api/platform/file-types, GET /api/platform/audit).
import api from '../utils/api';

export interface PlatformAuditEntry {
  ENTRY_ID: string | number;
  EVENT_TYPE: string;
  ACTOR_USER_ID: number | null;
  ACTOR_ROLE_ID: number | null;
  TARGET_TYPE: string;
  TARGET_ID: string | null;
  EVENT_DETAIL: string | null;
  COMPANY_ID: number | null;
  CREATED_AT: string;
}

const platformAdminService = {
  setDisclaimer: (text: string) => api.put('/api/platform/disclaimer', { text }),
  setFieldLock: (name: string, locked: boolean) =>
    api.put(`/api/platform/fields/${encodeURIComponent(name)}/lock`, { locked }),
  setFileTypes: (types: string[]) => api.put('/api/platform/file-types', { types }),
  getAudit: () => api.get<{ entries: PlatformAuditEntry[] }>('/api/platform/audit'),
};

export default platformAdminService;
