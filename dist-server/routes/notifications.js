import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
const prisma = new PrismaClient();
const router = express.Router();
// Ported from the retired legacy server.cjs (2026-06-08 Azure exit). The
// GUARDIAN.NOTIFICATIONS table is not mapped in schema.prisma, so these use
// raw SQL (PostgreSQL syntax; uppercase identifiers must be double-quoted).
// All queries are company-isolated by the authenticated user's COMPANY_ID.
// GET /api/notifications - list the current user's notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        if (companyId == null) {
            return res.status(403).json({ error: 'User is not associated with a company' });
        }
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
        const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
        const unreadOnly = req.query.unreadOnly === 'true';
        const data = await prisma.$queryRawUnsafe(`SELECT "NOTIFICATION_ID", "TYPE", "TITLE", "MESSAGE", "RELATED_ID", "IS_READ", "CREATED_DATE"
       FROM "GUARDIAN"."NOTIFICATIONS"
       WHERE "USER_ID" = $1 AND "COMPANY_ID" = $2 ${unreadOnly ? 'AND "IS_READ" = false' : ''}
       ORDER BY "CREATED_DATE" DESC
       LIMIT $3 OFFSET $4`, userId, companyId, limit, offset);
        res.json({ success: true, data, count: data.length });
    }
    catch (error) {
        console.error('[GET NOTIFICATIONS]', error);
        res.status(500).json({ error: 'Failed to fetch notifications', message: error.message });
    }
});
// GET /api/notifications/count - unread count for the current user
router.get('/count', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        if (companyId == null) {
            return res.status(403).json({ error: 'User is not associated with a company' });
        }
        const result = await prisma.$queryRaw `
      SELECT COUNT(*)::int AS unread_count
      FROM "GUARDIAN"."NOTIFICATIONS"
      WHERE "USER_ID" = ${userId} AND "COMPANY_ID" = ${companyId} AND "IS_READ" = false
    `;
        res.json({ success: true, unreadCount: Number(result[0]?.unread_count ?? 0) });
    }
    catch (error) {
        console.error('[GET NOTIFICATION COUNT]', error);
        res.status(500).json({ error: 'Failed to get notification count', message: error.message });
    }
});
// PUT /api/notifications/read-all - mark all of the user's notifications read
// (declared before the parameterized routes for clarity; paths don't collide)
router.put('/read-all', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        if (companyId == null) {
            return res.status(403).json({ error: 'User is not associated with a company' });
        }
        const updatedCount = await prisma.$executeRaw `
      UPDATE "GUARDIAN"."NOTIFICATIONS"
      SET "IS_READ" = true, "READ_DATE" = NOW()
      WHERE "USER_ID" = ${userId} AND "COMPANY_ID" = ${companyId} AND "IS_READ" = false
    `;
        res.json({ success: true, message: `Marked ${updatedCount} notifications as read`, updatedCount });
    }
    catch (error) {
        console.error('[MARK ALL NOTIFICATIONS READ]', error);
        res.status(500).json({ error: 'Failed to mark notifications as read', message: error.message });
    }
});
// PUT /api/notifications/:notificationId/read - mark one notification read
router.put('/:notificationId/read', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        const notificationId = parseInt(req.params.notificationId, 10);
        if (!notificationId || isNaN(notificationId)) {
            return res.status(400).json({ error: 'Valid notification ID is required' });
        }
        const count = await prisma.$executeRaw `
      UPDATE "GUARDIAN"."NOTIFICATIONS"
      SET "IS_READ" = true, "READ_DATE" = NOW()
      WHERE "NOTIFICATION_ID" = ${notificationId} AND "USER_ID" = ${userId} AND "COMPANY_ID" = ${companyId}
    `;
        if (count === 0) {
            return res.status(404).json({ error: 'Notification not found or access denied' });
        }
        res.json({ success: true, message: 'Notification marked as read' });
    }
    catch (error) {
        console.error('[MARK NOTIFICATION READ]', error);
        res.status(500).json({ error: 'Failed to mark notification as read', message: error.message });
    }
});
// PUT /api/notifications/:notificationId/unread - mark one notification unread
router.put('/:notificationId/unread', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        const notificationId = parseInt(req.params.notificationId, 10);
        if (!notificationId || isNaN(notificationId)) {
            return res.status(400).json({ error: 'Valid notification ID is required' });
        }
        const count = await prisma.$executeRaw `
      UPDATE "GUARDIAN"."NOTIFICATIONS"
      SET "IS_READ" = false, "READ_DATE" = NULL
      WHERE "NOTIFICATION_ID" = ${notificationId} AND "USER_ID" = ${userId} AND "COMPANY_ID" = ${companyId}
    `;
        if (count === 0) {
            return res.status(404).json({ error: 'Notification not found or access denied' });
        }
        res.json({ success: true, message: 'Notification marked as unread' });
    }
    catch (error) {
        console.error('[MARK NOTIFICATION UNREAD]', error);
        res.status(500).json({ error: 'Failed to mark notification as unread', message: error.message });
    }
});
// DELETE /api/notifications/:notificationId - delete one notification
router.delete('/:notificationId', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.COMPANY_ID;
        const notificationId = parseInt(req.params.notificationId, 10);
        if (!notificationId || isNaN(notificationId)) {
            return res.status(400).json({ error: 'Invalid notification ID' });
        }
        const count = await prisma.$executeRaw `
      DELETE FROM "GUARDIAN"."NOTIFICATIONS"
      WHERE "NOTIFICATION_ID" = ${notificationId} AND "USER_ID" = ${userId} AND "COMPANY_ID" = ${companyId}
    `;
        if (count === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ success: true, message: 'Notification deleted' });
    }
    catch (error) {
        console.error('[DELETE NOTIFICATION]', error);
        res.status(500).json({ error: 'Failed to delete notification', message: error.message });
    }
});
export default router;
