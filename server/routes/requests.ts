import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../auth.js';

const prisma = new PrismaClient();
const router = express.Router();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Database schema name - this is the only fixed constant
const DB_SCHEMA = 'GUARDIAN';

const escapeSqlValue = (value: string) => value.replace(/'/g, "''");

// Allow-list of valid STATUS values derived from CK_REQUEST_STATUS CHECK constraint.
const VALID_REQUEST_STATUS = ['R', 'H', 'X', 'I', 'D', 'A', 'P'] as const;

const getRequestCompanyClause = (companyId: number) =>
  companyId > 0 ? ` AND "COMPANY_ID" = ${companyId}` : '';

const SUBJECT_PHOTO_FIELD_NAME = 'subject photo image';
const PHOTO_REF_PREFIX = 'photo_ref:';
const SUBJECT_PHOTO_FILE_PREFIX = '__subject_photo__::';
const contentTypeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

const getContentType = (fileName: string) =>
  contentTypeByExtension[path.extname(fileName).toLowerCase()] || 'application/octet-stream';

function normalizeAttachmentBinary(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, byte]) => /^\d+$/.test(key) && typeof byte === 'number')
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (entries.length > 0) {
      return Buffer.from(entries.map(([, byte]) => Number(byte)));
    }
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeAttachmentBinary(parsed);
      if (normalized) return normalized;
    } catch {
      return Buffer.from(value, 'base64');
    }
  }

  return null;
}

type RequestRecord = {
  REQUEST_ID: number;
  FORM_ID: number | null;
  CREATE_DATE: Date | string | null;
  COMPANY_ID: number | null;
  CREATE_USER_ID: number | null;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  UPDATE_USER_ID: number | null;
};

async function resolveFormInstanceIdForRequest(requestData: RequestRecord): Promise<number | null> {
  if (!requestData.FORM_ID) return null;

  const candidateUserIds = [
    requestData.CREATE_USER_ID,
    requestData.REQUESTOR_ID,
    requestData.ASSIGNED_ID,
    requestData.UPDATE_USER_ID,
  ]
    .filter((value): value is number => typeof value === 'number' && value > 0);

  const userIdClause = candidateUserIds.length > 0
    ? `AND (
        fi.CREATE_USER_ID IN (${candidateUserIds.join(',')})
        OR fi.ASSIGNED_ID IN (${candidateUserIds.join(',')})
      )`
    : '';

  const companyIdClause = requestData.COMPANY_ID
    ? `AND fi.COMPANY_ID = ${Number(requestData.COMPANY_ID)}`
    : '';

  const createDateValue = requestData.CREATE_DATE
    ? `'${new Date(requestData.CREATE_DATE).toISOString().slice(0, 19).replace('T', ' ')}'`
    : 'now()';

  const rows = await prisma.$queryRawUnsafe(`
    SELECT fi."FORM_INSTANCE_ID"
    FROM "GUARDIAN"."FORMS_INSTANCE" fi
    WHERE fi."FORM_ID" = ${requestData.FORM_ID}
      ${companyIdClause}
      ${userIdClause}
    ORDER BY
      CASE WHEN fi."CREATE_USER_ID" = ${requestData.CREATE_USER_ID || 0} THEN 0 ELSE 1 END,
      CASE WHEN fi."ASSIGNED_ID" = ${requestData.REQUESTOR_ID || 0} THEN 0 ELSE 1 END,
      ABS(EXTRACT(EPOCH FROM (fi."CREATE_DATE" - ${createDateValue}::timestamp))) ASC,
      fi."FORM_INSTANCE_ID" ASC
    LIMIT 1
  `) as Array<{ FORM_INSTANCE_ID: number }>;

  return rows.length > 0 ? rows[0].FORM_INSTANCE_ID : null;
}

async function getSubjectPhotoAttachmentIdForRequest(requestData: RequestRecord): Promise<number | null> {
  const formInstanceId = await resolveFormInstanceIdForRequest(requestData);
  if (!formInstanceId) return null;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT fiv."VALUE"
    FROM "GUARDIAN"."FORMS_INSTANCE_VALUES" fiv
    JOIN "GUARDIAN"."FIELDS" f
      ON f."FIELD_ID" = fiv."FIELD_ID"
    WHERE fiv."FORM_INSTANCE_ID" = ${formInstanceId}
      AND LOWER(TRIM(f."FIELD_NAME")) = '${SUBJECT_PHOTO_FIELD_NAME}'
      AND fiv."VALUE" LIKE '${PHOTO_REF_PREFIX}%'
    ORDER BY fiv."UPDATE_DATE" DESC
    LIMIT 1
  `) as Array<{ VALUE: string | null }>;

  if (!rows.length || !rows[0].VALUE?.startsWith(PHOTO_REF_PREFIX)) {
    return null;
  }

  const attachmentId = parseInt(rows[0].VALUE.slice(PHOTO_REF_PREFIX.length), 10);
  return Number.isNaN(attachmentId) ? null : attachmentId;
}

async function getDedicatedSubjectPhotoAttachmentForRequest(requestId: number) {
  return prisma.aTTACHMENTS.findFirst({
    where: {
      REQUEST_ID: requestId,
      FILE_NAME: {
        startsWith: SUBJECT_PHOTO_FILE_PREFIX,
      },
    },
    orderBy: [
      { CREATE_DATE: 'desc' },
      { ATTACHMENT_ID: 'desc' },
    ],
    select: {
      ATTACHMENT_ID: true,
      FILE_NAME: true,
      ATTACHMENT: true,
      CREATE_DATE: true,
    },
  });
}

async function getActiveSubjectPhotoAttachmentForRequest(requestData: RequestRecord) {
  const dedicated = await getDedicatedSubjectPhotoAttachmentForRequest(requestData.REQUEST_ID);
  if (dedicated) {
    return dedicated;
  }

  const legacyAttachmentId = await getSubjectPhotoAttachmentIdForRequest(requestData);
  if (!legacyAttachmentId) {
    return null;
  }

  return prisma.aTTACHMENTS.findUnique({
    where: { ATTACHMENT_ID: legacyAttachmentId },
    select: {
      ATTACHMENT_ID: true,
      FILE_NAME: true,
      ATTACHMENT: true,
      CREATE_DATE: true,
    },
  });
}

// Define interfaces for user types
interface UserCompany {
  id: number;
  name: string;
}

interface UserRole {
  id: number;
  name: string;
  displayName: string;
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles?: UserRole[];
  company?: UserCompany;
  role?: string;
}

// Helper function to extract user information from the request
const getUserInfoFromRequest = (req: Request) => {
  // Default values as fallback
  const defaults = {
    userId: 0,
    companyId: 0,
    formId: 1,
    status: 'P' // Set default status to 'P' for pending
  };
  
  try {
    // First, check if user info is in the request object (added by auth middleware)
    if (req.user) {
      console.log('User info found in request object:', req.user);
      // Cast to our User interface
      const user = req.user as unknown as User;
      
      return {
        userId: user.id || defaults.userId,
        companyId: (user as any).COMPANY_ID || user.company?.id || defaults.companyId,
        formId: defaults.formId,
        status: defaults.status
      };
    }
    
    // If not in request object, try to get from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header found');
      
      // As a fallback, check if user info is in the request body
      // This is not secure but helps with testing
      if (req.body && (req.body.userId || req.body.companyId)) {
        console.log('Using user info from request body as fallback');
        return {
          userId: req.body.userId || defaults.userId,
          companyId: req.body.companyId || defaults.companyId,
          formId: defaults.formId,
          status: defaults.status
        };
      }
      
      return defaults;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('No token found in authorization header');
      return defaults;
    }
    
    // For debugging - log that we're trying to extract user info
    console.log('Attempting to extract user info from token:', token.substring(0, 10) + '...');
    
    // Decode the JWT token
    try {
      // Note: In production, you should verify the token with a secret
      // For now, we'll just decode it without verification
      const decoded = jwt.decode(token) as any;
      console.log('Decoded token:', decoded);
      
      if (decoded) {
        // Extract user ID and company ID from the token
        const userId = decoded.id || 0;
        // Check both possible locations for company ID
        const companyId = decoded.COMPANY_ID || decoded.companyId || 
                         (decoded.company ? decoded.company.id : 0);
        
        console.log(`Extracted from token - userId: ${userId}, companyId: ${companyId}`);
        
        return {
          userId: userId || defaults.userId,
          companyId: companyId || defaults.companyId,
          formId: defaults.formId,
          status: defaults.status
        };
      }
    } catch (jwtError) {
      console.error('Error decoding JWT token:', jwtError);
    }
    
    // If token decoding fails, fall back to request body
    const { userId, companyId } = req.body;
    
    return {
      userId: userId || defaults.userId,
      companyId: companyId || defaults.companyId,
      formId: defaults.formId,
      status: defaults.status
    };
  } catch (error) {
    console.error('Error extracting user info:', error);
    return defaults;
  }
}

// Pure SQL endpoint for request creation - no Prisma models
router.post('/sql-request', async (req: Request, res: Response) => {
    try {
      console.log('=== SQL REQUEST START ===');
      console.log('Received request body:', req.body);
      
      // Get user info from request
      const userInfo = getUserInfoFromRequest(req);
      console.log('Extracted user info:', userInfo);
      
      const { 
        name, 
        abbreviation = '', 
        description = '', 
        templateId = userInfo.formId
      } = req.body;
      
      // Always use the user ID and company ID from the authenticated user
      const companyId = userInfo.companyId;
      const userId = userInfo.userId;
      
      // Enhanced validation with detailed error messages
      const validationErrors: string[] = [];
      
      if (!name || name.trim() === '') {
        validationErrors.push('Request name is required');
      }
      
      if (validationErrors.length > 0) {
        console.error('Validation errors:', validationErrors);
        return res.status(400).json({ 
          error: validationErrors.join('. '), 
          details: validationErrors,
          requestData: req.body
        });
      }
      
      // Convert values to appropriate types
      const numericTemplateId = Number(templateId);
      const numericCompanyId = Number(companyId);
      const numericUserId = Number(userId);
      
      // Validate that we have the required user information
      if (numericCompanyId <= 0) {
        return res.status(400).json({ 
          error: 'Missing company ID', 
          message: 'Your user account is not associated with a company',
          userInfo
        });
      }
      
      if (numericUserId <= 0) {
        return res.status(400).json({ 
          error: 'Missing user ID', 
          message: 'Could not determine your user ID',
          userInfo
        });
      }
      
      // Use a transaction to ensure both operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        try {
          // Step 1: Create a request using INSERT...RETURNING to atomically retrieve the new ID
          const idResult = await tx.$queryRawUnsafe(`
            INSERT INTO "GUARDIAN"."REQUESTS" (
              "REQUEST_NAME",
              "REQUEST_DESCRIPTION",
              "ABBREVIATION",
              "STATUS",
              "SUBMITTED_DATE",
              "CREATE_USER_ID",
              "UPDATE_USER_ID",
              "CREATE_DATE",
              "UPDATE_DATE",
              "COMPANY_ID",
              "FORM_ID",
              "REQUESTOR_ID"
            ) VALUES (
              '${name.replace(/'/g, "''")}',
              '${description.replace(/'/g, "''")}',
              '${abbreviation.replace(/'/g, "''")}',
              '${userInfo.status}',
              now(),
              ${numericUserId},
              ${numericUserId},
              now(),
              now(),
              ${numericCompanyId},
              ${numericTemplateId},
              ${numericUserId}
            ) RETURNING "REQUEST_ID"
          `);

          const requestId = Array.isArray(idResult) && idResult.length > 0
            ? Number(idResult[0].REQUEST_ID)
            : 0;

          console.log('Created request with ID:', requestId);

          // Step 2: Create a form instance using INSERT...RETURNING to atomically retrieve the new ID
          const formIdResult = await tx.$queryRawUnsafe(`
            INSERT INTO "GUARDIAN"."FORMS_INSTANCE" (
              "FORM_ID",
              "ASSIGNED_ID",
              "SUBMITTED_DATE",
              "UPDATE_USER_ID",
              "CREATE_DATE",
              "UPDATE_DATE"
            ) VALUES (
              ${numericTemplateId},
              ${numericUserId},
              now(),
              ${numericUserId},
              now(),
              now()
            ) RETURNING "FORM_INSTANCE_ID"
          `);

          const formInstanceId = Array.isArray(formIdResult) && formIdResult.length > 0
            ? Number(formIdResult[0].FORM_INSTANCE_ID)
            : 0;

          console.log('Created form instance with ID:', formInstanceId);
          
          return {
            success: true,
            request: { REQUEST_ID: requestId, REQUEST_NAME: name },
            formInstance: { FORM_INSTANCE_ID: formInstanceId }
          };
        } catch (sqlError) {
          console.error('SQL error:', sqlError);
          throw sqlError;
        }
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error in SQL request endpoint:', error);
      res.status(500).json({
        error: 'Error creating request',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      });
    }
  });
// Simple endpoint to create a request using raw SQL queries
router.post('/simple-request', async (req: Request, res: Response) => {
    try {
      console.log('=== SIMPLE REQUEST START ===');
      console.log('Received request body:', JSON.stringify(req.body, null, 2));
      
      // Get user info from request
      const userInfo = getUserInfoFromRequest(req);
      console.log('Extracted user info:', userInfo);
      
      const { 
        name, 
        abbreviation = '', 
        description = '',
        templateId = userInfo.formId
      } = req.body;
      
      // Always use the user ID and company ID from the authenticated user
      const companyId = userInfo.companyId;
      const userId = userInfo.userId;
      
      // Enhanced validation with detailed error messages
      const validationErrors: string[] = [];
      
      if (!name || name.trim() === '') {
        validationErrors.push('Request name is required');
      }
      
      if (validationErrors.length > 0) {
        console.error('Validation errors:', validationErrors);
        return res.status(400).json({ 
          error: validationErrors.join('. '), 
          details: validationErrors,
          requestData: req.body
        });
      }
      
      // Convert values to appropriate types
      const numericTemplateId = Number(templateId);
      const numericCompanyId = Number(companyId);
      const numericUserId = Number(userId);
      
      // Validate that we have the required user information
      if (numericCompanyId <= 0) {
        return res.status(400).json({ 
          error: 'Missing company ID', 
          message: 'Your user account is not associated with a company',
          userInfo
        });
      }
      
      if (numericUserId <= 0) {
        return res.status(400).json({ 
          error: 'Missing user ID', 
          message: 'Could not determine your user ID',
          userInfo
        });
      }
      
      // Use a transaction to ensure both operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Create a request using INSERT...RETURNING to atomically retrieve the new ID
        const requestResults = await tx.$queryRaw`
          INSERT INTO "GUARDIAN"."REQUESTS" (
            "REQUEST_NAME",
            "COMPANY_ID",
            "STATUS",
            "SUBMITTED_DATE",
            "UPDATE_USER_ID",
            "CREATE_DATE",
            "UPDATE_DATE",
            "ABBREVIATION",
            "FORM_ID"
          ) VALUES (
            ${name},
            ${numericCompanyId},
            ${userInfo.status},
            now(),
            ${numericUserId},
            now(),
            now(),
            ${abbreviation},
            ${numericTemplateId}
          ) RETURNING "REQUEST_ID"
        `;

        const requestId = Array.isArray(requestResults) && requestResults.length > 0
          ? Number(requestResults[0].REQUEST_ID)
          : 0;

        console.log('Created request with ID:', requestId);

        // Step 2: Create a form instance using INSERT...RETURNING to atomically retrieve the new ID
        const formInstanceResults = await tx.$queryRaw`
          INSERT INTO "GUARDIAN"."FORMS_INSTANCE" (
            "FORM_ID",
            "ASSIGNED_ID",
            "SUBMITTED_DATE",
            "UPDATE_USER_ID",
            "CREATE_DATE",
            "UPDATE_DATE"
          ) VALUES (
            ${numericTemplateId},
            ${numericUserId},
            now(),
            ${numericUserId},
            now(),
            now()
          ) RETURNING "FORM_INSTANCE_ID"
        `;

        const formInstanceId = Array.isArray(formInstanceResults) && formInstanceResults.length > 0
          ? Number(formInstanceResults[0].FORM_INSTANCE_ID)
          : 0;

        console.log('Created form instance with ID:', formInstanceId);
        
        return {
          request: { REQUEST_ID: requestId, REQUEST_NAME: name },
          formInstance: { FORM_INSTANCE_ID: formInstanceId }
        };
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error in simple request endpoint:', error);
      res.status(500).json({
        error: 'Error creating request',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      });
    }
  });
// Diagnostic endpoint to check database schema
router.get('/debug/schema', async (req: Request, res: Response) => {
    try {
      // Get a list of all tables in the database
      const tables = await prisma.$queryRaw`
        SELECT TABLE_SCHEMA, TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `;
      
      // Get the schema for the REQUESTS table
      const requestsSchema = await prisma.$queryRaw`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'REQUESTS'
        ORDER BY ORDINAL_POSITION
      `;
      
      // Get the schema for the FORMS_INSTANCE table
      const formsInstanceSchema = await prisma.$queryRaw`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'FORMS_INSTANCE'
        ORDER BY ORDINAL_POSITION
      `;
      
      // Return the schema information
      res.status(200).json({
        tables,
        requestsSchema,
        formsInstanceSchema
      });
    } catch (error: any) {
      console.error('Error getting schema:', error);
      res.status(500).json({
        error: 'Error getting schema',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      });
    }
  });
  // Debug endpoint for request creation - simpler version for testing
router.post('/debug/requests', async (req: Request, res: Response) => {
    console.log('=== DEBUG REQUEST START ===');
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    
    try {
      // Extract request data
      const { 
        name, 
        abbreviation = '', 
        description = '', 
        templateId, 
        companyId, 
        userId 
      } = req.body;
      
      // Get authentication info from request headers
      const authHeader = req.headers.authorization;
      console.log('Auth header:', authHeader);
      
      // Extract user info from token if available
      let userCompanyId = companyId;
      let userUserId = userId;
      
      // If we have a token, try to extract user info
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // In a real implementation, you would decode the token and extract user info
          // For now, just log that we're using the token
          console.log('Using authenticated user info from token');
        } catch (authError) {
          console.error('Error extracting user info from token:', authError);
        }
      }
      
      // Use values from the request, token, or fallbacks
      // These fallbacks are only used if no value is provided and no token info is available
      userCompanyId = userCompanyId || null; 
      userUserId = userUserId || null;
      const templateIdToUse = templateId || null;
      
      if (!name) {
        return res.status(400).json({ error: 'Missing required field: name' });
      }
      
      // Validate required fields
      if (!templateIdToUse) {
        return res.status(400).json({ error: 'Missing required field: templateId' });
      }
      
      if (!userCompanyId) {
        return res.status(400).json({ error: 'Missing required field: companyId' });
      }
      
      if (!userUserId) {
        return res.status(400).json({ error: 'Missing required field: userId' });
      }
      
      // Convert values to appropriate types
      const numericTemplateId = Number(templateIdToUse);
      const numericCompanyId = Number(userCompanyId);
      const numericUserId = Number(userUserId);
      
      // Additional validation for numeric values
      if (isNaN(numericTemplateId) || numericTemplateId <= 0) {
        return res.status(400).json({ error: 'Invalid templateId: must be a positive number' });
      }
      
      if (isNaN(numericCompanyId) || numericCompanyId <= 0) {
        return res.status(400).json({ error: 'Invalid companyId: must be a positive number' });
      }
      
      if (isNaN(numericUserId) || numericUserId <= 0) {
        return res.status(400).json({ error: 'Invalid userId: must be a positive number' });
      }
      
      console.log('Using validated values:', {
        templateId: numericTemplateId,
        companyId: numericCompanyId,
        userId: numericUserId
      });
      
      // Use a simple transaction to ensure both operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Create a request entry using SQL Server compatible syntax
        // Use direct SQL queries to avoid Prisma schema issues
        console.log('Using direct SQL queries...');
        
        // Step 1: Create a request record
        // Insert the request and capture the ID in one step
        console.log('=== DETAILED REQUEST CREATION DEBUG ===');
        console.log('User ID:', numericUserId);
        console.log('Company ID:', numericCompanyId);
        console.log('Template ID:', numericTemplateId);
        console.log('Request Name:', name);
        
        let requestId = 0;
        
        try {
          // First execute the insert
          console.log('Executing INSERT operation...');
          const insertQuery = `
            INSERT INTO "GUARDIAN"."REQUESTS" (
              "REQUEST_NAME",
              "REQUEST_DESCRIPTION",
              "ABBREVIATION",
              "STATUS",
              "SUBMITTED_DATE",
              "CREATE_USER_ID",
              "UPDATE_USER_ID",
              "CREATE_DATE",
              "UPDATE_DATE",
              "COMPANY_ID",
              "FORM_ID",
              "REQUESTOR_ID"
            ) VALUES (
              '${name.replace(/'/g, "''")}',
              '${description.replace(/'/g, "''")}',
              '${abbreviation.replace(/'/g, "''")}',
              'P',
              now(),
              ${numericUserId},
              ${numericUserId},
              now(),
              now(),
              ${numericCompanyId},
              ${numericTemplateId || 'NULL'},
              ${numericUserId}
            )`;
            
          // Use INSERT...RETURNING to atomically retrieve the inserted REQUEST_ID
          const insertQueryWithReturning = insertQuery + ' RETURNING "REQUEST_ID"';
          console.log('Insert query (with RETURNING):', insertQueryWithReturning);
          const insertResult = await tx.$queryRawUnsafe(insertQueryWithReturning);
          console.log('INSERT operation completed successfully');

          if (insertResult && Array.isArray(insertResult) && insertResult.length > 0 &&
              insertResult[0].REQUEST_ID !== null && insertResult[0].REQUEST_ID !== undefined) {
            requestId = Number(insertResult[0].REQUEST_ID);
            console.log('Successfully retrieved request ID via RETURNING:', requestId);
          }
        } catch (insertError: unknown) {
          console.error('Error during request creation:', insertError);
          const errorMessage = insertError instanceof Error ? insertError.message : 'Unknown error';
          throw new Error(`Failed to create request: ${errorMessage}`);
        }

        if (requestId === 0) {
          throw new Error('Failed to retrieve request ID after creation');
        }

        // Step 2: Create a form instance for this request using INSERT...RETURNING
        console.log('Creating form instance for request...');
        let formInstanceId = 0;

        try {
          const insertFormQuery = `
            INSERT INTO "GUARDIAN"."FORMS_INSTANCE" (
              "FORM_ID",
              "ASSIGNED_ID",
              "SUBMITTED_DATE",
              "CREATE_USER_ID",
              "UPDATE_USER_ID",
              "CREATE_DATE",
              "UPDATE_DATE"
            ) VALUES (
              ${numericTemplateId},
              ${numericUserId},
              now(),
              ${numericUserId},
              ${numericUserId},
              now(),
              now()
            ) RETURNING "FORM_INSTANCE_ID"`;

          console.log('Form instance insert query:', insertFormQuery);
          const formInstanceResults = await tx.$queryRawUnsafe(insertFormQuery);

          if (formInstanceResults && Array.isArray(formInstanceResults) && formInstanceResults.length > 0) {
            formInstanceId = Number(formInstanceResults[0].FORM_INSTANCE_ID);
            console.log('Created form instance with ID:', formInstanceId);
          } else {
            console.warn('Failed to retrieve form instance ID');
          }
        } catch (formInstanceError: unknown) {
          console.error('Error during form instance creation:', formInstanceError);
          // Don't throw here, we want to continue even if form instance creation fails
        }
        
        // Create a simple object to represent the form instance
        const formInstance = {
          FORM_INSTANCE_ID: formInstanceId,
          FORM_ID: numericTemplateId,
          ASSIGNED_ID: numericUserId
        };
        
        return { requestId, formInstance };
      });
      
      console.log('Transaction completed successfully:', result);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error in debug endpoint:', error);
      
      // Check if this is a "Failed to retrieve request ID" error but the request was actually created
      if (error?.message?.includes('Failed to retrieve request ID') || 
          error?.message?.includes('request ID') || 
          error?.message?.includes('REQUEST_ID')) {
        
        console.log('Request likely created but had issues retrieving ID. Returning partial success.');
        
        // Return a success response with a placeholder ID
        // This will allow the frontend to close the modal and refresh the list
        res.status(201).json({
          requestId: 0,
          formInstance: {
            FORM_INSTANCE_ID: 0,
            FORM_ID: 0,
            ASSIGNED_ID: 0
          },
          partialSuccess: true,
          message: 'Request created but ID retrieval failed. The request list will be refreshed.'
        });
        return;
        // This code is unreachable due to the return statement above
        // Keeping for reference
        res.status(201).json({
          requestId: 0,
          formInstance: { FORM_INSTANCE_ID: 0 },
          partialSuccess: true,
          message: 'Request created but ID retrieval failed. Please refresh to see your new request.'
        });
      } else {
        // For other errors, return a 500 response
        res.status(500).json({
          error: 'Error creating request',
          details: error?.message || 'Unknown error',
          stack: error?.stack
        });
      }
    }
  });
// Create a new request and form instance - temporarily allow without authentication for testing
router.post('/', async (req: Request, res: Response) => {
    console.log('=== STANDARD REQUEST ENDPOINT START ===');
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    
    try {
      // Get user info from request
      const userInfo = getUserInfoFromRequest(req);
      
      // Extract request data with defaults
      const { 
        name, 
        abbreviation = '', 
        description = '', 
        templateId = userInfo.formId,
        companyId = userInfo.companyId,
        userId = userInfo.userId
      } = req.body;
      
      // Convert values to appropriate types first
      const numericTemplateId = Number(templateId);
      const numericCompanyId = Number(companyId);
      const numericUserId = Number(userId);
      
      // Enhanced validation with detailed error messages
      const validationErrors: string[] = [];
      
      console.log('Validating request data:');
      console.log('- name:', name, typeof name);
      console.log('- templateId:', templateId, typeof templateId, 'numeric:', numericTemplateId);
      console.log('- companyId:', companyId, typeof companyId, 'numeric:', numericCompanyId);
      console.log('- userId:', userId, typeof userId, 'numeric:', numericUserId);
      
      if (!name || name.trim() === '') {
        console.log('Validation failed: Missing name');
        validationErrors.push('Missing required field: name');
      }
      
      // Make templateId validation optional
      if (templateId !== undefined && (isNaN(numericTemplateId) || numericTemplateId < 0)) {
        console.log('Validation failed: Invalid templateId');
        validationErrors.push(`Invalid templateId: ${templateId}`);
      }
      
      if (!numericCompanyId || isNaN(numericCompanyId) || numericCompanyId <= 0) {
        console.log('Validation failed: Invalid companyId');
        validationErrors.push(`Invalid companyId: ${companyId}`);
      }
      
      if (!numericUserId || isNaN(numericUserId) || numericUserId <= 0) {
        console.log('Validation failed: Invalid userId');
        validationErrors.push(`Invalid userId: ${userId}`);
      }
      
      // Log the user info for debugging
      console.log('User info from token:', userInfo);
      console.log('Request parameters after processing:', { 
        name, 
        abbreviation, 
        description, 
        templateId: numericTemplateId, 
        companyId: numericCompanyId, 
        userId: numericUserId 
      });
      
      if (validationErrors.length > 0) {
        console.error('Validation errors:', validationErrors);
        const errorResponse = { 
          error: 'Validation failed', 
          details: validationErrors,
          requestData: req.body
        };
        console.log('Sending error response:', JSON.stringify(errorResponse, null, 2));
        return res.status(400).json(errorResponse);
      }
      
      console.log('Processing request with data:', { 
        name, 
        abbreviation, 
        description, 
        templateId: numericTemplateId, 
        companyId: numericCompanyId, 
        userId: numericUserId 
      });
      
      console.log('[REQUEST CREATION] FORM_ID being stored:', numericTemplateId);
      
      // Use a transaction to ensure both operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Create the request directly without template validation
        const currentDate = new Date();
        
        // Step 1: Create the request using INSERT...RETURNING to atomically retrieve the new ID
        const requestResults = await tx.$queryRaw`
          INSERT INTO "GUARDIAN"."REQUESTS" (
            "REQUEST_NAME",
            "COMPANY_ID",
            "STATUS",
            "SUBMITTED_DATE",
            "CREATE_USER_ID",
            "UPDATE_USER_ID",
            "CREATE_DATE",
            "UPDATE_DATE",
            "ABBREVIATION",
            "FORM_ID",
            "REQUESTOR_ID",
            "REQUEST_DESCRIPTION"
          ) VALUES (
            ${name},
            ${numericCompanyId},
            ${userInfo.status},
            ${currentDate},
            ${numericUserId},
            ${numericUserId},
            ${currentDate},
            ${currentDate},
            ${abbreviation},
            ${numericTemplateId},
            ${numericUserId},
            ${description}
          ) RETURNING *
        `;

        // Extract the request from the results
        const request = Array.isArray(requestResults) && requestResults.length > 0
          ? requestResults[0]
          : { REQUEST_ID: 0 };

        console.log('Created request:', request);
        console.log('[REQUEST CREATION] Stored FORM_ID in database:', request.FORM_ID);

        // Get the request ID for linking to form instance
        const requestId = request.REQUEST_ID;

        if (!requestId) {
          throw new Error('Failed to retrieve request ID after creation');
        }
        
        // Step 3: Create a form instance
        // Note: FORMS_INSTANCE table doesn't have a REQUEST_ID field in the schema
        // We'll maintain the relationship at the application level
        const formInstance = await tx.fORMS_INSTANCE.create({
          data: {
            FORM_ID: numericTemplateId,
            ASSIGNED_ID: numericUserId,
            SUBMITTED_DATE: currentDate,
            CREATE_USER_ID: numericUserId,
            UPDATE_USER_ID: numericUserId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          }
        });
        
        // Store the relationship in application memory or consider adding a mapping table
        console.log(`Associating form instance ${formInstance.FORM_INSTANCE_ID} with request ${requestId}`);
        // In a production app, you would create a mapping table entry here
        
        console.log('Created form instance with request ID:', formInstance);
        
        return { request, formInstance };
      });
      
      // Return the result from the transaction
      res.status(201).json(result);
      
    } catch (error: any) {
      // Enhanced error logging with detailed information
      console.error('==== ERROR CREATING REQUEST ====');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error name:', error?.name);
      
      // Log Prisma-specific error details if available
      if (error?.code?.startsWith('P')) {
        console.error('Prisma error meta:', error?.meta);
      }
      
      // Log SQL-specific error details if available
      if (error?.meta?.message) {
        console.error('SQL error message:', error.meta.message);
      }
      
      // Log the stack trace
      console.error('Stack trace:', error?.stack || 'No stack trace available');
      
      // Log the original request body for debugging
      console.error('Original request body:', req.body);
      
      // Send a more detailed error response
      res.status(500).json({
        error: 'Error creating request',
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN_ERROR',
        type: error?.name || 'Error',
        meta: error?.meta || {},
        requestData: req.body // Just send back the original request data
      });
    }
  });

// Get all requests
router.get('/', async (req: Request, res: Response) => {
    try {
      // Get query parameters for filtering
      const { status, type, assignedTo, requestorId, limit } = req.query;
      
      // Build the WHERE clause dynamically
      let whereClause = `WHERE r."STATUS" <> 'D'`;

      // Add status filter if provided — validated against allow-list to prevent injection.
      if (status && VALID_REQUEST_STATUS.includes(String(status) as typeof VALID_REQUEST_STATUS[number])) {
        whereClause += ` AND r."STATUS" = '${escapeSqlValue(String(status))}'`;
      }

      // NOTE: REQUEST_TYPE column does not exist in GUARDIAN.REQUESTS — type filter removed.

      // Add assigned user filter if provided
      if (assignedTo) {
        whereClause += ` AND r."ASSIGNED_ID" = ${assignedTo}`;
      }

      // Add requestor filter if provided
      if (requestorId) {
        whereClause += ` AND r."REQUESTOR_ID" = ${requestorId}`;
      }
      
      // Determine limit clause — coerce to safe integer to prevent injection.
      const safeLimit = limit !== undefined
        ? (Number.isFinite(Number(limit)) ? Math.min(Math.max(parseInt(String(limit), 10), 1), 1000) : 100)
        : null;
      const limitClause = safeLimit !== null ? `LIMIT ${safeLimit}` : '';

      // Use raw SQL query with the dynamic WHERE clause and LEFT JOINs to get user details
      const query = `
        SELECT
          r.*,
          requestor."FIRST_NAME" as requestor_first_name,
          requestor."LAST_NAME" as requestor_last_name,
          assigned."FIRST_NAME" as assigned_first_name,
          assigned."LAST_NAME" as assigned_last_name
        FROM "GUARDIAN"."REQUESTS" r
        LEFT JOIN "GUARDIAN"."USERS" requestor ON r."REQUESTOR_ID" = requestor."USER_ID"
        LEFT JOIN "GUARDIAN"."USERS" assigned ON r."ASSIGNED_ID" = assigned."USER_ID"
        ${whereClause}
        ORDER BY r."CREATE_DATE" DESC
        ${limitClause}
      `;
      
      console.log('Executing query:', query);
      const rawRequests = await prisma.$queryRawUnsafe(query);
      
      // Transform the results to include requestor and assigned objects
      const requests = (rawRequests as any[]).map((req: any) => {
        // Create the request object with all original properties
        const request = { ...req };
        
        // Add requestor object if requestor data exists
        if (req.requestor_first_name || req.requestor_last_name) {
          request.requestor = {
            FIRST_NAME: req.requestor_first_name,
            LAST_NAME: req.requestor_last_name
          };
          request.requestorName = `${req.requestor_first_name} ${req.requestor_last_name}`;
        }
        
        // Add assigned object if assigned data exists
        if (req.assigned_first_name || req.assigned_last_name) {
          request.assigned = {
            FIRST_NAME: req.assigned_first_name,
            LAST_NAME: req.assigned_last_name
          };
          request.assignedName = `${req.assigned_first_name} ${req.assigned_last_name}`;
        }
        
        // Remove the extra fields to keep the response clean
        delete request.requestor_first_name;
        delete request.requestor_last_name;
        delete request.assigned_first_name;
        delete request.assigned_last_name;
        
        return request;
      });
      
      console.log(`Returning ${requests.length} requests with user details`);
      
      // Log FORM_ID for debugging
      if (requests.length > 0) {
        console.log('[REQUEST LIST] Sample request FORM_IDs:', 
          requests.slice(0, 3).map(r => ({ 
            REQUEST_ID: r.REQUEST_ID, 
            REQUEST_NAME: r.REQUEST_NAME, 
            FORM_ID: r.FORM_ID 
          }))
        );
      }
      
      res.json(requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  });

// Get a specific request by ID
router.get('/:id', async (req: Request, res: Response) => {
    const requestId = parseInt(req.params.id);
    
    try {
      // Use raw SQL query to get a specific request
      const requests = await prisma.$queryRaw`
        SELECT * FROM "GUARDIAN"."REQUESTS"
        WHERE "REQUEST_ID" = ${requestId}
        AND "STATUS" <> 'D'
      `;
      
      const request = Array.isArray(requests) && requests.length > 0 ? requests[0] : null;
      
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      res.json(request);
    } catch (error) {
      console.error(`Error fetching request ${requestId}:`, error);
      res.status(500).json({ error: 'Failed to fetch request' });
    }
  });

// Update a request
router.put('/:id', async (req: Request, res: Response) => {
    const requestId = parseInt(req.params.id);
    const { name, abbreviation, description, status, assignedId } = req.body;
    const currentDate = new Date().toISOString();
    
    try {
      // Use individual update statements for each field that needs to be updated
      // Update the timestamp first
      await prisma.$executeRaw`
        UPDATE "GUARDIAN"."REQUESTS" SET "UPDATE_DATE" = ${currentDate}
        WHERE "REQUEST_ID" = ${requestId}
      `;

      // Update each field individually if provided
      if (name) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."REQUESTS" SET "REQUEST_NAME" = ${name}
          WHERE "REQUEST_ID" = ${requestId}
        `;
      }

      if (abbreviation) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."REQUESTS" SET "ABBREVIATION" = ${abbreviation}
          WHERE "REQUEST_ID" = ${requestId}
        `;
      }

      if (description) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."REQUESTS" SET "TRACKINGID" = ${description}
          WHERE "REQUEST_ID" = ${requestId}
        `;
      }

      if (status) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."REQUESTS" SET "STATUS" = ${status}
          WHERE "REQUEST_ID" = ${requestId}
        `;
      }

      if (assignedId) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."REQUESTS" SET "ASSIGNED_ID" = ${assignedId}
          WHERE "REQUEST_ID" = ${requestId}
        `;
      }

      // Get the updated request
      const requests = await prisma.$queryRaw`
        SELECT * FROM "GUARDIAN"."REQUESTS" WHERE "REQUEST_ID" = ${requestId}
      `;
      
      const request = Array.isArray(requests) && requests.length > 0 ? requests[0] : null;
      
      if (!request) {
        return res.status(404).json({ error: 'Request not found after update' });
      }
      
      res.json(request);
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
      res.status(500).json({ error: 'Failed to update request' });
    }
  });

// Delete a request (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  const requestId = parseInt(req.params.id, 10);

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID' });
  }

  try {
    const updatedRows = await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."REQUESTS"
      SET "STATUS" = 'D', "UPDATE_DATE" = now()
      WHERE "REQUEST_ID" = ${requestId}
    `);

    if (!updatedRows) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error(`Error deleting request ${requestId}:`, error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

import { Resend } from 'resend';

// Get Resend configuration from environment variables
// SMTP_PASSWORD holds the Resend API key (see .env.example); RESEND_API_KEY is the canonical name
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://shieldlytics.com/logo.png';

// Initialize Resend client if API key is available
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Assign a request to a user
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    console.log('=== ASSIGN REQUEST START ===');
    console.log('Request ID:', req.params.id);
    console.log('Request body:', req.body);
    
    // Get user info from request for audit purposes
    const userInfo = getUserInfoFromRequest(req);
    const { userId } = req.body;
    
    // Validate inputs
    if (!req.params.id || isNaN(parseInt(req.params.id))) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ error: 'Invalid user ID for assignment' });
    }
    
    const requestId = parseInt(req.params.id);
    const assignedUserId = parseInt(userId);
    const updatedById = userInfo.userId;
    const currentDate = new Date();
    
    // Update the request in the database
    await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."REQUESTS"
      SET "ASSIGNED_ID" = ${assignedUserId},
          "UPDATE_USER_ID" = ${updatedById},
          "UPDATE_DATE" = now()
      WHERE "REQUEST_ID" = ${requestId}
    `);

    // Get the updated request to return
    const updatedRequest = await prisma.$queryRawUnsafe(`
      SELECT r.*,
        u1."FIRST_NAME" || ' ' || u1."LAST_NAME" as "REQUESTOR_NAME",
        u2."FIRST_NAME" || ' ' || u2."LAST_NAME" as "ASSIGNED_TO_NAME",
        u2."EMAIL" as "ASSIGNED_USER_EMAIL"
      FROM "GUARDIAN"."REQUESTS" r
      LEFT JOIN "GUARDIAN"."USERS" u1 ON r."REQUESTOR_ID" = u1."USER_ID"
      LEFT JOIN "GUARDIAN"."USERS" u2 ON r."ASSIGNED_ID" = u2."USER_ID"
      WHERE r."REQUEST_ID" = ${requestId}
    `) as any[];
    
    // Send notification email to assigned user if Resend is configured
    const request = updatedRequest[0];
    if (resend && request && request.ASSIGNED_USER_EMAIL) {
      try {
        console.log(`[REQUEST ASSIGNMENT] Sending notification email to ${request.ASSIGNED_USER_EMAIL}`);
        
        const trackingId = request.TRACKINGID || `REQ-${request.REQUEST_ID}`;
        const requestName = request.REQUEST_NAME || 'Unnamed Request';
        
        // Get assigner name from JWT token or use a default
        let assignerName = 'System Administrator';
        if (req.user) {
          const user = req.user as any;
          if (user.firstName && user.lastName) {
            assignerName = `${user.firstName} ${user.lastName}`;
          } else if (user.FIRST_NAME && user.LAST_NAME) {
            assignerName = `${user.FIRST_NAME} ${user.LAST_NAME}`;
          }
        }
        
        // Get the application URL from environment — FRONTEND_URL is the canonical var (see .env.example)
        const appUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        const requestUrl = `${appUrl}/requests/${requestId}`;
        
        const { data, error } = await resend.emails.send({
          from: `Shieldlytics <${EMAIL_FROM}>`,
          to: [request.ASSIGNED_USER_EMAIL],
          subject: `Request Assignment: ${trackingId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${EMAIL_LOGO_URL}" alt="Shieldlytics" style="height:40px;">
              </div>
              <h2 style="color: #333;">Request Assignment Notification</h2>
              <p>Hello,</p>
              <p>You have been assigned to the following request:</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Request ID:</strong> ${trackingId}</p>
                <p><strong>Request Name:</strong> ${requestName}</p>
                <p><strong>Assigned By:</strong> ${assignerName}</p>
                <p><strong>Assignment Date:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p>Please click the link below to access and process this request:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${requestUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Request</a>
              </div>
              <p style="text-align: center; color: #777; font-size: 14px;">
                Or copy and paste this URL into your browser:<br>
                ${requestUrl}
              </p>
              <p>Thank you,<br>The Shieldlytics Team</p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
              <p style="font-size: 12px; color: #777; text-align: center;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          `
        });
        
        if (error) {
          console.error('[RESEND] Error sending assignment email:', error);
          throw error;
        }
        
        console.log('[REQUEST ASSIGNMENT] Notification email sent successfully:', data);
      } catch (emailError: any) {
        // Log email error but don't fail the request assignment
        console.error('[REQUEST ASSIGNMENT] Error sending notification email:', emailError);
      }
    } else {
      console.log('[REQUEST ASSIGNMENT] Email notification skipped - Resend not configured or missing email');
    }
    
    console.log('Request assigned successfully');
    res.status(200).json(request || { message: 'Request assigned but details not available' });
  } catch (error: any) {
    console.error('Error assigning request:', error);
    res.status(500).json({
      error: 'Error assigning request',
      details: error?.message || 'Unknown error'
    });
  }
});

// Request fulfillment endpoints

// Start fulfillment (change status from P to A)
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const currentDate = new Date();
    
    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Check if request exists and is assigned to current user
    const request = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GUARDIAN"."REQUESTS"
      WHERE "REQUEST_ID" = ${requestId}
      AND "ASSIGNED_ID" = ${userInfo.userId}
      AND "STATUS" = 'P'
    `) as any[];

    if (!request || request.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }

    // Update status to In Progress (A)
    await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."REQUESTS"
      SET "STATUS" = 'A',
          "UPDATE_USER_ID" = ${userInfo.userId},
          "UPDATE_DATE" = now()
      WHERE "REQUEST_ID" = ${requestId}
    `);
    
    res.json({ message: 'Request fulfillment started', requestId });
  } catch (error: any) {
    console.error('Error starting request fulfillment:', error);
    res.status(500).json({ error: 'Error starting request fulfillment' });
  }
});

// Complete fulfillment (change status from A to C)
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const { completionNotes } = req.body;
    const currentDate = new Date();
    
    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Check if request exists and is assigned to current user
    const request = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GUARDIAN"."REQUESTS"
      WHERE "REQUEST_ID" = ${requestId}
      AND "ASSIGNED_ID" = ${userInfo.userId}
      AND "STATUS" = 'A'
    `) as any[];

    if (!request || request.length === 0) {
      return res.status(404).json({ error: 'Request not found or not in progress' });
    }

    // Update status to Completed (C)
    await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."REQUESTS"
      SET "STATUS" = 'C',
          "UPDATE_USER_ID" = ${userInfo.userId},
          "UPDATE_DATE" = now(),
          "TRACKINGID" = COALESCE("TRACKINGID", '') || chr(13) || chr(10) || 'Completed: ' || '${escapeSqlValue(completionNotes || 'No notes provided')}'
      WHERE "REQUEST_ID" = ${requestId}
    `);

    // Send notification email to requestor if available
    if (resend && request[0].REQUESTOR_ID) {
      try {
        const requestorQuery = await prisma.$queryRawUnsafe(`
          SELECT "EMAIL", "FIRST_NAME", "LAST_NAME"
          FROM "GUARDIAN"."USERS"
          WHERE "USER_ID" = ${request[0].REQUESTOR_ID}
        `) as any[];
        
        if (requestorQuery.length > 0) {
          const requestor = requestorQuery[0];
          const trackingId = request[0].TRACKINGID || `REQ-${request[0].REQUEST_ID}`;
          const requestName = request[0].REQUEST_NAME || 'Unnamed Request';
          
          await resend.emails.send({
            from: `Shieldlytics <${EMAIL_FROM}>`,
            to: [requestor.EMAIL],
            subject: `Request Completed: ${trackingId}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Request Completion Notification</h2>
                <p>Hello ${requestor.FIRST_NAME},</p>
                <p>Your request has been completed:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Request ID:</strong> ${trackingId}</p>
                  <p><strong>Request Name:</strong> ${requestName}</p>
                  <p><strong>Completion Date:</strong> ${new Date().toLocaleString()}</p>
                  ${completionNotes ? `<p><strong>Notes:</strong> ${completionNotes}</p>` : ''}
                </div>
                <p>Thank you for using Shieldlytics.</p>
              </div>
            `
          });
        }
      } catch (emailError) {
        console.error('Error sending completion notification:', emailError);
      }
    }
    
    res.json({ message: 'Request completed successfully', requestId });
  } catch (error: any) {
    console.error('Error completing request:', error);
    res.status(500).json({ error: 'Error completing request' });
  }
});

// Get assigned requests for current user
router.get('/assigned/me', async (req: Request, res: Response) => {
  try {
    const userInfo = getUserInfoFromRequest(req);
    const { status } = req.query;
    
    let whereClause = `WHERE r."ASSIGNED_ID" = ${userInfo.userId} AND r."STATUS" <> 'D'`;

    // Validate status against allow-list to prevent injection.
    if (status && VALID_REQUEST_STATUS.includes(String(status) as typeof VALID_REQUEST_STATUS[number])) {
      whereClause += ` AND r."STATUS" = '${escapeSqlValue(String(status))}'`;
    }

    const requests = await prisma.$queryRawUnsafe(`
      SELECT r.*,
        requestor."FIRST_NAME" as requestor_first_name,
        requestor."LAST_NAME" as requestor_last_name,
        requestor."EMAIL" as requestor_email
      FROM "GUARDIAN"."REQUESTS" r
      LEFT JOIN "GUARDIAN"."USERS" requestor ON r."REQUESTOR_ID" = requestor."USER_ID"
      ${whereClause}
      ORDER BY r."CREATE_DATE" DESC
    `) as any[];
    
    // Transform the results
    const transformedRequests = requests.map((req: any) => ({
      ...req,
      requestor: req.requestor_first_name ? {
        FIRST_NAME: req.requestor_first_name,
        LAST_NAME: req.requestor_last_name,
        EMAIL: req.requestor_email
      } : null,
      requestorName: req.requestor_first_name ? `${req.requestor_first_name} ${req.requestor_last_name}` : null
    }));
    
    res.json(transformedRequests);
  } catch (error: any) {
    console.error('Error fetching assigned requests:', error);
    res.status(500).json({ error: 'Error fetching assigned requests' });
  }
});

// Update request progress
router.put('/:id/progress', async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const { progressNotes } = req.body;
    
    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Check if request exists and is assigned to current user
    const request = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GUARDIAN"."REQUESTS"
      WHERE "REQUEST_ID" = ${requestId}
      AND "ASSIGNED_ID" = ${userInfo.userId}
      AND "STATUS" IN ('P', 'A')
    `) as any[];

    if (!request || request.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }

    // Add progress note to tracking ID
    const currentTracking = request[0].TRACKINGID || '';
    const newTracking = currentTracking +
      (currentTracking ? '\n' : '') +
      `Progress Update (${new Date().toLocaleString()}): ${progressNotes}`;

    await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."REQUESTS"
      SET "TRACKINGID" = '${newTracking.replace(/'/g, "''")}',
          "UPDATE_USER_ID" = ${userInfo.userId},
          "UPDATE_DATE" = now()
      WHERE "REQUEST_ID" = ${requestId}
    `);
    
    res.json({ message: 'Progress updated successfully', requestId });
  } catch (error: any) {
    console.error('Error updating request progress:', error);
    res.status(500).json({ error: 'Error updating request progress' });
  }
});

// Get form instance and fields for a specific assigned request
router.get('/:id/form', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    
    console.log('[GET FORM] Request ID:', requestId);
    console.log('[GET FORM] User info:', userInfo);
    console.log('[GET FORM] Request user:', req.user);
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get the request first
    const request = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}
    `) as any[];
    
    if (!request || request.length === 0) {
      console.log('[GET FORM] No request found');
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const requestData = request[0];
    
    console.log(`[GET FORM] Retrieved request data:`, {
      REQUEST_ID: requestData.REQUEST_ID,
      REQUEST_NAME: requestData.REQUEST_NAME,
      FORM_ID: requestData.FORM_ID,
      STATUS: requestData.STATUS
    });
    
    // Use the FORM_ID that was stored when the request was created
    let formId: number | null = requestData.FORM_ID;
    let formInstanceId: number | null = null;
    
    console.log(`[GET FORM] Using FORM_ID: ${formId}`);
    
    const resolvedFormInstanceId = await resolveFormInstanceIdForRequest(requestData);
    if (resolvedFormInstanceId) {
      formInstanceId = resolvedFormInstanceId;
      console.log(`[GET FORM] Resolved form instance ${formInstanceId} for request ${requestId}`);
    }
    
    // If no form ID found in the request, fall back to pattern matching (legacy behavior)
    if (!formId) {
      console.log('[GET FORM] No FORM_ID in request, using legacy pattern matching');
      const requestName = requestData.REQUEST_NAME?.toLowerCase() || '';
      const requestDescription = requestData.REQUEST_DESCRIPTION?.toLowerCase() || '';
      
      // Match request to appropriate form template
      if (requestName.includes('vehicle') || requestDescription.includes('vehicle')) {
        formId = 1013; // VEHICLE form
      } else if (requestName.includes('financial') || requestName.includes('bank') || requestDescription.includes('financial')) {
        formId = 1006; // FINANCIAL form
      } else if (requestName.includes('address') || requestDescription.includes('address')) {
        formId = 1007; // ADDRESS form
      } else {
        formId = 1005; // SUBJECT form as default
      }
      
      console.log(`[GET FORM] Legacy pattern matching: "${requestData.REQUEST_NAME}" -> form ID ${formId}`);
    } else {
      console.log(`[GET FORM] Using stored FORM_ID: ${formId}`);
    }
    
    const requestWithForm = [{ ...requestData, FORM_ID: formId, FORM_INSTANCE_ID: formInstanceId }];
    
    console.log('[GET FORM] Query result:', requestWithForm);
    
    if (!requestWithForm || requestWithForm.length === 0) {
      console.log('[GET FORM] No request found');
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const finalRequestData = requestWithForm[0];
    const finalFormId = finalRequestData.FORM_ID;
    
    console.log('[GET FORM] Request data:', finalRequestData);
    console.log('[GET FORM] Form ID:', finalFormId);
    
    if (!finalFormId) {
      console.log('[GET FORM] No form ID found');
      return res.status(404).json({ error: 'No form associated with this request' });
    }
    
    // Get form details
    const form = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GUARDIAN"."FORMS" WHERE "FORM_ID" = ${finalFormId}
    `) as any[];
    
    console.log(`[GET FORM] Form query for ID ${finalFormId}:`, form);
    
    if (form && form.length > 0) {
      console.log(`[GET FORM] Found form:`, {
        FORM_ID: form[0].FORM_ID,
        FORM_NAME: form[0].FORM_NAME,
        FORM_DESCRIPTION: form[0].FORM_DESCRIPTION
      });
    } else {
      console.log(`[GET FORM] No form found with ID ${finalFormId}`);
    }
    
    if (!form || form.length === 0) {
      console.warn(`[GET FORM] Form template not found for ID ${finalFormId}, creating fallback`);
      // Create a fallback form instead of returning 404
      const fallbackForm = {
        FORM_ID: finalFormId,
        FORM_NAME: 'Default Form',
        FORM_DESCRIPTION: 'Default form template for request fulfillment',
        IS_ACTIVE: true,
        IS_PUBLIC: false,
        IS_DELETED: false
      };
      
      // Return response with fallback form and basic fields
      return res.json({
        request: finalRequestData,
        form: fallbackForm,
        fields: [
          { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
        ],
        values: {},
        formInstanceId: finalRequestData.FORM_INSTANCE_ID
      });
    }
    
    // Get form fields from the database
    let fields: any[] = [];
    
    try {
      const formFields = await prisma.$queryRawUnsafe(`
        SELECT
          ff."FORM_ID",
          ff."FIELD_ID",
          ff."IS_REQUIRED",
          ff."SORT_ORDER" as "SEQUENCE",
          f."FIELD_NAME",
          f."FIELD_TYPE_ID"
        FROM "GUARDIAN"."FORMS_FIELDS" ff
        JOIN "GUARDIAN"."FIELDS" f ON ff."FIELD_ID" = f."FIELD_ID"
        WHERE ff."FORM_ID" = ${finalFormId}
        ORDER BY ff."SORT_ORDER" ASC
      `) as any[];
      
      console.log(`[GET FORM] Found ${formFields.length} fields for form ${finalFormId}:`, formFields);
      
      if (formFields.length > 0) {
        fields = formFields;
      } else {
        console.log(`[GET FORM] No fields found for form ${finalFormId}, using fallback based on form name`);
        
        // Fallback to hardcoded fields if no fields found in database
        if (form[0].FORM_NAME === 'SUBJECT') {
          fields = [
            { FIELD_ID: 1, FIELD_NAME: 'First Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
            { FIELD_ID: 2, FIELD_NAME: 'Middle Name', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
            { FIELD_ID: 3, FIELD_NAME: 'Last Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 },
            { FIELD_ID: 4, FIELD_NAME: 'DOB', FIELD_TYPE_ID: 3, IS_REQUIRED: true, SEQUENCE: 4 },
            { FIELD_ID: 5, FIELD_NAME: 'SSN', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 5 }
          ];
        } else if (form[0].FORM_NAME === 'FINANCIAL') {
          fields = [
            { FIELD_ID: 6, FIELD_NAME: 'Bank Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
            { FIELD_ID: 7, FIELD_NAME: 'Account #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 2 },
            { FIELD_ID: 8, FIELD_NAME: 'Routing #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 }
          ];
        } else if (form[0].FORM_NAME === 'ADDRESS') {
          fields = [
            { FIELD_ID: 9, FIELD_NAME: 'Address Line 1', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
            { FIELD_ID: 10, FIELD_NAME: 'Address Line 2', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
            { FIELD_ID: 11, FIELD_NAME: 'City', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 },
            { FIELD_ID: 12, FIELD_NAME: 'State', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 4 },
            { FIELD_ID: 13, FIELD_NAME: 'ZIP Code', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 5 }
          ];
        } else {
          // Default fallback fields for unknown forms
          fields = [
            { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
          ];
        }
      }
    } catch (fieldsError) {
      console.error(`[GET FORM] Error loading fields for form ${finalFormId}:`, fieldsError);
      
      // Ultra fallback - just provide a simple notes field
      fields = [
        { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
      ];
    }
    
    const valueMap: Record<string, string> = {};
    if (finalRequestData.FORM_INSTANCE_ID) {
      const rawValues = await prisma.$queryRawUnsafe(`
        SELECT
          fiv."FIELD_ID",
          fiv."VALUE",
          f."FIELD_NAME"
        FROM "GUARDIAN"."FORMS_INSTANCE_VALUES" fiv
        JOIN "GUARDIAN"."FIELDS" f ON f."FIELD_ID" = fiv."FIELD_ID"
        WHERE fiv."FORM_INSTANCE_ID" = ${finalRequestData.FORM_INSTANCE_ID}
      `) as Array<{ FIELD_ID: number; VALUE: string | null; FIELD_NAME: string }>;

      for (const row of rawValues) {
        const normalizedValue = row.VALUE ?? '';
        valueMap[String(row.FIELD_ID)] = normalizedValue;
        valueMap[row.FIELD_NAME] = normalizedValue;
      }
    }
    
    res.json({
      request: finalRequestData,
      form: form[0],
      fields: fields,
      values: valueMap,
      formInstanceId: finalRequestData.FORM_INSTANCE_ID
    });
    
  } catch (error) {
    console.error('[GET FORM] Error fetching request form:', error);
    console.error('[GET FORM] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Instead of just returning an error, provide a fallback response
    // This prevents the frontend from crashing due to undefined data
    const fallbackResponse = {
      request: { REQUEST_ID: parseInt(req.params.id), REQUEST_NAME: 'Unknown Request' },
      form: {
        FORM_ID: 0,
        FORM_NAME: 'Error Recovery Form',
        FORM_DESCRIPTION: 'This form was generated due to an error loading the original form template',
        IS_ACTIVE: true,
        IS_PUBLIC: false,
        IS_DELETED: false
      },
      fields: [
        { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
      ],
      values: {},
      formInstanceId: null
    };
    
    console.log('[GET FORM] Returning fallback response due to error');
    res.status(200).json(fallbackResponse); // Return 200 with fallback data instead of 500
  }
});

// Save form field values for a request
router.post('/:id/form/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const { fieldValues } = req.body; // { fieldId: value, ... }
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Verify request is assigned to current user and get form instance
    // Find the most recently created form instance that matches both the request's form ID and assigned user
    const request = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}
      AND r."ASSIGNED_ID" = ${userInfo.userId}
    `) as RequestRecord[];
    
    if (!request || request.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }
    
    const formInstanceId = await resolveFormInstanceIdForRequest(request[0]);
    
    if (!formInstanceId) {
      return res.status(400).json({ error: 'No form instance found for this request' });
    }
    
    // Save/update field values
    for (const [fieldId, value] of Object.entries(fieldValues)) {
      if (value !== null && value !== undefined && value !== '') {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "GUARDIAN"."FORMS_INSTANCE_VALUES"
            ("FORM_INSTANCE_ID", "FIELD_ID", "VALUE", "CREATE_DATE", "UPDATE_DATE", "CREATE_USER_ID", "UPDATE_USER_ID")
          VALUES (${formInstanceId}, ${fieldId}, '${escapeSqlValue(String(value))}', now(), now(), ${userInfo.userId}, ${userInfo.userId})
          ON CONFLICT ("FORM_INSTANCE_ID", "FIELD_ID") DO UPDATE
            SET "VALUE" = EXCLUDED."VALUE",
                "UPDATE_DATE" = now(),
                "UPDATE_USER_ID" = ${userInfo.userId}
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          DELETE FROM "GUARDIAN"."FORMS_INSTANCE_VALUES"
          WHERE "FORM_INSTANCE_ID" = ${formInstanceId}
            AND "FIELD_ID" = ${fieldId}
        `);
      }
    }

    // Update form instance submitted date
    await prisma.$executeRawUnsafe(`
      UPDATE "GUARDIAN"."FORMS_INSTANCE"
      SET "SUBMITTED_DATE" = now(),
          "UPDATE_DATE" = now(),
          "UPDATE_USER_ID" = ${userInfo.userId}
      WHERE "FORM_INSTANCE_ID" = ${formInstanceId}
    `);
    
    res.json({ 
      success: true, 
      message: 'Form data saved successfully',
      formInstanceId 
    });
    
  } catch (error) {
    console.error('Error saving form data:', error);
    res.status(500).json({ error: 'Failed to save form data' });
  }
});

router.delete('/:id/field-value/:fieldId', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const fieldId = parseInt(req.params.fieldId);
    const userInfo = getUserInfoFromRequest(req);

    if (isNaN(requestId) || isNaN(fieldId)) {
      return res.status(400).json({ error: 'Invalid request or field ID' });
    }

    const request = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}
        AND r."ASSIGNED_ID" = ${userInfo.userId}
    `) as RequestRecord[];

    const formInstanceId = request.length ? await resolveFormInstanceIdForRequest(request[0]) : null;

    if (!request.length || !formInstanceId) {
      return res.status(404).json({ error: 'Request or form instance not found' });
    }

    await prisma.$executeRawUnsafe(`
      DELETE FROM "GUARDIAN"."FORMS_INSTANCE_VALUES"
      WHERE "FORM_INSTANCE_ID" = ${formInstanceId}
        AND "FIELD_ID" = ${fieldId}
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting field value:', error);
    res.status(500).json({ error: 'Failed to delete field value' });
  }
});

router.get('/:id/subject-photo', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as RequestRecord[];

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const attachment = await getActiveSubjectPhotoAttachmentForRequest(requestRows[0]);
    if (!attachment) {
      return res.status(204).send();
    }

    res.json({
      success: true,
      attachmentId: attachment.ATTACHMENT_ID,
      fileName: attachment.FILE_NAME,
      createDate: attachment.CREATE_DATE,
    });
  } catch (error) {
    console.error('Error fetching subject photo metadata:', error);
    res.status(500).json({ error: 'Failed to fetch subject photo metadata' });
  }
});

router.get('/:id/subject-photo/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as RequestRecord[];

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const attachment = await getActiveSubjectPhotoAttachmentForRequest(requestRows[0]);
    if (!attachment?.ATTACHMENT) {
      return res.status(404).json({ error: 'Subject photo not found' });
    }

    const fileName = attachment.FILE_NAME.startsWith(SUBJECT_PHOTO_FILE_PREFIX)
      ? attachment.FILE_NAME.slice(SUBJECT_PHOTO_FILE_PREFIX.length)
      : attachment.FILE_NAME;

    const fileBuffer = normalizeAttachmentBinary(attachment.ATTACHMENT);
    if (!fileBuffer) {
      return res.status(500).json({ error: 'Subject photo data is not valid binary' });
    }

    res.setHeader('Content-Type', getContentType(fileName));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading subject photo:', error);
    res.status(500).json({ error: 'Failed to download subject photo' });
  }
});

router.post('/:id/subject-photo', requireAuth, attachmentUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const file = req.file;

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as RequestRecord[];

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.aTTACHMENTS.deleteMany({
      where: {
        REQUEST_ID: requestId,
        FILE_NAME: {
          startsWith: SUBJECT_PHOTO_FILE_PREFIX,
        },
      },
    });

    const storedFileName = `${SUBJECT_PHOTO_FILE_PREFIX}${file.originalname}`;
    const attachment = await prisma.aTTACHMENTS.create({
      data: {
        REQUEST_ID: requestId,
        FILE_NAME: storedFileName,
        ATTACHMENT: Buffer.from(file.buffer),
        CREATE_USER_ID: userInfo.userId || null,
        UPDATE_USER_ID: userInfo.userId || null,
        CREATE_DATE: new Date(),
        UPDATE_DATE: new Date(),
      },
      select: {
        ATTACHMENT_ID: true,
        FILE_NAME: true,
      },
    });

    res.status(201).json({
      success: true,
      attachmentId: attachment.ATTACHMENT_ID,
      fileName: file.originalname,
    });
  } catch (error) {
    console.error('Error uploading subject photo:', error);
    res.status(500).json({ error: 'Failed to upload subject photo' });
  }
});

router.delete('/:id/subject-photo', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as RequestRecord[];

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.aTTACHMENTS.deleteMany({
      where: {
        REQUEST_ID: requestId,
        FILE_NAME: {
          startsWith: SUBJECT_PHOTO_FILE_PREFIX,
        },
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subject photo:', error);
    res.status(500).json({ error: 'Failed to delete subject photo' });
  }
});

router.get('/:id/attachments', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM "GUARDIAN"."REQUESTS" r
      WHERE r."REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as RequestRecord[];

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const activeSubjectPhotoAttachment = await getActiveSubjectPhotoAttachmentForRequest(requestRows[0]);
    const subjectPhotoAttachmentId = activeSubjectPhotoAttachment?.ATTACHMENT_ID ?? null;

    const attachments = await prisma.aTTACHMENTS.findMany({
      where: { REQUEST_ID: requestId },
      orderBy: { CREATE_DATE: 'desc' },
      select: {
        ATTACHMENT_ID: true,
        FILE_NAME: true,
        CREATE_DATE: true,
      },
    });

    res.json({
      success: true,
      attachments: attachments
        .filter(a => a.ATTACHMENT_ID !== subjectPhotoAttachmentId)
        .map(a => ({
        attachmentId: a.ATTACHMENT_ID,
        fileName: a.FILE_NAME,
        createDate: a.CREATE_DATE,
        })),
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

router.post('/:id/attachments', requireAuth, attachmentUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const userInfo = getUserInfoFromRequest(req);
    const file = req.file;

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const requestRows = await prisma.$queryRawUnsafe(`
      SELECT "REQUEST_ID", "COMPANY_ID"
      FROM "GUARDIAN"."REQUESTS"
      WHERE "REQUEST_ID" = ${requestId}${getRequestCompanyClause(userInfo.companyId)}
    `) as Array<{ REQUEST_ID: number; COMPANY_ID: number | null }>;

    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const attachment = await prisma.aTTACHMENTS.create({
      data: {
        REQUEST_ID: requestId,
        FILE_NAME: file.originalname,
        ATTACHMENT: Buffer.from(file.buffer),
        CREATE_USER_ID: userInfo.userId || null,
        UPDATE_USER_ID: userInfo.userId || null,
        CREATE_DATE: new Date(),
        UPDATE_DATE: new Date(),
      },
      select: {
        ATTACHMENT_ID: true,
        FILE_NAME: true,
      },
    });

    res.status(201).json({
      success: true,
      attachmentId: attachment.ATTACHMENT_ID,
      fileName: attachment.FILE_NAME,
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

export default router;
