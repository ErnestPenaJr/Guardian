import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { isExternalUser, filterExternalUserData, allowExternalUser } from '../middleware/isExternalUser.js';
import multer, { FileFilterCallback, Multer } from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Allow common file types
    const allowedFileTypes = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
      '.jpg', '.jpeg', '.png', '.gif', '.txt'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Office documents, images, and text files are allowed.'));
    }
  }
});

// Validation schema for external request
const externalRequestSchema = z.object({
  requestName: z.string().min(1, 'Request name is required'),
  formId: z.number(),
  fieldValues: z.array(
    z.object({
      fieldId: z.number(),
      value: z.any()
    })
  )
});

// Get all forms available to external users
router.get('/forms', allowExternalUser, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Error fetching external forms:', error);
    res.status(500).json({ message: 'Failed to fetch external forms' });
  }
});

// Get fields for a specific external form
router.get('/forms/:id/fields', allowExternalUser, async (req: Request, res: Response) => {
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
    const formFields = await prisma.$queryRaw`
      SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, 
             f.HAS_LOOKUP, f.DISPLAY_FORMAT, ff.IS_REQUIRED
      FROM FORMS_FIELDS ff
      JOIN FIELDS f ON ff.FIELD_ID = f.FIELD_ID
      WHERE ff.FORM_ID = ${formId}
      AND f.IS_ACTIVE = 1
      AND f.IS_DELETED = 0
      ORDER BY ff.SORT_ORDER
    `;
    
    res.json(formFields);
  } catch (error) {
    console.error('Error fetching form fields:', error);
    res.status(500).json({ message: 'Failed to fetch form fields' });
  }
});

// Get all requests for the external user
router.get('/requests', isExternalUser, filterExternalUserData, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Error fetching external requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// Get a specific request for the external user
router.get('/requests/:id', isExternalUser, async (req: Request, res: Response) => {
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
      include: {
        requestor: {
          select: {
            USER_ID: true,
            FIRST_NAME: true,
            LAST_NAME: true,
            EMAIL: true
          }
        },
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
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found or not accessible' });
    }
    
    // Get form values for the request
    const formValues = await prisma.$queryRaw`
      SELECT fv.FIELD_ID, fv.FIELD_VALUE, f.FIELD_NAME, f.FIELD_TYPE_ID
      FROM FORM_VALUES fv
      JOIN FIELDS f ON fv.FIELD_ID = f.FIELD_ID
      WHERE fv.REQUEST_ID = ${requestId}
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
      REQUESTOR: request.requestor ? {
        USER_ID: request.requestor.USER_ID,
        NAME: `${request.requestor.FIRST_NAME} ${request.requestor.LAST_NAME}`,
        EMAIL: request.requestor.EMAIL
      } : null,
      ASSIGNED: request.assigned ? {
        USER_ID: request.assigned.USER_ID,
        NAME: `${request.assigned.FIRST_NAME} ${request.assigned.LAST_NAME}`,
        EMAIL: request.assigned.EMAIL
      } : null,
      FORM_VALUES: formValues,
      ATTACHMENTS: attachments
    };
    
    res.json(formattedRequest);
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ message: 'Failed to fetch request details' });
  }
});

// Create a new external request
router.post('/requests', isExternalUser, async (req: Request, res: Response) => {
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
    
    // Create form values
    if (fieldValues.length > 0) {
      await Promise.all(
        fieldValues.map(async ({ fieldId, value }) => {
          await prisma.$executeRaw`
            INSERT INTO FORM_VALUES (
              REQUEST_ID, 
              FIELD_ID, 
              FIELD_VALUE, 
              CREATE_USER_ID, 
              UPDATE_USER_ID, 
              CREATE_DATE, 
              UPDATE_DATE
            ) 
            VALUES (
              ${request.REQUEST_ID}, 
              ${fieldId}, 
              ${String(value)}, 
              ${userId}, 
              ${userId}, 
              ${new Date()}, 
              ${new Date()}
            )
          `;
        })
      );
    }
    
    res.status(201).json({
      message: 'Request created successfully',
      REQUEST_ID: request.REQUEST_ID
    });
  } catch (error) {
    console.error('Error creating external request:', error);
    res.status(500).json({ message: 'Failed to create request' });
  }
});

// Upload attachments for an external request
router.post('/requests/:id/attachments', isExternalUser, upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    // @ts-ignore
    const userId = req.user?.id;
    const files = req.files as Express.Multer.File[];
    
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
    const attachments = await Promise.all(
      files.map(async (file) => {
        const fileData = fs.readFileSync(file.path);
        
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
        
        // Delete the temporary file
        fs.unlinkSync(file.path);
        
        return attachment;
      })
    );
    
    res.status(201).json({
      message: 'Attachments uploaded successfully',
      count: attachments.length
    });
  } catch (error) {
    console.error('Error uploading attachments:', error);
    res.status(500).json({ message: 'Failed to upload attachments' });
  }
});

// Get all notices for the external user
router.get('/notices', isExternalUser, filterExternalUserData, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Get notices for the external user
    const notices = await prisma.$queryRaw`
      SELECT n.NOTICE_ID, n.NOTICE_TITLE, n.CREATED_DATE, n.STATUS
      FROM NOTICES n
      WHERE n.USER_ID = ${userId}
      AND n.EXTERNAL_USER = 'Y'
      ORDER BY n.CREATED_DATE DESC
    `;
    
    res.json(notices);
  } catch (error) {
    console.error('Error fetching external notices:', error);
    res.status(500).json({ message: 'Failed to fetch notices' });
  }
});

// Get a specific notice for the external user
router.get('/notices/:id', isExternalUser, async (req: Request, res: Response) => {
  try {
    const noticeId = parseInt(req.params.id);
    // @ts-ignore
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Get the notice
    const notice = await prisma.$queryRaw`
      SELECT n.NOTICE_ID, n.NOTICE_TITLE, n.NOTICE_TEXT, n.CREATED_DATE, n.STATUS,
             u.FIRST_NAME, u.LAST_NAME, u.EMAIL
      FROM NOTICES n
      LEFT JOIN USERS u ON n.CREATE_USER_ID = u.USER_ID
      WHERE n.NOTICE_ID = ${noticeId}
      AND n.USER_ID = ${userId}
      AND n.EXTERNAL_USER = 'Y'
    `;
    
    if (!notice || (notice as any[]).length === 0) {
      return res.status(404).json({ message: 'Notice not found or not accessible' });
    }
    
    // Get responses for the notice
    const responses = await prisma.$queryRaw`
      SELECT r.RESPONSE_ID, r.RESPONSE_TEXT, r.CREATED_DATE,
             u.FIRST_NAME, u.LAST_NAME, u.EMAIL
      FROM NOTICE_RESPONSES r
      LEFT JOIN USERS u ON r.USER_ID = u.USER_ID
      WHERE r.NOTICE_ID = ${noticeId}
      ORDER BY r.CREATED_DATE
    `;
    
    // Format the response
    const formattedNotice = {
      ...(notice as any[])[0],
      CREATED_BY: {
        NAME: `${(notice as any[])[0].FIRST_NAME} ${(notice as any[])[0].LAST_NAME}`,
        EMAIL: (notice as any[])[0].EMAIL
      },
      RESPONSES: responses
    };
    
    res.json(formattedNotice);
  } catch (error) {
    console.error('Error fetching notice details:', error);
    res.status(500).json({ message: 'Failed to fetch notice details' });
  }
});

// Respond to a notice
router.post('/notices/:id/respond', isExternalUser, async (req: Request, res: Response) => {
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
    
    // Check if notice exists and belongs to the user
    const notice = await prisma.$queryRaw`
      SELECT NOTICE_ID
      FROM NOTICES
      WHERE NOTICE_ID = ${noticeId}
      AND USER_ID = ${userId}
      AND EXTERNAL_USER = 'Y'
    `;
    
    if (!notice || (notice as any[]).length === 0) {
      return res.status(404).json({ message: 'Notice not found or not accessible' });
    }
    
    // Create the response
    await prisma.$executeRaw`
      INSERT INTO NOTICE_RESPONSES (NOTICE_ID, USER_ID, RESPONSE_TEXT, CREATED_DATE)
      VALUES (${noticeId}, ${userId}, ${responseText}, ${new Date()})
    `;
    
    res.status(201).json({ message: 'Response added successfully' });
  } catch (error) {
    console.error('Error responding to notice:', error);
    res.status(500).json({ message: 'Failed to respond to notice' });
  }
});

export default router;
