// src/services/subpoenaRiderService.ts
//
// Phase 7 / US-SRB-02 — Subpoena rider service. Thin wrappers around
// /api/templates/subpoena and /api/subpoena-riders.
import api from '../utils/api';

export type FraudType = 'SECURITIES_MANIPULATION' | 'ATO' | 'CHECK_FRAUD' | 'WIRE_FRAUD';

export interface SubpoenaTokenSpec {
  token: string;
  description: string;
  autoPopulateFromIncident: boolean;
}

export interface SubpoenaTemplate {
  LANGUAGE_TEMPLATE_ID: number;
  FRAUD_TYPE: FraudType;
  BASE_LANGUAGE: string;
  TOKENS_JSON: string;
}

export interface SubpoenaRider {
  RIDER_ID: number;
  LANGUAGE_TEMPLATE_ID: number;
  FRAUD_TYPE: FraudType;
  POPULATED_LANGUAGE: string;
  TOKEN_VALUES_JSON: string;
  INCIDENT_NOTICE_ID: number | null;
  CREATED_BY: number;
  COMPANY_ID: number;
  CREATED_AT: string;
}

export interface GenerateRiderPayload {
  fraudType: FraudType;
  incidentNoticeId?: number;
  tokenValues: Record<string, string>;
}

export const subpoenaRiderService = {
  /** Fetch the configured subpoena language template for a fraud type. */
  getTemplate: (fraudType: FraudType) =>
    api.get<{ template: SubpoenaTemplate }>(`/api/templates/subpoena/${fraudType}`),

  /** Generate a subpoena rider from the configured template + token values. */
  generateRider: (payload: GenerateRiderPayload) =>
    api.post<{ rider: SubpoenaRider }>('/api/subpoena-riders', payload),

  /** Fetch a previously-generated rider by id. */
  getRider: (id: number) =>
    api.get<{ rider: SubpoenaRider }>(`/api/subpoena-riders/${id}`),

  /** List all riders attached to a given incident notice. */
  listByNotice: (incidentNoticeId: number) =>
    api.get<{ riders: SubpoenaRider[] }>(`/api/subpoena-riders`, {
      params: { incidentNoticeId },
    }),
};

export default subpoenaRiderService;
