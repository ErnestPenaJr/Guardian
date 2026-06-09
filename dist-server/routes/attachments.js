import express from 'express';
import path from 'path';
import { requireAuth } from '../auth.js';
import prisma from "../prisma-client.js";
const router = express.Router();
const contentTypeByExtension = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
};
const getContentType = (fileName) => contentTypeByExtension[path.extname(fileName).toLowerCase()] || 'application/octet-stream';
function normalizeAttachmentBinary(value) {
    if (!value)
        return null;
    if (Buffer.isBuffer(value))
        return value;
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    if (Array.isArray(value))
        return Buffer.from(value);
    if (typeof value === 'object') {
        const entries = Object.entries(value)
            .filter(([key, byte]) => /^\d+$/.test(key) && typeof byte === 'number')
            .sort((a, b) => Number(a[0]) - Number(b[0]));
        if (entries.length > 0) {
            return Buffer.from(entries.map(([, byte]) => Number(byte)));
        }
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            const normalized = normalizeAttachmentBinary(parsed);
            if (normalized)
                return normalized;
        }
        catch {
            return Buffer.from(value, 'base64');
        }
    }
    return null;
}
router.get('/:id/download', requireAuth, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);
        if (isNaN(attachmentId)) {
            return res.status(400).json({ error: 'Invalid attachment ID' });
        }
        const attachment = await prisma.aTTACHMENTS.findUnique({
            where: { ATTACHMENT_ID: attachmentId },
            select: {
                FILE_NAME: true,
                ATTACHMENT: true,
            },
        });
        if (!attachment || !attachment.ATTACHMENT) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        const fileBuffer = normalizeAttachmentBinary(attachment.ATTACHMENT);
        if (!fileBuffer) {
            return res.status(500).json({ error: 'Attachment data is not valid binary' });
        }
        res.setHeader('Content-Type', getContentType(attachment.FILE_NAME));
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.FILE_NAME)}"`);
        res.send(fileBuffer);
    }
    catch (error) {
        console.error('Error downloading attachment:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
});
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);
        if (isNaN(attachmentId)) {
            return res.status(400).json({ error: 'Invalid attachment ID' });
        }
        const attachment = await prisma.aTTACHMENTS.findUnique({
            where: { ATTACHMENT_ID: attachmentId },
            select: { ATTACHMENT_ID: true },
        });
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        await prisma.aTTACHMENTS.delete({
            where: { ATTACHMENT_ID: attachmentId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});
export default router;
