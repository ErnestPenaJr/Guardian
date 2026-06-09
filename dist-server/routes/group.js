import express from 'express';
import { isManager, filterToManagerGroup } from '../middleware/isManager.js';
const router = express.Router();
import prisma from "../prisma-client.js";
// Get all requests for manager's group
router.get('/requests/group', isManager, filterToManagerGroup, async (req, res) => {
    try {
        // @ts-ignore
        const companyFilter = req.companyFilter;
        // Build query based on filters
        const whereClause = {};
        // If manager, filter by company
        if (companyFilter) {
            whereClause.COMPANY_ID = companyFilter;
        }
        // Get requests with requestor and assigned user details
        const requests = await prisma.rEQUESTS.findMany({
            where: whereClause,
            orderBy: { SUBMITTED_DATE: 'desc' },
            select: {
                REQUEST_ID: true,
                REQUEST_NAME: true,
                SUBMITTED_DATE: true,
                STATUS: true,
                REQUESTOR_ID: true,
                ASSIGNED_ID: true,
                TRACKINGID: true
            }
        });
        // Format the response
        const formattedRequests = requests.map(request => ({
            REQUEST_ID: request.REQUEST_ID,
            REQUEST_NAME: request.REQUEST_NAME,
            SUBMITTED_DATE: request.SUBMITTED_DATE,
            STATUS: request.STATUS,
            REQUESTOR_ID: request.REQUESTOR_ID,
            ASSIGNED_ID: request.ASSIGNED_ID,
            REQUESTOR_NAME: request.REQUESTOR_ID ? `User ID: ${request.REQUESTOR_ID}` : null,
            ASSIGNED_NAME: request.ASSIGNED_ID ? `User ID: ${request.ASSIGNED_ID}` : null,
            TRACKINGID: request.TRACKINGID
        }));
        res.json(formattedRequests);
    }
    catch (error) {
        console.error('Error fetching group requests:', error);
        res.status(500).json({ message: 'Failed to fetch group requests' });
    }
});
// Get all notices for manager's group
router.get('/notices/group', isManager, filterToManagerGroup, async (req, res) => {
    try {
        // @ts-ignore
        const companyFilter = req.companyFilter;
        // Build query based on filters
        const whereClause = {};
        // If manager, filter by company
        if (companyFilter) {
            whereClause.COMPANY_ID = companyFilter;
        }
        // Get notices with created by user details
        // SCHEMA DRIFT REPAIRS: NOTICES.NOTICE_TITLE→TITLE, NOTICES.CREATED_DATE→ISSUE_DATE;
        // table refs now schema-qualified; companyFilter injection replaced with Prisma param.
        const notices = companyFilter
            ? await prisma.$queryRaw `
          SELECT n."NOTICE_ID", n."TITLE" AS "NOTICE_TITLE", n."ISSUE_DATE" AS "CREATED_DATE", n."STATUS",
                 u."FIRST_NAME", u."LAST_NAME", u."EMAIL"
          FROM "GUARDIAN"."NOTICES" n
          LEFT JOIN "GUARDIAN"."USERS" u ON n."CREATE_USER_ID" = u."USER_ID"
          WHERE n."COMPANY_ID" = ${companyFilter}
          ORDER BY n."ISSUE_DATE" DESC
        `
            : await prisma.$queryRaw `
          SELECT n."NOTICE_ID", n."TITLE" AS "NOTICE_TITLE", n."ISSUE_DATE" AS "CREATED_DATE", n."STATUS",
                 u."FIRST_NAME", u."LAST_NAME", u."EMAIL"
          FROM "GUARDIAN"."NOTICES" n
          LEFT JOIN "GUARDIAN"."USERS" u ON n."CREATE_USER_ID" = u."USER_ID"
          ORDER BY n."ISSUE_DATE" DESC
        `;
        // Format the response
        const formattedNotices = notices.map((notice) => ({
            NOTICE_ID: notice.NOTICE_ID,
            NOTICE_TITLE: notice.NOTICE_TITLE,
            CREATED_DATE: notice.CREATED_DATE,
            STATUS: notice.STATUS,
            CREATED_BY_NAME: notice.FIRST_NAME && notice.LAST_NAME ? `${notice.FIRST_NAME} ${notice.LAST_NAME}` : null
        }));
        res.json(formattedNotices);
    }
    catch (error) {
        console.error('Error fetching group notices:', error);
        res.status(500).json({ message: 'Failed to fetch group notices' });
    }
});
// Get all tasks for manager's group
router.get('/tasks/group', isManager, filterToManagerGroup, async (req, res) => {
    try {
        // @ts-ignore
        const companyFilter = req.companyFilter;
        // Build query based on filters
        const whereClause = {};
        // If manager, filter by company
        if (companyFilter) {
            whereClause.COMPANY_ID = companyFilter;
        }
        // Get tasks with assigned user details
        const tasks = await prisma.tASKS.findMany({
            where: whereClause,
            orderBy: { CREATE_DATE: 'desc' },
            // @ts-ignore - Prisma type issue with include
            include: {
                assigned: {
                    select: {
                        USER_ID: true,
                        FIRST_NAME: true,
                        LAST_NAME: true,
                        EMAIL: true
                    }
                }
            }
        });
        // Format the response
        const formattedTasks = tasks.map((task) => ({
            TASK_ID: task.TASK_ID,
            DESCRIPTION: task.DESCRIPTION || '',
            STATUS: task.STATUS,
            ASSIGNED_USER_ID: task.ASSIGNED_USER_ID,
            ASSIGNED_USER_NAME: task.assigned ? `${task.assigned.FIRST_NAME} ${task.assigned.LAST_NAME}` : null,
            CREATE_DATE: task.CREATE_DATE,
            TRACKINGID: task.TRACKINGID
        }));
        res.json(formattedTasks);
    }
    catch (error) {
        console.error('Error fetching group tasks:', error);
        res.status(500).json({ message: 'Failed to fetch group tasks' });
    }
});
// Get all users for manager's group
router.get('/users/group', isManager, filterToManagerGroup, async (req, res) => {
    try {
        // @ts-ignore
        const companyFilter = req.companyFilter;
        // Build query based on filters
        const whereClause = {};
        // If manager, filter by company
        if (companyFilter) {
            whereClause.COMPANY_ID = companyFilter;
        }
        // Get users in the manager's group
        const users = await prisma.uSERS.findMany({
            where: whereClause,
            orderBy: { LAST_NAME: 'asc' },
            select: {
                USER_ID: true,
                FIRST_NAME: true,
                LAST_NAME: true,
                EMAIL: true,
                STATUS: true,
                COMPANY_ID: true
            }
        });
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching group users:', error);
        res.status(500).json({ message: 'Failed to fetch group users' });
    }
});
export default router;
