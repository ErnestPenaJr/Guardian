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
// Field labels that are PII when used as identifiers in the rider's
// IDENTIFIER_BLOCK. Case-insensitive substring match against the field label.
// Belt-and-suspenders alongside the FIELDS.IS_PII column — catches fields
// whose admin forgot to flag them.
const PII_LABEL_HINTS = [
    'name', 'ssn', 'social security', 'dob', 'date of birth',
    'account', 'debit card', 'credit card', 'phone', 'email',
];
function looksLikePiiLabel(label) {
    const s = label.trim().toLowerCase();
    return PII_LABEL_HINTS.some((hint) => s.includes(hint));
}
/**
 * Build the rider's IDENTIFIER_BLOCK from the notice's persisted template
 * field values. Values whose field has IS_PII=1, OR whose label looks like
 * PII, OR whose content matches a PII pattern, are redacted to `[REDACTED]`.
 * Returns a right-padded monospace block; empty values are skipped.
 */
async function buildIdentifierBlock(noticeId, companyId) {
    const noticeRows = await prisma.$queryRawUnsafe(`
    SELECT "TEMPLATE_FORM_ID", "TEMPLATE_VALUES_JSON"
    FROM "GUARDIAN"."MY_NOTICES"
    WHERE "NOTICE_ID" = ${Number(noticeId)} AND "COMPANY_ID" = ${Number(companyId)}
  `);
    const notice = noticeRows[0];
    if (!notice?.TEMPLATE_FORM_ID || !notice.TEMPLATE_VALUES_JSON)
        return '';
    let values;
    try {
        values = JSON.parse(notice.TEMPLATE_VALUES_JSON);
    }
    catch {
        return '';
    }
    const fieldIds = Object.keys(values).map((k) => Number(k)).filter(Number.isFinite);
    if (fieldIds.length === 0)
        return '';
    const fields = await prisma.$queryRawUnsafe(`
    SELECT f."FIELD_ID", f."FIELD_NAME", ff."IS_PII", ff."SORT_ORDER"
    FROM "GUARDIAN"."FIELDS" f
    INNER JOIN "GUARDIAN"."FORMS_FIELDS" ff ON f."FIELD_ID" = ff."FIELD_ID"
    WHERE ff."FORM_ID" = ${Number(notice.TEMPLATE_FORM_ID)} AND f."FIELD_ID" IN (${fieldIds.join(',')})
    ORDER BY ff."SORT_ORDER", f."FIELD_ID"
  `);
    const rows = [];
    for (const f of fields) {
        const raw = (values[String(f.FIELD_ID)] ?? '').trim();
        if (!raw)
            continue;
        const isPii = f.IS_PII || looksLikePiiLabel(f.FIELD_NAME) || scanForPII(raw).hit;
        rows.push({ label: f.FIELD_NAME, value: isPii ? '[REDACTED]' : raw });
    }
    if (rows.length === 0)
        return '';
    const labelWidth = Math.max(...rows.map((r) => r.label.length)) + 1;
    return rows
        .map((r) => `         ${(r.label + ':').padEnd(labelWidth + 1)}  ${r.value}`)
        .join('\n');
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
        // PII scan on each token value (Processor-supplied) — exempt the
        // rider-chrome tokens whose values are intentionally numeric or
        // date-like (institution metadata, records-period date).
        const TOKEN_PII_EXEMPT = new Set([
            'INSTITUTION_NAME',
            'INSTITUTION_DEPARTMENT',
            'INSTITUTION_ADDRESS_LINE_1',
            'INSTITUTION_CITY_STATE_ZIP',
            'INSTITUTION_FAX',
            'PERIOD_START_DATE',
        ]);
        for (const [k, v] of Object.entries(p.tokenValues)) {
            if (TOKEN_PII_EXEMPT.has(k))
                continue;
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
        // Expand [IDENTIFIER_BLOCK] from the notice's persisted template values
        // (with PII redaction). Safe no-op when notice has no template values
        // saved or when the template body doesn't include the token.
        if (populated.includes('[IDENTIFIER_BLOCK]') && p.incidentNoticeId) {
            const block = await buildIdentifierBlock(p.incidentNoticeId, companyId);
            populated = populated.split('[IDENTIFIER_BLOCK]').join(block);
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
// List riders for a given incident notice (used by ViewNotice's rider panel
// to decide whether to show "Generate" vs. "View existing").
router.get('/', requireAuth, async (req, res) => {
    try {
        const incidentNoticeIdRaw = req.query.incidentNoticeId;
        if (incidentNoticeIdRaw == null) {
            return res.status(400).json({ error: 'incidentNoticeId query param is required' });
        }
        const incidentNoticeId = Number(incidentNoticeIdRaw);
        if (!Number.isFinite(incidentNoticeId)) {
            return res.status(400).json({ error: 'Invalid incidentNoticeId' });
        }
        const { companyId } = actorIds(req);
        if (!companyId)
            return res.status(403).json({ error: 'Missing company context' });
        const riders = await prisma.sUBPOENA_RIDERS.findMany({
            where: { INCIDENT_NOTICE_ID: incidentNoticeId, COMPANY_ID: companyId },
            orderBy: { CREATED_AT: 'desc' },
        });
        return res.json({ riders });
    }
    catch (err) {
        console.error('[subpoena-riders GET /]', err);
        return res.status(500).json({ error: 'Failed to list subpoena riders' });
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
