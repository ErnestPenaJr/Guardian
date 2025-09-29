import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Helper function to create system-generated milestones
export const createSystemMilestone = async (requestId, progressType, title, description, userId, companyId, eventData = null, relatedTaskId = null, statusFrom = null, statusTo = null) => {
    try {
        const result = await prisma.$queryRaw `
      INSERT INTO GUARDIAN.WORK_PROGRESS (
        REQUEST_ID,
        USER_ID,
        PROGRESS_TYPE,
        TITLE,
        DESCRIPTION,
        IS_MILESTONE,
        IS_VISIBLE_TO_REQUESTOR,
        IS_SYSTEM_GENERATED,
        RELATED_TASK_ID,
        STATUS_FROM,
        STATUS_TO,
        EVENT_DATA,
        CREATE_DATE,
        UPDATE_DATE
      ) VALUES (
        ${requestId},
        ${userId},
        ${progressType},
        ${title},
        ${description},
        1,
        1,
        1,
        ${relatedTaskId},
        ${statusFrom},
        ${statusTo},
        ${eventData},
        GETDATE(),
        GETDATE()
      )
    `;
        console.log(`✅ Created system milestone: ${title} for request ${requestId}`);
        return result;
    }
    catch (error) {
        console.error('❌ Error creating system milestone:', error);
        throw error;
    }
};
// Helper function for status change milestones
export const createStatusChangeMilestone = async (requestId, fromStatus, toStatus, userId, companyId) => {
    const statusLabels = {
        'P': 'Pending',
        'I': 'In Progress',
        'C': 'Completed',
        'H': 'On Hold',
        'X': 'Cancelled'
    };
    const title = `Status Changed: ${statusLabels[fromStatus] || fromStatus} → ${statusLabels[toStatus] || toStatus}`;
    const description = `Request status automatically changed from "${statusLabels[fromStatus] || fromStatus}" to "${statusLabels[toStatus] || toStatus}"`;
    return await createSystemMilestone(requestId, 'status', title, description, userId, companyId, JSON.stringify({ fromStatus, toStatus }), null, fromStatus, toStatus);
};
// Helper function for task milestones
export const createTaskMilestone = async (requestId, taskId, action, userId, companyId) => {
    const actionLabels = {
        'created': 'Task Created',
        'started': 'Task Started',
        'completed': 'Task Completed',
        'cancelled': 'Task Cancelled',
        'assigned': 'Task Assigned'
    };
    const title = actionLabels[action] || `Task ${action}`;
    const description = `Task activity: ${action}`;
    return await createSystemMilestone(requestId, 'task', title, description, userId, companyId, JSON.stringify({ taskId, action }), taskId);
};
// Helper function for document milestones
export const createDocumentMilestone = async (requestId, filename, action, userId, companyId) => {
    const title = `Document ${action}: ${filename}`;
    const description = `Document "${filename}" was ${action}`;
    return await createSystemMilestone(requestId, 'document', title, description, userId, companyId, JSON.stringify({ filename, action }));
};
// GET /api/requests/:requestId/milestones - Get milestones with filtering and pagination
router.get('/requests/:requestId/milestones', requireAuth, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { progressTypes, milestonesOnly = 'false', visibleToRequestorOnly = 'false', systemOnly, manualOnly, limit = '50', offset = '0' } = req.query;
        const authUser = req.user;
        const userId = authUser?.id;
        const companyId = authUser?.COMPANY_ID ?? authUser?.companyId ?? null;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        console.log(`📊 Getting milestones for request ${requestId} (Company: ${companyId})`);
        // Verify request exists and belongs to user's company
        const request = await prisma.$queryRaw `
      SELECT REQUEST_ID, REQUEST_NAME
      FROM GUARDIAN.REQUESTS 
      WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
    `;
        if (request.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }
        // Build WHERE clause for filtering
        let whereConditions = [
            `wp.REQUEST_ID = ${requestId}`,
            `r.COMPANY_ID = ${companyId}`
        ];
        // Filter by progress types
        if (progressTypes) {
            const types = Array.isArray(progressTypes) ? progressTypes : [progressTypes];
            const typeFilter = types.map(type => `'${type}'`).join(',');
            whereConditions.push(`wp.PROGRESS_TYPE IN (${typeFilter})`);
        }
        // Filter by milestones only
        if (milestonesOnly === 'true') {
            whereConditions.push('wp.IS_MILESTONE = 1');
        }
        // Filter by visibility to requestor
        if (visibleToRequestorOnly === 'true') {
            whereConditions.push('wp.IS_VISIBLE_TO_REQUESTOR = 1');
        }
        // Filter by system vs manual
        if (systemOnly === 'true') {
            whereConditions.push('wp.IS_SYSTEM_GENERATED = 1');
        }
        else if (manualOnly === 'true') {
            whereConditions.push('wp.IS_SYSTEM_GENERATED = 0');
        }
        const whereClause = whereConditions.join(' AND ');
        const limitNum = parseInt(limit) || 50;
        const offsetNum = parseInt(offset) || 0;
        // Get milestones with user information
        const milestones = await prisma.$queryRaw `
      SELECT 
        wp.WORK_PROGRESS_ID,
        wp.REQUEST_ID,
        wp.USER_ID,
        wp.PROGRESS_TYPE,
        wp.TITLE,
        wp.DESCRIPTION,
        wp.IS_MILESTONE,
        wp.IS_VISIBLE_TO_REQUESTOR,
        wp.IS_SYSTEM_GENERATED,
        wp.HOURS_WORKED,
        wp.RELATED_TASK_ID,
        wp.STATUS_FROM,
        wp.STATUS_TO,
        wp.EVENT_DATA,
        wp.CREATE_DATE,
        wp.UPDATE_DATE,
        u.FIRST_NAME,
        u.LAST_NAME,
        CONCAT(u.FIRST_NAME, ' ', u.LAST_NAME) as CREATED_BY_NAME
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      INNER JOIN GUARDIAN.USERS u ON wp.USER_ID = u.USER_ID
      WHERE ${whereClause}
      ORDER BY wp.CREATE_DATE DESC
      OFFSET ${offsetNum} ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `;
        // Get total count for pagination
        const countResult = await prisma.$queryRaw `
      SELECT COUNT(*) as total
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      WHERE ${whereClause}
    `;
        const totalCount = countResult[0]?.total || 0;
        res.json({
            success: true,
            data: milestones,
            pagination: {
                total: totalCount,
                limit: limitNum,
                offset: offsetNum,
                hasMore: offsetNum + limitNum < totalCount
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching milestones:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/requests/:requestId/milestones/stats - Get milestone statistics
router.get('/requests/:requestId/milestones/stats', requireAuth, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const userId = req.user?.id;
        const companyId = req.user?.COMPANY_ID;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        console.log(`📈 Getting milestone stats for request ${requestId} (Company: ${companyId})`);
        // Verify request exists and belongs to user's company
        const request = await prisma.$queryRaw `
      SELECT REQUEST_ID, REQUEST_NAME
      FROM GUARDIAN.REQUESTS 
      WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
    `;
        if (request.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }
        // Get milestone statistics
        const stats = await prisma.$queryRaw `
      SELECT 
        COUNT(*) as TOTAL_MILESTONES,
        SUM(CASE WHEN IS_SYSTEM_GENERATED = 1 THEN 1 ELSE 0 END) as SYSTEM_MILESTONES,
        SUM(CASE WHEN IS_SYSTEM_GENERATED = 0 THEN 1 ELSE 0 END) as MANUAL_MILESTONES,
        SUM(CASE WHEN PROGRESS_TYPE = 'milestone' THEN 1 ELSE 0 END) as MILESTONE_TYPE,
        SUM(CASE WHEN PROGRESS_TYPE = 'status' THEN 1 ELSE 0 END) as STATUS_CHANGES,
        SUM(CASE WHEN PROGRESS_TYPE = 'task' THEN 1 ELSE 0 END) as TASK_ACTIVITIES,
        SUM(CASE WHEN PROGRESS_TYPE = 'document' THEN 1 ELSE 0 END) as DOCUMENT_ACTIVITIES,
        SUM(CASE WHEN PROGRESS_TYPE = 'note' THEN 1 ELSE 0 END) as NOTES,
        MIN(CREATE_DATE) as FIRST_MILESTONE_DATE,
        MAX(CREATE_DATE) as LAST_MILESTONE_DATE
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      WHERE wp.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${companyId}
    `;
        // Get progress type breakdown
        const typeBreakdown = await prisma.$queryRaw `
      SELECT 
        PROGRESS_TYPE,
        COUNT(*) as COUNT,
        SUM(CASE WHEN IS_SYSTEM_GENERATED = 1 THEN 1 ELSE 0 END) as SYSTEM_COUNT,
        SUM(CASE WHEN IS_SYSTEM_GENERATED = 0 THEN 1 ELSE 0 END) as MANUAL_COUNT
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      WHERE wp.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${companyId}
      GROUP BY PROGRESS_TYPE
      ORDER BY COUNT DESC
    `;
        res.json({
            success: true,
            data: {
                summary: stats[0] || {},
                typeBreakdown: typeBreakdown
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching milestone stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/milestones - Create manual milestone
router.post('/milestones', requireAuth, async (req, res) => {
    try {
        const { requestId, title, description, progressType = 'milestone', isMilestone = true, isVisibleToRequestor = true, hoursWorked = null, relatedTaskId = null } = req.body;
        const userId = req.user?.id;
        const companyId = req.user?.COMPANY_ID;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Validation
        if (!requestId || !title) {
            return res.status(400).json({
                error: 'Request ID and title are required'
            });
        }
        console.log(`📝 Creating manual milestone for request ${requestId} (Company: ${companyId})`);
        // Verify request exists and user has permission
        const request = await prisma.$queryRaw `
      SELECT r.REQUEST_ID, r.REQUEST_NAME, r.REQUESTOR_ID, r.ASSIGNED_ID
      FROM GUARDIAN.REQUESTS r
      WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${companyId}
    `;
        if (request.length === 0) {
            return res.status(404).json({ error: 'Request not found or access denied' });
        }
        // Check authorization (assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw `
      SELECT ur.ROLE_ID 
      FROM GUARDIAN.USER_ROLES ur 
      WHERE ur.USER_ID = ${userId} AND ur.STATUS = 'P'
    `;
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isAssigned = request[0].ASSIGNED_ID === userId;
        const isRequestor = request[0].REQUESTOR_ID === userId;
        if (!isAdmin && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to create milestones for this request'
            });
        }
        // Create the milestone
        const result = await prisma.$queryRaw `
      INSERT INTO GUARDIAN.WORK_PROGRESS (
        REQUEST_ID,
        USER_ID,
        PROGRESS_TYPE,
        TITLE,
        DESCRIPTION,
        IS_MILESTONE,
        IS_VISIBLE_TO_REQUESTOR,
        IS_SYSTEM_GENERATED,
        HOURS_WORKED,
        RELATED_TASK_ID,
        CREATE_DATE,
        UPDATE_DATE
      ) OUTPUT INSERTED.WORK_PROGRESS_ID
      VALUES (
        ${requestId},
        ${userId},
        ${progressType},
        ${title},
        ${description || ''},
        ${isMilestone ? 1 : 0},
        ${isVisibleToRequestor ? 1 : 0},
        0,
        ${hoursWorked},
        ${relatedTaskId},
        GETDATE(),
        GETDATE()
      )
    `;
        console.log('✅ Manual milestone created successfully');
        res.status(201).json({
            success: true,
            message: 'Milestone created successfully',
            milestoneId: result[0]?.WORK_PROGRESS_ID
        });
    }
    catch (error) {
        console.error('❌ Error creating manual milestone:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/milestones/:milestoneId - Update manual milestone
router.put('/milestones/:milestoneId', requireAuth, async (req, res) => {
    try {
        const milestoneId = parseInt(req.params.milestoneId);
        const { title, description, isVisibleToRequestor, hoursWorked } = req.body;
        const userId = req.user?.id;
        const companyId = req.user?.COMPANY_ID;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        console.log(`📝 Updating milestone ${milestoneId} (Company: ${companyId})`);
        // Verify milestone exists and get request info
        const milestone = await prisma.$queryRaw `
      SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, wp.TITLE,
             r.REQUEST_ID, r.REQUESTOR_ID, r.ASSIGNED_ID, r.COMPANY_ID
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      WHERE wp.WORK_PROGRESS_ID = ${milestoneId} AND r.COMPANY_ID = ${companyId}
    `;
        if (milestone.length === 0) {
            return res.status(404).json({ error: 'Milestone not found or access denied' });
        }
        // Cannot edit system-generated milestones
        if (milestone[0].IS_SYSTEM_GENERATED) {
            return res.status(400).json({
                error: 'Cannot edit system-generated milestones'
            });
        }
        // Check authorization
        const userRoles = await prisma.$queryRaw `
      SELECT ur.ROLE_ID 
      FROM GUARDIAN.USER_ROLES ur 
      WHERE ur.USER_ID = ${userId} AND ur.STATUS = 'P'
    `;
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = milestone[0].USER_ID === userId;
        const isAssigned = milestone[0].ASSIGNED_ID === userId;
        const isRequestor = milestone[0].REQUESTOR_ID === userId;
        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to update this milestone'
            });
        }
        // Build update query
        const updateFields = [];
        if (title !== undefined)
            updateFields.push(`TITLE = '${title}'`);
        if (description !== undefined)
            updateFields.push(`DESCRIPTION = '${description}'`);
        if (isVisibleToRequestor !== undefined)
            updateFields.push(`IS_VISIBLE_TO_REQUESTOR = ${isVisibleToRequestor ? 1 : 0}`);
        if (hoursWorked !== undefined)
            updateFields.push(`HOURS_WORKED = ${hoursWorked}`);
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        updateFields.push('UPDATE_DATE = GETDATE()');
        const updateQuery = `UPDATE GUARDIAN.WORK_PROGRESS SET ${updateFields.join(', ')} WHERE WORK_PROGRESS_ID = ${milestoneId}`;
        await prisma.$queryRawUnsafe(updateQuery);
        console.log('✅ Milestone updated successfully');
        res.json({
            success: true,
            message: 'Milestone updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error updating milestone:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/milestones/:milestoneId - Delete manual milestone
router.delete('/milestones/:milestoneId', requireAuth, async (req, res) => {
    try {
        const milestoneId = parseInt(req.params.milestoneId);
        const userId = req.user?.id;
        const companyId = req.user?.COMPANY_ID;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        console.log(`🗑️ Deleting milestone ${milestoneId} (Company: ${companyId})`);
        // Verify milestone exists and get request info
        const milestone = await prisma.$queryRaw `
      SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, wp.TITLE,
             r.REQUEST_ID, r.REQUESTOR_ID, r.ASSIGNED_ID, r.COMPANY_ID
      FROM GUARDIAN.WORK_PROGRESS wp
      INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
      WHERE wp.WORK_PROGRESS_ID = ${milestoneId} AND r.COMPANY_ID = ${companyId}
    `;
        if (milestone.length === 0) {
            return res.status(404).json({ error: 'Milestone not found or access denied' });
        }
        // Cannot delete system-generated milestones
        if (milestone[0].IS_SYSTEM_GENERATED) {
            return res.status(400).json({
                error: 'Cannot delete system-generated milestones'
            });
        }
        // Check authorization (creator, admin, assigned, or requestor)
        const userRoles = await prisma.$queryRaw `
      SELECT ur.ROLE_ID 
      FROM GUARDIAN.USER_ROLES ur 
      WHERE ur.USER_ID = ${userId} AND ur.STATUS = 'P'
    `;
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = milestone[0].USER_ID === userId;
        const isAssigned = milestone[0].ASSIGNED_ID === userId;
        const isRequestor = milestone[0].REQUESTOR_ID === userId;
        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to delete this milestone'
            });
        }
        // Delete the milestone
        await prisma.$queryRaw `
      DELETE FROM GUARDIAN.WORK_PROGRESS 
      WHERE WORK_PROGRESS_ID = ${milestoneId}
    `;
        console.log('✅ Milestone deleted successfully');
        res.json({
            success: true,
            message: 'Milestone deleted successfully'
        });
    }
    catch (error) {
        console.error('❌ Error deleting milestone:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
