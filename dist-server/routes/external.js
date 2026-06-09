import express from 'express';
import { z } from 'zod';
import { isExternalUser, filterExternalUserData, allowExternalUser } from '../middleware/isExternalUser.js';
import multer from 'multer';
import path from 'path';
const router = express.Router();
import prisma from "../prisma-client.js";
// Set up multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 6 * 1024 * 1024, // ~6MB — Netlify Functions request-body cap
    },
    fileFilter: (req, file, cb) => {
        const allowedFileTypes = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.jpg', '.jpeg', '.png', '.gif', '.txt'
        ];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedFileTypes.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF, Office documents, images, and text files are allowed.'));
        }
    }
});
// Validation schema for external request
const externalRequestSchema = z.object({
    requestName: z.string().min(1, 'Request name is required'),
    formId: z.number(),
    fieldValues: z.array(z.object({
        fieldId: z.number(),
        value: z.any()
    }))
});
// Get all forms available to external users
router.get('/forms', allowExternalUser, async (req, res) => {
    try {
        // Get forms marked as available to external users
        const externalForms = await prisma.fORMS.findMany({
            where: {
                IS_PUBLIC: true,
                IS_ACTIVE: true,
                IS_DELETED: false
            },
            select: {
                FORM_ID: true,
                FORM_NAME: true,
                FORM_DESCRIPTION: true
            },
            orderBy: {
                FORM_NAME: 'asc'
            }
        });
        res.json(externalForms);
    }
    catch (error) {
        console.error('Error fetching external forms:', error);
        res.status(500).json({ message: 'Failed to fetch external forms' });
    }
});
// Get fields for a specific external form
router.get('/forms/:id/fields', allowExternalUser, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        // Check if form exists and is available to external users
        const form = await prisma.fORMS.findFirst({
            where: {
                FORM_ID: formId,
                IS_PUBLIC: true,
                IS_ACTIVE: true,
                IS_DELETED: false
            }
        });
        if (!form) {
            return res.status(404).json({ message: 'Form not found or not available to external users' });
        }
        // Get form fields
        const formFields = await prisma.$queryRaw `
      SELECT f."FIELD_ID", f."FIELD_NAME", f."FIELD_TYPE_ID",
             f."HAS_LOOKUP", f."DISPLAY_FORMAT", ff."IS_REQUIRED"
      FROM "GUARDIAN"."FORMS_FIELDS" ff
      JOIN "GUARDIAN"."FIELDS" f ON ff."FIELD_ID" = f."FIELD_ID"
      WHERE ff."FORM_ID" = ${formId}
      AND f."IS_ACTIVE" = true
      AND f."IS_DELETED" = false
      ORDER BY ff."SORT_ORDER"
    `;
        res.json(formFields);
    }
    catch (error) {
        console.error('Error fetching form fields:', error);
        res.status(500).json({ message: 'Failed to fetch form fields' });
    }
});
// Get all requests for the external user
router.get('/requests', isExternalUser, filterExternalUserData, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Get requests created by the external user
        const requests = await prisma.rEQUESTS.findMany({
            where: {
                REQUESTOR_ID: userId,
                EXTERNAL_USER: 'Y'
            },
            orderBy: {
                SUBMITTED_DATE: 'desc'
            },
            select: {
                REQUEST_ID: true,
                REQUEST_NAME: true,
                SUBMITTED_DATE: true,
                STATUS: true
            }
        });
        res.json(requests);
    }
    catch (error) {
        console.error('Error fetching external requests:', error);
        res.status(500).json({ message: 'Failed to fetch requests' });
    }
});
// Get a specific request for the external user
router.get('/requests/:id', isExternalUser, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Get the request
        const request = await prisma.rEQUESTS.findFirst({
            where: {
                REQUEST_ID: requestId,
                REQUESTOR_ID: userId,
                EXTERNAL_USER: 'Y'
            },
            select: {
                REQUEST_ID: true,
                REQUEST_NAME: true,
                SUBMITTED_DATE: true,
                STATUS: true,
                REQUESTOR_ID: true,
                ASSIGNED_ID: true,
                EXTERNAL_USER: true
            }
        });
        if (!request) {
            return res.status(404).json({ message: 'Request not found or not accessible' });
        }
        // Get form values for the request
        // NOTE: PG has no FORM_VALUES table; values live in FORMS_INSTANCE_VALUES via FORMS_INSTANCE
        const formValues = await prisma.$queryRaw `
      SELECT fv."FIELD_ID", fv."VALUE" AS "FIELD_VALUE", f."FIELD_NAME", f."FIELD_TYPE_ID"
      FROM "GUARDIAN"."FORMS_INSTANCE_VALUES" fv
      JOIN "GUARDIAN"."FORMS_INSTANCE" fi ON fi."FORM_INSTANCE_ID" = fv."FORM_INSTANCE_ID"
      JOIN "GUARDIAN"."FIELDS" f ON fv."FIELD_ID" = f."FIELD_ID"
      WHERE fi."REQUEST_ID" = ${requestId}
    `;
        // Get attachments for the request
        const attachments = await prisma.aTTACHMENTS.findMany({
            where: {
                REQUEST_ID: requestId
            },
            select: {
                ATTACHMENT_ID: true,
                FILE_NAME: true,
                CREATE_DATE: true
            }
        });
        // Format the response
        const formattedRequest = {
            REQUEST_ID: request.REQUEST_ID,
            REQUEST_NAME: request.REQUEST_NAME,
            SUBMITTED_DATE: request.SUBMITTED_DATE,
            STATUS: request.STATUS,
            REQUESTOR_ID: request.REQUESTOR_ID,
            ASSIGNED_ID: request.ASSIGNED_ID,
            FORM_VALUES: formValues,
            ATTACHMENTS: attachments
        };
        res.json(formattedRequest);
    }
    catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({ message: 'Failed to fetch request details' });
    }
});
// Create a new external request
router.post('/requests', isExternalUser, async (req, res) => {
    try {
        // Validate input
        const validationResult = externalRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: 'Invalid request data',
                errors: validationResult.error.errors
            });
        }
        const { requestName, formId, fieldValues } = validationResult.data;
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Check if form exists and is available to external users
        const form = await prisma.fORMS.findFirst({
            where: {
                FORM_ID: formId,
                IS_PUBLIC: true,
                IS_ACTIVE: true,
                IS_DELETED: false
            }
        });
        if (!form) {
            return res.status(404).json({ message: 'Form not found or not available to external users' });
        }
        // Create the request
        const request = await prisma.rEQUESTS.create({
            data: {
                REQUEST_NAME: requestName,
                EXTERNAL_USER: 'Y',
                SUBMITTED_DATE: new Date(),
                REQUESTOR_ID: userId,
                STATUS: 'P', // Pending
                CREATE_USER_ID: userId,
                UPDATE_USER_ID: userId,
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date()
            }
        });
        // Create form values via FORMS_INSTANCE + FORMS_INSTANCE_VALUES
        // PG has no legacy FORM_VALUES table; values are stored per form instance.
        if (fieldValues.length > 0) {
            // Create a form instance linked to the request
            const instanceResult = await prisma.$queryRaw `
        INSERT INTO "GUARDIAN"."FORMS_INSTANCE"
          ("REQUEST_ID", "CREATE_USER_ID", "UPDATE_USER_ID", "CREATE_DATE", "UPDATE_DATE")
        VALUES
          (${request.REQUEST_ID}, ${userId}, ${userId}, ${new Date()}, ${new Date()})
        RETURNING "FORM_INSTANCE_ID"
      `;
            const formInstanceId = instanceResult[0]["FORM_INSTANCE_ID"];
            await Promise.all(fieldValues.map(async ({ fieldId, value }) => {
                await prisma.$executeRaw `
            INSERT INTO "GUARDIAN"."FORMS_INSTANCE_VALUES"
              ("FORM_INSTANCE_ID", "FIELD_ID", "VALUE", "CREATE_USER_ID", "UPDATE_USER_ID", "CREATE_DATE", "UPDATE_DATE")
            VALUES
              (${formInstanceId}, ${fieldId}, ${String(value)}, ${userId}, ${userId}, ${new Date()}, ${new Date()})
          `;
            }));
        }
        res.status(201).json({
            message: 'Request created successfully',
            REQUEST_ID: request.REQUEST_ID
        });
    }
    catch (error) {
        console.error('Error creating external request:', error);
        res.status(500).json({ message: 'Failed to create request' });
    }
});
// Upload attachments for an external request
router.post('/requests/:id/attachments', isExternalUser, upload.array('files', 5), async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        // @ts-ignore
        const userId = req.user?.id;
        const files = req.files;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Check if request exists and belongs to the user
        const request = await prisma.rEQUESTS.findFirst({
            where: {
                REQUEST_ID: requestId,
                REQUESTOR_ID: userId,
                EXTERNAL_USER: 'Y'
            }
        });
        if (!request) {
            return res.status(404).json({ message: 'Request not found or not accessible' });
        }
        // Save attachments to database
        const attachments = await Promise.all(files.map(async (file) => {
            const fileData = file.buffer;
            const attachment = await prisma.aTTACHMENTS.create({
                data: {
                    REQUEST_ID: requestId,
                    FILE_NAME: file.originalname,
                    ATTACHMENT: Buffer.from(fileData),
                    CREATE_USER_ID: userId,
                    UPDATE_USER_ID: userId,
                    CREATE_DATE: new Date(),
                    UPDATE_DATE: new Date()
                }
            });
            return attachment;
        }));
        res.status(201).json({
            message: 'Attachments uploaded successfully',
            count: attachments.length
        });
    }
    catch (error) {
        console.error('Error uploading attachments:', error);
        res.status(500).json({ message: 'Failed to upload attachments' });
    }
});
// Get all notices for the external user
router.get('/notices', isExternalUser, filterExternalUserData, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Get notices for the external user via NOTICE_RECIPIENTS join
        // PG NOTICES has TITLE/ISSUE_DATE (not NOTICE_TITLE/CREATED_DATE), no USER_ID/EXTERNAL_USER cols
        const notices = await prisma.$queryRaw `
      SELECT n."NOTICE_ID", n."TITLE" AS "NOTICE_TITLE", n."ISSUE_DATE" AS "CREATED_DATE", n."STATUS"
      FROM "GUARDIAN"."NOTICES" n
      JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON nr."NOTICE_ID" = n."NOTICE_ID"
      WHERE nr."RECIPIENT_USER_ID" = ${userId}
      ORDER BY n."ISSUE_DATE" DESC
    `;
        res.json(notices);
    }
    catch (error) {
        console.error('Error fetching external notices:', error);
        res.status(500).json({ message: 'Failed to fetch notices' });
    }
});
// Get a specific notice for the external user
router.get('/notices/:id', isExternalUser, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Get the notice (PG: TITLE/CONTENT/ISSUE_DATE; join NOTICE_RECIPIENTS for user scoping)
        const notice = await prisma.$queryRaw `
      SELECT n."NOTICE_ID", n."TITLE" AS "NOTICE_TITLE", n."CONTENT" AS "NOTICE_TEXT",
             n."ISSUE_DATE" AS "CREATED_DATE", n."STATUS",
             u."FIRST_NAME", u."LAST_NAME", u."EMAIL"
      FROM "GUARDIAN"."NOTICES" n
      LEFT JOIN "GUARDIAN"."USERS" u ON n."CREATE_USER_ID" = u."USER_ID"
      JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON nr."NOTICE_ID" = n."NOTICE_ID"
      WHERE n."NOTICE_ID" = ${noticeId}
      AND nr."RECIPIENT_USER_ID" = ${userId}
    `;
        if (!notice || notice.length === 0) {
            return res.status(404).json({ message: 'Notice not found or not accessible' });
        }
        // Get responses for the notice (PG: NOTICE_RESPONSE_ID/RESPONSE_MESSAGE/RESPONSE_DATE)
        const responses = await prisma.$queryRaw `
      SELECT r."NOTICE_RESPONSE_ID" AS "RESPONSE_ID", r."RESPONSE_MESSAGE" AS "RESPONSE_TEXT",
             r."RESPONSE_DATE" AS "CREATED_DATE",
             u."FIRST_NAME", u."LAST_NAME", u."EMAIL"
      FROM "GUARDIAN"."NOTICE_RESPONSES" r
      LEFT JOIN "GUARDIAN"."USERS" u ON r."USER_ID" = u."USER_ID"
      WHERE r."NOTICE_ID" = ${noticeId}
      ORDER BY r."RESPONSE_DATE"
    `;
        // Format the response
        const formattedNotice = {
            ...notice[0],
            CREATED_BY: {
                NAME: `${notice[0].FIRST_NAME} ${notice[0].LAST_NAME}`,
                EMAIL: notice[0].EMAIL
            },
            RESPONSES: responses
        };
        res.json(formattedNotice);
    }
    catch (error) {
        console.error('Error fetching notice details:', error);
        res.status(500).json({ message: 'Failed to fetch notice details' });
    }
});
// Respond to a notice
router.post('/notices/:id/respond', isExternalUser, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        // @ts-ignore
        const userId = req.user?.id;
        const { responseText } = req.body;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (!responseText || typeof responseText !== 'string' || responseText.trim() === '') {
            return res.status(400).json({ message: 'Response text is required' });
        }
        // Check if notice exists and is accessible to user (via NOTICE_RECIPIENTS)
        const notice = await prisma.$queryRaw `
      SELECT n."NOTICE_ID"
      FROM "GUARDIAN"."NOTICES" n
      JOIN "GUARDIAN"."NOTICE_RECIPIENTS" nr ON nr."NOTICE_ID" = n."NOTICE_ID"
      WHERE n."NOTICE_ID" = ${noticeId}
      AND nr."RECIPIENT_USER_ID" = ${userId}
    `;
        if (!notice || notice.length === 0) {
            return res.status(404).json({ message: 'Notice not found or not accessible' });
        }
        // Create the response (PG: RESPONSE_MESSAGE/RESPONSE_DATE, schema-qualified)
        await prisma.$executeRaw `
      INSERT INTO "GUARDIAN"."NOTICE_RESPONSES" ("NOTICE_ID", "USER_ID", "RESPONSE_MESSAGE", "RESPONSE_DATE", "CREATE_DATE", "UPDATE_DATE")
      VALUES (${noticeId}, ${userId}, ${responseText}, ${new Date()}, ${new Date()}, ${new Date()})
    `;
        res.status(201).json({ message: 'Response added successfully' });
    }
    catch (error) {
        console.error('Error responding to notice:', error);
        res.status(500).json({ message: 'Failed to respond to notice' });
    }
});
export default router;
