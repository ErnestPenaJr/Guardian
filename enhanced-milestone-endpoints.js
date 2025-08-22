/**
 * Guardian MVP - Enhanced Milestone API Endpoints
 * Using enhanced WORK_PROGRESS table for comprehensive milestone tracking
 * Date: 2025-08-22
 */

const milestoneHelpers = require('./milestone-helpers');

/**
 * Enhanced Milestone API Endpoints to add to server file
 * These endpoints enhance the existing WORK_PROGRESS functionality with milestone tracking
 */

// ========================================
// GET /api/milestones/:requestId - Get comprehensive milestone history
// ========================================
/*
app.get('/api/milestones/:requestId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { 
            progressTypes, 
            milestonesOnly = false, 
            visibleToRequestorOnly = false,
            limit = null,
            offset = 0
        } = req.query;

        console.log(`<¯ Getting milestone history for request ${requestId} (Company: ${req.companyId})`);

        // Verify request exists and belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME, REQUESTOR_ID
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({ 
                error: 'Request not found or access denied' 
            });
        }

        // Parse progress types if provided
        const typeFilters = progressTypes ? 
            (Array.isArray(progressTypes) ? progressTypes : progressTypes.split(',')) : null;

        const options = {
            progressTypes: typeFilters,
            milestonesOnly: milestonesOnly === 'true',
            visibleToRequestorOnly: visibleToRequestorOnly === 'true',
            limit: limit ? parseInt(limit) : null,
            offset: parseInt(offset) || 0
        };

        const milestones = await milestoneHelpers.getMilestoneHistory(requestId, req.companyId, options);

        res.json({
            success: true,
            request: {
                id: request[0].REQUEST_ID,
                name: request[0].REQUEST_NAME,
                requestorId: request[0].REQUESTOR_ID
            },
            milestones,
            filters: options,
            totalReturned: milestones.length
        });

    } catch (error) {
        console.error('L Error getting milestone history:', error);
        res.status(500).json({
            error: 'Failed to retrieve milestone history',
            details: error.message
        });
    }
});
*/

// ========================================
// GET /api/milestones/:requestId/stats - Get milestone statistics
// ========================================
/*
app.get('/api/milestones/:requestId/stats', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        
        console.log(`=Ê Getting milestone stats for request ${requestId} (Company: ${req.companyId})`);

        // Verify request exists and belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({ 
                error: 'Request not found or access denied' 
            });
        }

        const stats = await milestoneHelpers.getMilestoneStats(requestId, req.companyId);

        res.json({
            success: true,
            requestId,
            requestName: request[0].REQUEST_NAME,
            stats: {
                totalEntries: stats.TOTAL_ENTRIES,
                majorMilestones: stats.MAJOR_MILESTONES,
                systemGenerated: stats.SYSTEM_GENERATED,
                userGenerated: stats.USER_GENERATED,
                withAttachments: stats.WITH_ATTACHMENTS,
                totalHours: stats.TOTAL_HOURS,
                firstEntry: stats.FIRST_ENTRY,
                latestEntry: stats.LATEST_ENTRY,
                uniqueTypes: stats.UNIQUE_TYPES,
                typeBreakdown: stats.typeBreakdown
            }
        });

    } catch (error) {
        console.error('L Error getting milestone stats:', error);
        res.status(500).json({
            error: 'Failed to retrieve milestone statistics',
            details: error.message
        });
    }
});
*/

// ========================================
// POST /api/milestones - Create manual milestone
// ========================================
/*
app.post('/api/milestones', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const {
            requestId,
            title,
            description,
            progressType = 'milestone',
            isMilestone = true,
            isVisibleToRequestor = true,
            hoursWorked = null,
            relatedTaskId = null,
            relatedAttachmentId = null
        } = req.body;

        console.log(`• Creating manual milestone for request ${requestId} (Company: ${req.companyId})`);

        // Verify request exists and belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({ 
                error: 'Request not found or access denied' 
            });
        }

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Milestone title is required' 
            });
        }

        const workProgressId = await milestoneHelpers.createMilestone({
            requestId: parseInt(requestId),
            userId: req.userId,
            companyId: req.companyId,
            progressType,
            title: title.trim(),
            description: description?.trim() || null,
            isSystemGenerated: false,
            isMilestone: isMilestone === true || isMilestone === 'true',
            isVisibleToRequestor: isVisibleToRequestor === true || isVisibleToRequestor === 'true',
            hoursWorked: hoursWorked ? parseFloat(hoursWorked) : null,
            relatedTaskId: relatedTaskId ? parseInt(relatedTaskId) : null,
            relatedAttachmentId: relatedAttachmentId ? parseInt(relatedAttachmentId) : null,
            eventData: {
                action: 'manual_milestone_created',
                createdBy: req.userId,
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            message: 'Milestone created successfully',
            milestone: {
                workProgressId,
                requestId: parseInt(requestId),
                title,
                description,
                progressType,
                isMilestone,
                isSystemGenerated: false
            }
        });

    } catch (error) {
        console.error('L Error creating manual milestone:', error);
        res.status(500).json({
            error: 'Failed to create milestone',
            details: error.message
        });
    }
});
*/

// ========================================
// PUT /api/milestones/:workProgressId - Update milestone
// ========================================
/*
app.put('/api/milestones/:workProgressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const workProgressId = parseInt(req.params.workProgressId);
        const {
            title,
            description,
            isVisibleToRequestor,
            hoursWorked
        } = req.body;

        console.log(` Updating milestone ${workProgressId} (Company: ${req.companyId})`);

        // Verify milestone exists and belongs to user's company
        const milestone = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.REQUEST_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, r.COMPANY_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${workProgressId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!milestone.length) {
            return res.status(404).json({ 
                error: 'Milestone not found or access denied' 
            });
        }

        // Only allow editing of user-generated milestones, or system milestones by the same user
        if (milestone[0].IS_SYSTEM_GENERATED && milestone[0].USER_ID !== req.userId) {
            return res.status(403).json({ 
                error: 'Cannot edit system-generated milestones created by other users' 
            });
        }

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (title !== undefined) {
            updateFields.push('TITLE = ?');
            updateValues.push(title.trim());
        }

        if (description !== undefined) {
            updateFields.push('DESCRIPTION = ?');
            updateValues.push(description?.trim() || null);
        }

        if (isVisibleToRequestor !== undefined) {
            updateFields.push('IS_VISIBLE_TO_REQUESTOR = ?');
            updateValues.push(isVisibleToRequestor === true || isVisibleToRequestor === 'true' ? 1 : 0);
        }

        if (hoursWorked !== undefined) {
            updateFields.push('HOURS_WORKED = ?');
            updateValues.push(hoursWorked ? parseFloat(hoursWorked) : null);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ 
                error: 'No valid fields provided for update' 
            });
        }

        updateFields.push('UPDATE_DATE = GETDATE()');
        updateFields.push('UPDATE_USER_ID = ?');
        updateValues.push(req.userId);
        updateValues.push(workProgressId);
        updateValues.push(req.companyId);

        await prisma.$executeRaw`
            UPDATE GUARDIAN.WORK_PROGRESS 
            SET ${updateFields.join(', ')}
            WHERE WORK_PROGRESS_ID = ? 
            AND REQUEST_ID IN (SELECT REQUEST_ID FROM GUARDIAN.REQUESTS WHERE COMPANY_ID = ?)
        `.replace(/\?/g, '${updateValues.shift()}');

        res.json({
            success: true,
            message: 'Milestone updated successfully',
            workProgressId
        });

    } catch (error) {
        console.error('L Error updating milestone:', error);
        res.status(500).json({
            error: 'Failed to update milestone',
            details: error.message
        });
    }
});
*/

// ========================================
// DELETE /api/milestones/:workProgressId - Delete milestone
// ========================================
/*
app.delete('/api/milestones/:workProgressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const workProgressId = parseInt(req.params.workProgressId);

        console.log(`=Ñ Deleting milestone ${workProgressId} (Company: ${req.companyId})`);

        // Verify milestone exists and belongs to user's company
        const milestone = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, wp.TITLE, r.COMPANY_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${workProgressId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!milestone.length) {
            return res.status(404).json({ 
                error: 'Milestone not found or access denied' 
            });
        }

        // Only allow deletion of user-generated milestones, or system milestones by the same user
        if (milestone[0].IS_SYSTEM_GENERATED && milestone[0].USER_ID !== req.userId) {
            return res.status(403).json({ 
                error: 'Cannot delete system-generated milestones created by other users' 
            });
        }

        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${workProgressId}
        `;

        console.log(` Milestone "${milestone[0].TITLE}" deleted successfully`);

        res.json({
            success: true,
            message: 'Milestone deleted successfully',
            deletedMilestone: {
                workProgressId,
                title: milestone[0].TITLE,
                wasSystemGenerated: milestone[0].IS_SYSTEM_GENERATED
            }
        });

    } catch (error) {
        console.error('L Error deleting milestone:', error);
        res.status(500).json({
            error: 'Failed to delete milestone',
            details: error.message
        });
    }
});
*/

// ========================================
// GET /api/milestones/types - Get available milestone types
// ========================================
/*
app.get('/api/milestones/types', (req, res) => {
    res.json({
        success: true,
        progressTypes: Object.entries(milestoneHelpers.PROGRESS_TYPES).map(([key, value]) => ({
            key: key.toLowerCase(),
            value,
            description: getProgressTypeDescription(value)
        }))
    });
});

function getProgressTypeDescription(type) {
    const descriptions = {
        'note': 'Manual progress notes and updates',
        'milestone': 'Important milestone markers',
        'status': 'Request status change events',
        'task': 'Task-related events and updates',
        'document': 'File and attachment events',
        'form': 'Form submission and update events',
        'system': 'Automatic system-generated events'
    };
    return descriptions[type] || 'Milestone event';
}
*/

module.exports = {
    // Export helper functions if needed
    milestoneHelpers
};