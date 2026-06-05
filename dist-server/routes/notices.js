import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
const router = Router();
const prisma = new PrismaClient();
// Get notices for the current user
router.get('/my', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.USER_ID;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // For now, return mock data since notices table might not exist
        // TODO: Implement actual database query when notices table is ready
        const mockNotices = [
            {
                NOTICE_ID: 1,
                TITLE: 'System Maintenance',
                CONTENT: 'System will be under maintenance on Sunday',
                TYPE: 'info',
                IS_ACTIVE: true,
                CREATED_DATE: new Date().toISOString()
            }
        ];
        res.json({
            success: true,
            data: mockNotices
        });
    }
    catch (error) {
        console.error('Error fetching notices:', error);
        res.status(500).json({
            error: 'Failed to fetch notices',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Get notice statistics
router.get('/stats', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.USER_ID;
        const companyId = req.user?.COMPANY_ID;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const totalNoticesResult = await prisma.$queryRaw `
      SELECT COUNT(*)::int as total_count
      FROM "GUARDIAN"."NOTICES" n
      INNER JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON n."NOTICE_ID" = nr."NOTICE_ID"
      WHERE nr."RECIPIENT_USER_ID" = ${userId}
      AND n."COMPANY_ID" = ${companyId}
      AND n."IS_DELETED" = false
    `;
        const unreadNoticesResult = await prisma.$queryRaw `
      SELECT COUNT(*)::int as unread_count
      FROM "GUARDIAN"."NOTICES" n
      INNER JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON n."NOTICE_ID" = nr."NOTICE_ID"
      LEFT JOIN "GUARDIAN"."NOTICE_READ_STATUS" nrs ON n."NOTICE_ID" = nrs."NOTICE_ID" AND nrs."USER_ID" = ${userId}
      WHERE nr."RECIPIENT_USER_ID" = ${userId}
      AND n."COMPANY_ID" = ${companyId}
      AND n."IS_DELETED" = false
      AND nrs."NOTICE_READ_STATUS_ID" IS NULL
    `;
        const issuedByMeResult = await prisma.$queryRaw `
      SELECT COUNT(*)::int as issued_count
      FROM "GUARDIAN"."NOTICES" n
      WHERE n."ISSUED_BY_USER_ID" = ${userId}
      AND n."COMPANY_ID" = ${companyId}
      AND n."IS_DELETED" = false
    `;
        const activeNoticesResult = await prisma.$queryRaw `
      SELECT COUNT(*)::int as active_count
      FROM "GUARDIAN"."NOTICES" n
      INNER JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON n."NOTICE_ID" = nr."NOTICE_ID"
      WHERE nr."RECIPIENT_USER_ID" = ${userId}
      AND n."COMPANY_ID" = ${companyId}
      AND n."IS_DELETED" = false
      AND n."STATUS" = 'PUBLISHED'
      AND n."IS_ACTIVE" = true
    `;
        const stats = {
            totalNotices: totalNoticesResult[0]?.total_count || 0,
            unreadNotices: unreadNoticesResult[0]?.unread_count || 0,
            issuedByMe: issuedByMeResult[0]?.issued_count || 0,
            activeNotices: activeNoticesResult[0]?.active_count || 0,
        };
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching notice statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch notice statistics',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Get all active notices
router.get('/active', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        // For now, return mock data
        const mockNotices = [
            {
                NOTICE_ID: 1,
                TITLE: 'System Maintenance',
                CONTENT: 'System will be under maintenance on Sunday',
                TYPE: 'info',
                IS_ACTIVE: true,
                CREATED_DATE: new Date().toISOString()
            }
        ];
        res.json({
            success: true,
            data: mockNotices
        });
    }
    catch (error) {
        console.error('Error fetching active notices:', error);
        res.status(500).json({
            error: 'Failed to fetch active notices',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
export default router;
