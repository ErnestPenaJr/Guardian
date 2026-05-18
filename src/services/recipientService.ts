/**
 * Phase 6 / US-CCL-03 — Recipient verification service.
 *
 * Thin wrapper around GET /api/recipients/:id/verification. The endpoint
 * defaults to FIRST_TIME when no row exists for the (recipient, company)
 * pair, so callers can treat any 200 as a definitive status read.
 */
import api from '../utils/api';

export type VerifiedStatus = 'FIRST_TIME' | 'PREVIOUSLY_VERIFIED';

export interface RecipientVerification {
  verifiedStatus: VerifiedStatus;
  verifiedAt: string | null;
}

export const recipientService = {
  getVerification: (id: number) =>
    api.get<RecipientVerification>(`/api/recipients/${id}/verification`),
};

export default recipientService;
