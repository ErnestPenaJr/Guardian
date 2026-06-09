// server/routes/external-notices.ts
//
// Phase 7 / US-SRB-03 — External user (role 5) portal endpoints.
//
// Mounted at /api/external. Note: this router is mounted BEFORE the legacy
// /api/external router in server/index.ts so its assignment-scoped /notices/:id
// GET wins for role-5 callers using the new portal flow. The legacy router
// (which uses isExternalUser middleware) still handles requests/notices/respond
// paths for the older external user surface.
//
// Endpoints:
//   GET  /notices/:id              — assignment-scoped, returns read-only notice
//   POST /notices/:id/subpoena     — multer file upload, transitions to
//                                    SUBPOENA_RECEIVED_PENDING_REVIEW
//   POST /notices/:id/call-request — records proposed times for a follow-up call
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { requireExternalUser } from '../middleware/requireExternalUser.js';
import { getPermittedSubpoenaFileTypes } from '../lib/jafarConfig.js';
import { writeAudit } from '../lib/audit.js';
import { forbid } from '../lib/forbid.js';
const router = Router();
import prisma from "../prisma-client.js";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});
router.use(requireAuth, requireExternalUser);
function actorIds(req) {
    const u = req.user ?? {};
    const userId = Number(u.id ?? u.userId);
    return { userId };
}
// GET /notices/:id — assignment-scoped read-only view
router.get('/notices/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid notice id' });
        const { userId } = actorIds(req);
        const assignment = await prisma.eXTERNAL_NOTICE_ASSIGNMENTS.findUnique({
            where: { NOTICE_ID_EXTERNAL_USER_ID: { NOTICE_ID: id, EXTERNAL_USER_ID: userId } },
        });
        if (!assignment)
            return forbid(res, 'view this notice');
        const notice = await prisma.mY_NOTICES.findUnique({
            where: { NOTICE_ID: id },
            select: {
                NOTICE_ID: true,
                NOTICE_TITLE: true,
                NOTICE_BODY: true,
                NOTICE_STATUS: true,
                SENT_AT: true,
                DISCLAIMER_STATE: true,
            },
        });
        return res.json({ notice });
    }
    catch (err) {
        console.error('[external-notices GET /notices/:id]', err);
        return res.status(500).json({ error: 'Failed to load notice' });
    }
});
// POST /notices/:id/subpoena — attach executed subpoena file
router.post('/notices/:id/subpoena', upload.single('file'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid notice id' });
        const { userId } = actorIds(req);
        const assignment = await prisma.eXTERNAL_NOTICE_ASSIGNMENTS.findUnique({
            where: { NOTICE_ID_EXTERNAL_USER_ID: { NOTICE_ID: id, EXTERNAL_USER_ID: userId } },
        });
        if (!assignment)
            return forbid(res, 'attach a subpoena to this notice');
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'File is required' });
        const permitted = await getPermittedSubpoenaFileTypes();
        if (permitted.length > 0 && !permitted.includes(file.mimetype)) {
            return res.status(400).json({
                error: 'File type not permitted. Please upload a PDF, TIFF, or DOCX file.',
            });
        }
        // The current ATTACHMENTS table predates the Securities Notice MVP and uses
        // FILE_NAME + ATTACHMENT (bytes) + REQUEST_ID. The migration in Phase 0 is
        // intended to add FILE_DATA / MIME_TYPE / COMPANY_ID; until those land we
        // cast to `any` to match the plan's POST shape without breaking the build
        // when the migration has been applied.
        const notice = await prisma.mY_NOTICES.findUnique({
            where: { NOTICE_ID: id },
            select: { COMPANY_ID: true },
        });
        const att = await prisma.aTTACHMENTS.create({
            data: {
                FILE_NAME: file.originalname,
                FILE_DATA: file.buffer,
                MIME_TYPE: file.mimetype,
                COMPANY_ID: notice?.COMPANY_ID ?? null,
            },
        });
        await prisma.mY_NOTICES.update({
            where: { NOTICE_ID: id },
            data: {
                NOTICE_STATUS: 'SUBPOENA_RECEIVED_PENDING_REVIEW',
                ATTACHED_SUBPOENA_ATTACHMENT_ID: att.ATTACHMENT_ID,
            },
        });
        await writeAudit({
            eventType: 'SUBPOENA_RECEIVED',
            actorUserId: userId,
            actorRoleId: 5,
            targetType: 'NOTICE',
            targetId: id,
            companyId: notice?.COMPANY_ID ?? null,
            detail: {
                externalUserId: userId,
                fileRef: att.ATTACHMENT_ID,
                fileName: file.originalname,
            },
        });
        return res.status(201).json({ attachmentId: att.ATTACHMENT_ID });
    }
    catch (err) {
        console.error('[external-notices POST /notices/:id/subpoena]', err);
        return res.status(500).json({ error: 'Failed to attach subpoena' });
    }
});
const CallRequestSchema = z.object({
    proposedTimes: z.array(z.string().min(1)).min(1),
});
// POST /notices/:id/call-request — record proposed call times
router.post('/notices/:id/call-request', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid notice id' });
        const { userId } = actorIds(req);
        const assignment = await prisma.eXTERNAL_NOTICE_ASSIGNMENTS.findUnique({
            where: { NOTICE_ID_EXTERNAL_USER_ID: { NOTICE_ID: id, EXTERNAL_USER_ID: userId } },
        });
        if (!assignment)
            return forbid(res, 'request a call on this notice');
        const parsed = CallRequestSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
        }
        await prisma.eXTERNAL_CALL_REQUESTS.create({
            data: {
                NOTICE_ID: id,
                EXTERNAL_USER_ID: userId,
                PROPOSED_TIMES: JSON.stringify(parsed.data.proposedTimes),
            },
        });
        return res.status(201).json({ ok: true });
    }
    catch (err) {
        console.error('[external-notices POST /notices/:id/call-request]', err);
        return res.status(500).json({ error: 'Failed to record call request' });
    }
});
export default router;
