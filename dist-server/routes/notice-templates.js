// server/routes/notice-templates.ts
//
// Phase 7 / US-SRB-01 — Subpoena language template builder API.
//
// Mounted at /api/templates.
//
// POST /api/templates/subpoena — User Admin creates/updates a per-company,
//   per-fraud-type subpoena language template. The free-text BASE_LANGUAGE
//   is scanned for PII; any hit blocks the save with a 400 + actionable
//   error message.
//
// GET /api/templates/subpoena/:fraudType — fetch the template for the
//   caller's company. 404 when none configured.
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
const SubpoenaSchema = z.object({
    FRAUD_TYPE: FraudType,
    BASE_LANGUAGE: z.string().min(1, 'Base language is required'),
    TOKENS: z.array(z.object({
        token: z.string().min(1),
        description: z.string().default(''),
        autoPopulateFromIncident: z.boolean().default(false),
    })),
});
function actorIds(req) {
    const u = req.user ?? {};
    const userId = Number(u.id ?? u.userId);
    const companyId = u.COMPANY_ID ?? null;
    const actorRoleId = req.actorRoleId ?? null;
    return { userId, companyId, actorRoleId };
}
router.post('/subpoena', requireAuth, requireRole('subpoenaRider.configureLanguage', 'configure subpoena language templates'), async (req, res) => {
    try {
        const parsed = SubpoenaSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
        }
        const payload = parsed.data;
        const { userId, companyId, actorRoleId } = actorIds(req);
        if (!companyId)
            return res.status(403).json({ error: 'Missing company context' });
        const pii = scanForPII(payload.BASE_LANGUAGE);
        if (pii.hit) {
            return res.status(400).json({
                error: `PII tokens are not permitted in subpoena language templates. Remove ${pii.label} before saving.`,
                label: pii.label,
            });
        }
        const row = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.upsert({
            where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: payload.FRAUD_TYPE } },
            update: {
                BASE_LANGUAGE: payload.BASE_LANGUAGE,
                TOKENS_JSON: JSON.stringify(payload.TOKENS),
                UPDATED_AT: new Date(),
            },
            create: {
                COMPANY_ID: companyId,
                FRAUD_TYPE: payload.FRAUD_TYPE,
                BASE_LANGUAGE: payload.BASE_LANGUAGE,
                TOKENS_JSON: JSON.stringify(payload.TOKENS),
                CREATED_BY: userId,
            },
        });
        await writeAudit({
            eventType: 'TEMPLATE_CREATED',
            actorUserId: userId,
            actorRoleId,
            targetType: 'TEMPLATE',
            targetId: row.LANGUAGE_TEMPLATE_ID,
            companyId,
            detail: { templateType: 'SUBPOENA_RIDER', fraudType: payload.FRAUD_TYPE },
        });
        return res.status(201).json({ template: row });
    }
    catch (err) {
        console.error('[notice-templates POST /subpoena]', err);
        return res.status(500).json({ error: 'Failed to save subpoena language template' });
    }
});
router.get('/subpoena/:fraudType', requireAuth, async (req, res) => {
    try {
        const fraudParsed = FraudType.safeParse(req.params.fraudType);
        if (!fraudParsed.success) {
            return res.status(400).json({ error: 'Invalid fraud type' });
        }
        const fraudType = fraudParsed.data;
        const { companyId } = actorIds(req);
        if (!companyId)
            return res.status(403).json({ error: 'Missing company context' });
        const t = await prisma.sUBPOENA_LANGUAGE_TEMPLATES.findUnique({
            where: { COMPANY_ID_FRAUD_TYPE: { COMPANY_ID: companyId, FRAUD_TYPE: fraudType } },
        });
        if (!t)
            return res.status(404).json({ error: 'No subpoena template configured for this fraud type.' });
        return res.json({ template: t });
    }
    catch (err) {
        console.error('[notice-templates GET /subpoena/:fraudType]', err);
        return res.status(500).json({ error: 'Failed to load subpoena language template' });
    }
});
export default router;
