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
