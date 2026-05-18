// server/routes/securities-notices.ts
//
// Phase 5 — Securities Fraud Notice workflow endpoints (US-SNT-03..06).
//
// Endpoints
//   POST   /                       — processor direct send (no approval)
//   PUT    /:id/submit             — processor submit for manager approval
//   PUT    /:id/approve            — manager approve + send
//   PUT    /:id/reject             — manager reject with required reason
//   PUT    /:id/records-released   — processor / manager mark records released
//   GET    /                       — list scoped by role
//   GET    /:id                    — fetch one (read-only payload for users)
//
// All mutating endpoints enforce role gating via requireRole(), audit-log
// every state transition via writeAudit(), and respect company-based data
// isolation through the COMPANY_ID column.

import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { writeAudit } from '../lib/audit.js';
import { forbid } from '../lib/forbid.js';
import {
  notifyManagersOfPending,
  notifyProcessorOfRejection,
} from '../lib/securitiesNoticeMail.js';

const router = Router();
const prisma = new PrismaClient();

// ---------- Schemas ----------

const PayloadSchema = z.object({
  templateFormId: z.number().int(),
  fields: z.record(z.unknown()),
  recipientUserId: z.number().int(),
  confirmFirstTime: z.boolean().optional(),
});

const RejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const RecordsReleasedSchema = z.object({
  releaseDate: z.string().optional(),
  notes: z.string().optional(),
});

// ---------- Helpers ----------

function actorIds(req: any): { userId: number; companyId: number | null; actorRoleId: number | null } {
  const u = req.user as { id?: number; userId?: number; COMPANY_ID?: number | null };
  return {
    userId: Number(u?.id ?? u?.userId),
    companyId: u?.COMPANY_ID ?? null,
    actorRoleId: (req as any).actorRoleId ?? null,
  };
}

function buildTitle(format: string | null | undefined, fields: Record<string, unknown>): string {
  const fmt = format && format.length > 0 ? format : '[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]';
  return fmt
    .replace(/\[SECURITY_SYMBOL\]/g, String(fields.SECURITY_SYMBOL ?? ''))
    .replace(/\[LOSS_EXPOSURE\]/g, String(fields.LOSS_EXPOSURE ?? ''));
}

// ---------- POST / — Processor direct send (US-SNT-03) ----------

router.post(
  '/',
  requireAuth,
  requireRole('securitiesNotice.send', 'send a securities notice'),
  async (req, res) => {
    try {
      const payload = PayloadSchema.parse(req.body);
      const { userId, companyId, actorRoleId } = actorIds(req);

      if (!companyId) {
        return res.status(400).json({ error: 'User is not associated with a company.' });
      }

      const template = await prisma.fORMS.findUnique({
        where: { FORM_ID: payload.templateFormId },
      });
      if (!template || template.COMPANY_ID !== companyId) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // SECURITY_SYMBOL required (server-side enforcement)
      const symbol = (payload.fields as Record<string, unknown>).SECURITY_SYMBOL;
      if (!symbol || String(symbol).trim().length === 0) {
        return res.status(400).json({
          error:
            'Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.',
        });
      }

      // Approval-required templates take the /submit path
      if (template.REQUIRES_MANAGER_APPROVAL) {
        return forbid(
          res,
          'send a notice that requires manager approval — submit it for approval instead',
        );
      }

      // Recipient verification check
      const verification = await prisma.rECIPIENT_VERIFICATIONS.findUnique({
        where: {
          RECIPIENT_USER_ID_COMPANY_ID: {
            RECIPIENT_USER_ID: payload.recipientUserId,
            COMPANY_ID: companyId,
          },
        },
      });
      const isFirstTime = !verification || verification.VERIFIED_STATUS === 'FIRST_TIME';
      if (isFirstTime && !payload.confirmFirstTime) {
        return res.status(409).json({ requiresFirstTimeConfirmation: true });
      }

      const title = buildTitle(template.TITLE_FORMAT, payload.fields as Record<string, unknown>);

      const notice = await prisma.mY_NOTICES.create({
        data: {
          NOTICE_TITLE: title,
          NOTICE_BODY: JSON.stringify(payload.fields),
          SENSITIVITY_CLASSIFICATION: 'CONFIDENTIAL',
          BUTTON_STATUS: 'SENT',
          DISTRIBUTION_TYPE: 'DIRECT',
          TEMPLATE_FORM_ID: payload.templateFormId,
          NOTICE_STATUS: 'SENT_AWAITING_RESPONSE',
          SENT_AT: new Date(),
          DISCLAIMER_STATE: template.COMPLIANCE_DISCLAIMER_ENABLED,
          FIRST_TIME_RECIPIENT_FLAG: isFirstTime,
          COMPANY_ID: companyId,
          CREATE_USER_ID: userId,
          RECIPIENTS: { create: [{ USER_ID: payload.recipientUserId }] },
        },
      });

      if (isFirstTime) {
        await writeAudit({
          eventType: 'FIRST_TIME_RECIPIENT_CONFIRMED',
          actorUserId: userId,
          actorRoleId,
          targetType: 'NOTICE',
          targetId: notice.NOTICE_ID,
          companyId,
          firstTimeFlag: true,
          detail: { recipientUserId: payload.recipientUserId },
        });
      }
      await writeAudit({
        eventType: 'NOTICE_SENT',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: notice.NOTICE_ID,
        companyId,
        firstTimeFlag: isFirstTime,
        disclaimerState: template.COMPLIANCE_DISCLAIMER_ENABLED,
        detail: {
          templateFormId: payload.templateFormId,
          recipientUserId: payload.recipientUserId,
        },
      });

      return res.status(201).json({ notice });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid payload', details: err.errors });
      }
      console.error('[SECURITIES-NOTICES POST /]', err);
      return res.status(500).json({ error: 'Failed to send notice' });
    }
  },
);

// ---------- PUT /:id/submit — Submit for manager approval (US-SNT-04) ----------

router.put(
  '/:id/submit',
  requireAuth,
  requireRole('securitiesNotice.submit', 'submit a notice for approval'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notice id' });
      const { userId, companyId, actorRoleId } = actorIds(req);

      const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
      if (!notice || notice.COMPANY_ID !== companyId) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      if (notice.NOTICE_STATUS !== 'DRAFT' && notice.NOTICE_STATUS !== 'RETURNED_FOR_REVISION') {
        return res
          .status(409)
          .json({ error: `Cannot submit notice in status ${notice.NOTICE_STATUS}` });
      }

      await prisma.mY_NOTICES.update({
        where: { NOTICE_ID: id },
        data: {
          NOTICE_STATUS: 'PENDING_APPROVAL',
          SUBMITTED_BY: userId,
          SUBMITTED_AT: new Date(),
        },
      });

      await writeAudit({
        eventType: 'NOTICE_SUBMITTED_FOR_APPROVAL',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: id,
        companyId,
        detail: { processorId: userId },
      });

      // Notify managers (non-blocking).
      const processor = await prisma.uSERS.findUnique({
        where: { USER_ID: userId },
        select: { FIRST_NAME: true, LAST_NAME: true, EMAIL: true },
      });
      const processorName =
        [processor?.FIRST_NAME, processor?.LAST_NAME].filter(Boolean).join(' ') ||
        processor?.EMAIL ||
        `User #${userId}`;
      if (companyId != null) {
        // Fire-and-forget; we already responded? No — we await to keep audit
        // ordering predictable, but failures are swallowed inside the helper.
        await notifyManagersOfPending(companyId, id, processorName);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[SECURITIES-NOTICES PUT /:id/submit]', err);
      return res.status(500).json({ error: 'Failed to submit notice' });
    }
  },
);

// ---------- PUT /:id/approve — Manager approve + send (US-SNT-05) ----------

router.put(
  '/:id/approve',
  requireAuth,
  requireRole('securitiesNotice.approve', 'approve notices'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notice id' });
      const { userId, companyId, actorRoleId } = actorIds(req);

      const notice = await prisma.mY_NOTICES.findUnique({
        where: { NOTICE_ID: id },
        include: { RECIPIENTS: true },
      });
      if (!notice || notice.COMPANY_ID !== companyId) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      if (notice.NOTICE_STATUS !== 'PENDING_APPROVAL') {
        return res.status(409).json({ error: 'Notice is not pending approval' });
      }

      const now = new Date();
      await prisma.mY_NOTICES.update({
        where: { NOTICE_ID: id },
        data: {
          NOTICE_STATUS: 'SENT_AWAITING_RESPONSE',
          APPROVED_BY: userId,
          APPROVED_AT: now,
          SENT_AT: now,
        },
      });

      await writeAudit({
        eventType: 'NOTICE_APPROVED',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: id,
        companyId,
        disclaimerState: notice.DISCLAIMER_STATE ?? undefined,
        detail: { managerId: userId },
      });
      await writeAudit({
        eventType: 'NOTICE_SENT',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: id,
        companyId,
        disclaimerState: notice.DISCLAIMER_STATE ?? undefined,
        firstTimeFlag: notice.FIRST_TIME_RECIPIENT_FLAG ?? undefined,
        detail: { sentByManager: true },
      });

      // Transmit hook — left to Phase 6 once recipient email is wired through
      // the same Resend pipeline used by my-notices. The audit row above is
      // authoritative for "this notice was sent" until then.

      return res.json({ ok: true });
    } catch (err) {
      console.error('[SECURITIES-NOTICES PUT /:id/approve]', err);
      return res.status(500).json({ error: 'Failed to approve notice' });
    }
  },
);

// ---------- PUT /:id/reject — Manager reject (US-SNT-05) ----------

router.put(
  '/:id/reject',
  requireAuth,
  requireRole('securitiesNotice.approve', 'reject notices'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notice id' });
      const parsed = RejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid payload' });
      }
      const { reason } = parsed.data;
      const { userId, companyId, actorRoleId } = actorIds(req);

      const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
      if (!notice || notice.COMPANY_ID !== companyId) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      if (notice.NOTICE_STATUS !== 'PENDING_APPROVAL') {
        return res.status(409).json({ error: 'Notice is not pending approval' });
      }

      await prisma.mY_NOTICES.update({
        where: { NOTICE_ID: id },
        data: {
          NOTICE_STATUS: 'RETURNED_FOR_REVISION',
          REJECTED_BY: userId,
          REJECTED_AT: new Date(),
          REJECTION_REASON: reason,
        },
      });

      await writeAudit({
        eventType: 'NOTICE_REJECTED',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: id,
        companyId,
        detail: { rejectionReason: reason },
      });

      if (notice.SUBMITTED_BY != null) {
        await notifyProcessorOfRejection(notice.SUBMITTED_BY, id, reason);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[SECURITIES-NOTICES PUT /:id/reject]', err);
      return res.status(500).json({ error: 'Failed to reject notice' });
    }
  },
);

// ---------- PUT /:id/records-released — Mark records released (US-SNT-06 / US-SRB) ----------

router.put(
  '/:id/records-released',
  requireAuth,
  requireRole('securitiesNotice.markRecordsReleased', 'mark records released'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notice id' });
      const parsed = RecordsReleasedSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
      }
      const { userId, companyId, actorRoleId } = actorIds(req);

      const notice = await prisma.mY_NOTICES.findUnique({ where: { NOTICE_ID: id } });
      if (!notice || notice.COMPANY_ID !== companyId) {
        return res.status(404).json({ error: 'Notice not found' });
      }
      if (notice.NOTICE_STATUS !== 'SENT_AWAITING_RESPONSE') {
        return res.status(409).json({
          error: `Notice in status ${notice.NOTICE_STATUS} cannot be marked records-released`,
        });
      }

      await prisma.mY_NOTICES.update({
        where: { NOTICE_ID: id },
        data: { NOTICE_STATUS: 'RECORDS_RELEASED' },
      });

      await writeAudit({
        eventType: 'RECORDS_RELEASED',
        actorUserId: userId,
        actorRoleId,
        targetType: 'NOTICE',
        targetId: id,
        companyId,
        detail: parsed.data,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[SECURITIES-NOTICES PUT /:id/records-released]', err);
      return res.status(500).json({ error: 'Failed to mark records released' });
    }
  },
);

// ---------- GET / — List scoped by role (US-SNT-06) ----------

router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId, companyId } = actorIds(req);
    if (!companyId) return res.json({ notices: [] });

    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId, STATUS: 'P' },
      select: { ROLE_ID: true },
    });
    const isGeneralUserOnly =
      userRoles.length === 1 && userRoles[0].ROLE_ID === 2; // GENERAL_USER only

    const where = isGeneralUserOnly
      ? { COMPANY_ID: companyId, RECIPIENTS: { some: { USER_ID: userId } } }
      : { COMPANY_ID: companyId };

    const notices = await prisma.mY_NOTICES.findMany({
      where,
      orderBy: { CREATE_DATE: 'desc' },
      include: { RECIPIENTS: true },
    });

    return res.json({ notices });
  } catch (err) {
    console.error('[SECURITIES-NOTICES GET /]', err);
    return res.status(500).json({ error: 'Failed to list notices' });
  }
});

// ---------- GET /:id — Read one (US-SNT-06) ----------

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notice id' });
    const { userId, companyId } = actorIds(req);

    const notice = await prisma.mY_NOTICES.findUnique({
      where: { NOTICE_ID: id },
      include: { RECIPIENTS: true, RESPONSES: true },
    });
    if (!notice || notice.COMPANY_ID !== companyId) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId, STATUS: 'P' },
      select: { ROLE_ID: true },
    });
    const isGeneralUserOnly =
      userRoles.length === 1 && userRoles[0].ROLE_ID === 2;
    if (isGeneralUserOnly) {
      const isRecipient = notice.RECIPIENTS.some((r) => r.USER_ID === userId);
      if (!isRecipient) return res.status(404).json({ error: 'Notice not found' });
      return res.json({ notice, readOnly: true });
    }

    return res.json({ notice, readOnly: false });
  } catch (err) {
    console.error('[SECURITIES-NOTICES GET /:id]', err);
    return res.status(500).json({ error: 'Failed to fetch notice' });
  }
});

export default router;
