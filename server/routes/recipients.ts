/**
 * Phase 6 / US-CCL-03 — Recipient Verification status endpoint.
 *
 * GET /api/recipients/:id/verification
 *   Returns the verification record for a recipient user within the caller's
 *   company. When no row exists yet we default to FIRST_TIME so the send flow
 *   and RecipientPicker UI can render the amber "First-Time Recipient" badge
 *   without an extra round-trip.
 *
 * The upgrade to PREVIOUSLY_VERIFIED is wired in server/routes/my-notices.ts
 * when a response row is inserted (acknowledgement). See Phase 6 plan.
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/:id/verification', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid recipient id' });
  }
  const companyId = (req.user as any).COMPANY_ID;
  if (!companyId) {
    return res.status(403).json({ error: 'Missing company context' });
  }
  try {
    const v = await prisma.rECIPIENT_VERIFICATIONS.findUnique({
      where: {
        RECIPIENT_USER_ID_COMPANY_ID: {
          RECIPIENT_USER_ID: id,
          COMPANY_ID: companyId,
        },
      },
    });
    res.json({
      verifiedStatus: v?.VERIFIED_STATUS ?? 'FIRST_TIME',
      verifiedAt: v?.VERIFIED_AT ?? null,
    });
  } catch (err) {
    console.error('[recipients/verification] failed:', err);
    res.status(500).json({ error: 'Failed to load recipient verification' });
  }
});

export default router;
