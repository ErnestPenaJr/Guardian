/**
 * Guardian MVP - Enhanced Milestone Tracking System
 * Automatic milestone capture helpers using WORK_PROGRESS table
 * Date: 2025-08-22
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Progress Types for Milestone Tracking
 */
const PROGRESS_TYPES = {
    NOTE: 'note',
    MILESTONE: 'milestone', 
    STATUS: 'status',
    TASK: 'task',
    DOCUMENT: 'document',
    FORM: 'form',
    SYSTEM: 'system'
};

/**
 * Create a milestone entry in WORK_PROGRESS table
 * @param {Object} milestoneData - Milestone information
 * @param {number} milestoneData.requestId - Request ID
 * @param {number} milestoneData.userId - User who triggered the event
 * @param {number} milestoneData.companyId - Company ID for security
 * @param {string} milestoneData.progressType - Type of milestone
 * @param {string} milestoneData.title - Brief title
 * @param {string} milestoneData.description - Detailed description
 * @param {boolean} milestoneData.isSystemGenerated - Whether system generated
 * @param {boolean} milestoneData.isMilestone - Whether this is a major milestone
 * @param {boolean} milestoneData.isVisibleToRequestor - Visibility to requestor
 * @param {number} milestoneData.relatedTaskId - Related task ID (optional)
 * @param {number} milestoneData.relatedAttachmentId - Related attachment ID (optional)
 * @param {string} milestoneData.statusFrom - Previous status (optional)
 * @param {string} milestoneData.statusTo - New status (optional)
 * @param {Object} milestoneData.eventData - Additional context data (optional)
 * @param {number} milestoneData.hoursWorked - Hours worked (optional)
 * @returns {Promise<number>} - Work Progress ID
 */
async function createMilestone(milestoneData) {
    const {
        requestId,
        userId,
        companyId,
        progressType = PROGRESS_TYPES.NOTE,
        title,
        description = null,
        isSystemGenerated = false,
        isMilestone = false,
        isVisibleToRequestor = true,
        relatedTaskId = null,
        relatedAttachmentId = null,
        statusFrom = null,
        statusTo = null,
        eventData = null,
        hoursWorked = null
    } = milestoneData;

    try {
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORK_PROGRESS (
                REQUEST_ID,
                USER_ID,
                COMPANY_ID,
                PROGRESS_TYPE,
                TITLE,
                DESCRIPTION,
                HOURS_WORKED,
                STATUS_UPDATE,
                RELATED_ATTACHMENT_ID,
                IS_MILESTONE,
                IS_VISIBLE_TO_REQUESTOR,
                IS_SYSTEM_GENERATED,
                RELATED_TASK_ID,
                STATUS_FROM,
                STATUS_TO,
                EVENT_DATA,
                CREATE_USER_ID,
                CREATE_DATE
            )
            OUTPUT INSERTED.WORK_PROGRESS_ID
            VALUES (
                ${requestId},
                ${userId},
                ${companyId},
                ${progressType},
                ${title},
                ${description},
                ${hoursWorked ? parseFloat(hoursWorked) : null},
                ${statusTo || statusFrom || null},
                ${relatedAttachmentId},
                ${isMilestone ? 1 : 0},
                ${isVisibleToRequestor ? 1 : 0},
                ${isSystemGenerated ? 1 : 0},
                ${relatedTaskId},
                ${statusFrom},
                ${statusTo},
                ${eventData ? JSON.stringify(eventData) : null},
                ${userId},
                GETDATE()
            )
        `;

        const workProgressId = result[0].WORK_PROGRESS_ID;
        console.log(` Milestone created: ${progressType} - ${title} (ID: ${workProgressId})`);
        return workProgressId;

    } catch (error) {
        console.error('L Failed to create milestone:', error);
        throw error;
    }
}

/**
 * Automatic milestone capture for request creation
 */
async function captureRequestCreated(requestId, userId, companyId, requestName) {
    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.SYSTEM,
        title: 'Request Created',
        description: `Request "${requestName}" has been submitted and is awaiting processing.`,
        isSystemGenerated: true,
        isMilestone: true,
        isVisibleToRequestor: true,
        eventData: {
            action: 'request_created',
            requestName,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for request assignment
 */
async function captureRequestAssigned(requestId, userId, companyId, assignedUserId, assignedUserName) {
    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.SYSTEM,
        title: 'Request Assigned',
        description: `Request has been assigned to ${assignedUserName} for processing.`,
        isSystemGenerated: true,
        isMilestone: true,
        isVisibleToRequestor: true,
        eventData: {
            action: 'request_assigned',
            assignedUserId,
            assignedUserName,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for status changes
 */
async function captureStatusChange(requestId, userId, companyId, statusFrom, statusTo, statusMap = {}) {
    const statusNames = {
        'A': 'Active',
        'P': 'Pending', 
        'C': 'Completed',
        'H': 'On Hold',
        'X': 'Cancelled',
        ...statusMap
    };

    const fromName = statusNames[statusFrom] || statusFrom;
    const toName = statusNames[statusTo] || statusTo;

    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.STATUS,
        title: `Status Changed: ${fromName} ’ ${toName}`,
        description: `Request status changed from "${fromName}" to "${toName}".`,
        isSystemGenerated: true,
        isMilestone: true,
        isVisibleToRequestor: true,
        statusFrom: fromName,
        statusTo: toName,
        eventData: {
            action: 'status_change',
            statusFrom,
            statusTo,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for task creation
 */
async function captureTaskCreated(requestId, userId, companyId, taskId, taskDescription, assignedUserId, assignedUserName) {
    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.TASK,
        title: 'Task Created',
        description: `New task created: "${taskDescription}" ${assignedUserName ? `(assigned to ${assignedUserName})` : '(unassigned)'}`,
        isSystemGenerated: true,
        isMilestone: false,
        isVisibleToRequestor: true,
        relatedTaskId: taskId,
        eventData: {
            action: 'task_created',
            taskId,
            taskDescription,
            assignedUserId,
            assignedUserName,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for task status changes
 */
async function captureTaskStatusChange(requestId, userId, companyId, taskId, taskDescription, statusFrom, statusTo, assignedUserName) {
    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.TASK,
        title: `Task ${statusTo}`,
        description: `Task "${taskDescription}" changed from ${statusFrom} to ${statusTo}${assignedUserName ? ` (${assignedUserName})` : ''}`,
        isSystemGenerated: true,
        isMilestone: statusTo === 'Completed',
        isVisibleToRequestor: true,
        relatedTaskId: taskId,
        statusFrom,
        statusTo,
        eventData: {
            action: 'task_status_change',
            taskId,
            taskDescription,
            statusFrom,
            statusTo,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for document/attachment events
 */
async function captureDocumentEvent(requestId, userId, companyId, action, fileName, attachmentId = null) {
    const actionTitles = {
        'uploaded': 'Document Uploaded',
        'downloaded': 'Document Downloaded', 
        'deleted': 'Document Deleted'
    };

    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.DOCUMENT,
        title: actionTitles[action] || 'Document Activity',
        description: `Document "${fileName}" has been ${action}.`,
        isSystemGenerated: true,
        isMilestone: action === 'uploaded',
        isVisibleToRequestor: true,
        relatedAttachmentId: attachmentId,
        eventData: {
            action: `document_${action}`,
            fileName,
            attachmentId,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Automatic milestone capture for form events
 */
async function captureFormEvent(requestId, userId, companyId, action, formName, formId = null) {
    const actionTitles = {
        'submitted': 'Form Submitted',
        'updated': 'Form Updated',
        'reviewed': 'Form Reviewed'
    };

    return await createMilestone({
        requestId,
        userId,
        companyId,
        progressType: PROGRESS_TYPES.FORM,
        title: actionTitles[action] || 'Form Activity',
        description: `Form "${formName}" has been ${action}.`,
        isSystemGenerated: true,
        isMilestone: action === 'submitted',
        isVisibleToRequestor: true,
        eventData: {
            action: `form_${action}`,
            formName,
            formId,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Get comprehensive milestone history for a request
 * @param {number} requestId - Request ID
 * @param {number} companyId - Company ID for security
 * @param {Object} options - Query options
 * @param {string[]} options.progressTypes - Filter by progress types
 * @param {boolean} options.milestonesOnly - Only return milestone entries
 * @param {boolean} options.visibleToRequestorOnly - Only return entries visible to requestor
 * @param {number} options.limit - Limit number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Array>} - Milestone entries with user details
 */
async function getMilestoneHistory(requestId, companyId, options = {}) {
    const {
        progressTypes = null,
        milestonesOnly = false,
        visibleToRequestorOnly = false,
        limit = null,
        offset = 0
    } = options;

    let whereClause = `WHERE wp.REQUEST_ID = ${requestId} AND wp.COMPANY_ID = ${companyId}`;
    
    if (progressTypes && progressTypes.length > 0) {
        const typeFilters = progressTypes.map(type => `'${type}'`).join(',');
        whereClause += ` AND wp.PROGRESS_TYPE IN (${typeFilters})`;
    }
    
    if (milestonesOnly) {
        whereClause += ` AND wp.IS_MILESTONE = 1`;
    }
    
    if (visibleToRequestorOnly) {
        whereClause += ` AND wp.IS_VISIBLE_TO_REQUESTOR = 1`;
    }

    const limitClause = limit ? `TOP ${limit}` : '';

    try {
        const milestones = await prisma.$queryRaw`
            SELECT ${limitClause}
                wp.WORK_PROGRESS_ID,
                wp.REQUEST_ID,
                wp.USER_ID,
                wp.COMPANY_ID,
                wp.PROGRESS_TYPE,
                wp.TITLE,
                wp.DESCRIPTION,
                wp.HOURS_WORKED,
                wp.STATUS_UPDATE,
                wp.RELATED_ATTACHMENT_ID,
                wp.IS_MILESTONE,
                wp.IS_VISIBLE_TO_REQUESTOR,
                wp.IS_SYSTEM_GENERATED,
                wp.RELATED_TASK_ID,
                wp.STATUS_FROM,
                wp.STATUS_TO,
                wp.EVENT_DATA,
                wp.CREATE_DATE,
                wp.UPDATE_DATE,
                wp.CREATE_USER_ID,
                wp.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                a.FILE_NAME as ATTACHMENT_FILE_NAME
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.USERS u ON wp.USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.ATTACHMENTS a ON wp.RELATED_ATTACHMENT_ID = a.ATTACHMENT_ID
            ${whereClause}
            ORDER BY wp.CREATE_DATE DESC
            ${offset > 0 ? `OFFSET ${offset} ROWS` : ''}
        `;

        return milestones.map(milestone => ({
            workProgressId: milestone.WORK_PROGRESS_ID,
            requestId: milestone.REQUEST_ID,
            userId: milestone.USER_ID,
            companyId: milestone.COMPANY_ID,
            progressType: milestone.PROGRESS_TYPE,
            title: milestone.TITLE,
            description: milestone.DESCRIPTION,
            hoursWorked: milestone.HOURS_WORKED ? parseFloat(milestone.HOURS_WORKED) : null,
            statusUpdate: milestone.STATUS_UPDATE,
            relatedAttachmentId: milestone.RELATED_ATTACHMENT_ID,
            isMilestone: milestone.IS_MILESTONE,
            isVisibleToRequestor: milestone.IS_VISIBLE_TO_REQUESTOR,
            isSystemGenerated: milestone.IS_SYSTEM_GENERATED,
            relatedTaskId: milestone.RELATED_TASK_ID,
            statusFrom: milestone.STATUS_FROM,
            statusTo: milestone.STATUS_TO,
            eventData: milestone.EVENT_DATA ? JSON.parse(milestone.EVENT_DATA) : null,
            createdDate: milestone.CREATE_DATE,
            updatedDate: milestone.UPDATE_DATE,
            createdBy: milestone.CREATE_USER_ID,
            updatedBy: milestone.UPDATE_USER_ID,
            userFirstName: milestone.FIRST_NAME,
            userLastName: milestone.LAST_NAME,
            userEmail: milestone.EMAIL,
            attachmentFileName: milestone.ATTACHMENT_FILE_NAME
        }));
    } catch (error) {
        console.error('L Failed to get milestone history:', error);
        throw error;
    }
}

/**
 * Get milestone statistics for a request
 */
async function getMilestoneStats(requestId, companyId) {
    try {
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as TOTAL_ENTRIES,
                COUNT(CASE WHEN IS_MILESTONE = 1 THEN 1 END) as MAJOR_MILESTONES,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 1 THEN 1 END) as SYSTEM_GENERATED,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 0 THEN 1 END) as USER_GENERATED,
                COUNT(CASE WHEN RELATED_ATTACHMENT_ID IS NOT NULL THEN 1 END) as WITH_ATTACHMENTS,
                SUM(CASE WHEN HOURS_WORKED IS NOT NULL THEN HOURS_WORKED ELSE 0 END) as TOTAL_HOURS,
                MIN(CREATE_DATE) as FIRST_ENTRY,
                MAX(CREATE_DATE) as LATEST_ENTRY,
                COUNT(DISTINCT PROGRESS_TYPE) as UNIQUE_TYPES
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
        `;

        const typeBreakdown = await prisma.$queryRaw`
            SELECT 
                PROGRESS_TYPE,
                COUNT(*) as COUNT,
                COUNT(CASE WHEN IS_MILESTONE = 1 THEN 1 END) as MILESTONES
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
            GROUP BY PROGRESS_TYPE
            ORDER BY COUNT DESC
        `;

        return {
            ...stats[0],
            TOTAL_HOURS: parseFloat(stats[0].TOTAL_HOURS || 0),
            typeBreakdown: typeBreakdown.reduce((acc, item) => {
                acc[item.PROGRESS_TYPE] = {
                    count: item.COUNT,
                    milestones: item.MILESTONES
                };
                return acc;
            }, {})
        };
    } catch (error) {
        console.error('L Failed to get milestone stats:', error);
        throw error;
    }
}

module.exports = {
    PROGRESS_TYPES,
    createMilestone,
    captureRequestCreated,
    captureRequestAssigned,
    captureStatusChange,
    captureTaskCreated,
    captureTaskStatusChange,
    captureDocumentEvent,
    captureFormEvent,
    getMilestoneHistory,
    getMilestoneStats
};