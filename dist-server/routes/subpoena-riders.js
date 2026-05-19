// server/routes/subpoena-riders.ts
//
// Phase 7 / US-SRB-02 — Subpoena rider generator.
//
// Mounted at /api/subpoena-riders.
//
// POST /api/subpoena-riders — Processor generates a rider from a fraud-type
//   template + Processor-supplied token values. Each token value is scanned
//   for PII and any hit blocks generation with a 400 and a precise field
//   pointer. The populated language is persisted to SUBPOENA_RIDERS.
//
// GET /api/subpoena-riders/:id — fetch a rider by id (company-scoped).
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { scanForPII } from '../lib/piiGuard.js';
import { writeAudit } from '../lib/audit.js';
const router = Router();
const prisma = new PrismaClient();
const FraudType = z.enum(['SECURITIES_MANIPULATION', 'ATO', 'CHECK_FRAUD', 'WIRE_FRAUD']);
const Payload = z.object({
    fraudType: FraudType,
    incidentNoticeId: z.number().int().optional(),
    tokenValues: z.record(z.string()),
});
function actorIds(req) {
    const u = req.user ?? {};
    const userId = Number(u.id ?? u.userId);
    const companyId = u.COMPANY_ID ?? null;
    const actorRoleId = req.actorRoleId ?? null;
    return { userId, companyId, actorRoleId };
}
router.post('/', requireAuth, requireRole('subpoenaRider.generate', 'generate subpoena riders'), async (req, res) => {
    try {
        const parsed = Payload.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
        }
        const p = parsed.data;
        const { userId, companyId, actorRoleId } = actorIds(req);
        if (!companyId)
            return res.status(403).json({ error: 'Missing company context' });
        const tmpl = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.findUnique({
            where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: p.fraudType } },
        });
        if (!tmpl) {
            return res.status(404).json({
                error: 'No subpoena template is configured for this fraud type. Contact your User Admin to create one.',
            });
        }
        // PII scan on each token value (Processor-supplied)
        for (const [k, v] of Object.entries(p.tokenValues)) {
            const r = scanForPII(String(v));
            if (r.hit) {
                return res.status(400).json({
                    error: 'PII is not permitted in subpoena rider language. Remove the detected value before proceeding.',
                    field: k,
                    label: r.label,
                });
            }
        }
        let populated = tmpl.BASE_LANGUAGE;
        for (const [k, v] of Object.entries(p.tokenValues)) {
            populated = populated.split(`[${k}]`).join(String(v));
        }
        const rider = await prisma.sUBPOENA_RIDERS.create({
            data: {
                LANGUAGE_TEMPLATE_ID: tmpl.LANGUAGE_TEMPLATE_ID,
                FRAUD_TYPE: p.fraudType,
                POPULATED_LANGUAGE: populated,
                TOKEN_VALUES_JSON: JSON.stringify(p.tokenValues),
                INCIDENT_NOTICE_ID: p.incidentNoticeId ?? null,
                CREATED_BY: userId,
                COMPANY_ID: companyId,
            },
        });
        await writeAudit({
            eventType: 'SUBPOENA_RIDER_GENERATED',
            actorUserId: userId,
            actorRoleId,
            targetType: 'SUBPOENA_RIDER',
            targetId: rider.RIDER_ID,
            companyId,
            detail: {
                fraudType: p.fraudType,
                incidentNoticeId: p.incidentNoticeId ?? null,
                templateId: tmpl.LANGUAGE_TEMPLATE_ID,
            },
        });
        return res.status(201).json({ rider });
    }
    catch (err) {
        console.error('[subpoena-riders POST /]', err);
        return res.status(500).json({ error: 'Failed to generate subpoena rider' });
    }
});
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid rider id' });
        const { companyId } = actorIds(req);
        if (!companyId)
            return res.status(403).json({ error: 'Missing company context' });
        const r = await prisma.sUBPOENA_RIDERS.findUnique({ where: { RIDER_ID: id } });
        if (!r || r.COMPANY_ID !== companyId)
            return res.status(404).json({ error: 'Not found' });
        return res.json({ rider: r });
    }
    catch (err) {
        console.error('[subpoena-riders GET /:id]', err);
        return res.status(500).json({ error: 'Failed to load subpoena rider' });
    }
});
export default router;
