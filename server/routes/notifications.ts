import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';

const router = Router();
const prisma = new PrismaClient();

// Extend Request type for user
interface AuthRequest extends Request {
  user?: any;
}

// Get notifications for the current user
router.get('/', passport.authenticate('jwt', { session: false }), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.USER_ID;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    // For now, return mock data since notifications table might not exist
    // TODO: Implement actual database query when notifications table is ready
    const mockNotifications = [
      {
        NOTIFICATION_ID: 1,
        TYPE: 'request_assigned',
        TITLE: 'New Request Assigned',
        MESSAGE: 'You have been assigned a new request #1234',
        RELATED_ID: 1234,
        IS_READ: false,
        CREATED_DATE: new Date().toISOString()
      },
      {
        NOTIFICATION_ID: 2,
        TYPE: 'request_completed',
        TITLE: 'Request Completed',
        MESSAGE: 'Request #1233 has been completed',
        RELATED_ID: 1233,
        IS_READ: true,
        CREATED_DATE: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    const filteredNotifications = unreadOnly 
      ? mockNotifications.filter(n => !n.IS_READ)
      : mockNotifications;

    const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedNotifications,
      count: filteredNotifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get unread notification count
router.get('/count', passport.authenticate('jwt', { session: false }), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.USER_ID;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For now, return mock count
    // TODO: Implement actual database query when notifications table is ready
    const unreadCount = 1; // Mock: 1 unread notification

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notification count',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark a notification as read
router.put('/:id/read', passport.authenticate('jwt', { session: false }), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.USER_ID;
    const notificationId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For now, just return success
    // TODO: Implement actual database update when notifications table is ready
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark all notifications as read
router.put('/read-all', passport.authenticate('jwt', { session: false }), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.USER_ID;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For now, just return success with mock count
    // TODO: Implement actual database update when notifications table is ready
    res.json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: 1
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark all notifications as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
