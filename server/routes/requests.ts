import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = express.Router();

// Database schema name - this is the only fixed constant
const DB_SCHEMA = 'GUARDIAN';

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
        companyId: user.company?.id || defaults.companyId,
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
          // Step 1: Create a request using raw SQL
          await tx.$executeRawUnsafe(`
            INSERT INTO ${DB_SCHEMA}.REQUESTS (
              REQUEST_NAME, 
              REQUEST_DESCRIPTION, 
              ABBREVIATION, 
              STATUS, 
              SUBMITTED_DATE, 
              CREATE_USER_ID,
              UPDATE_USER_ID, 
              CREATE_DATE, 
              UPDATE_DATE,
              COMPANY_ID,
              FORM_ID,
              REQUESTOR_ID
            ) VALUES (
              '${name.replace(/'/g, "''")}',
              '${description.replace(/'/g, "''")}',
              '${abbreviation.replace(/'/g, "''")}',
              '${userInfo.status}',
              GETDATE(),
              ${numericUserId},
              ${numericUserId},
              GETDATE(),
              GETDATE(),
              ${numericCompanyId},
              ${numericTemplateId},
              ${numericUserId}
            )
          `);
          
          // Get the newly created request ID using SCOPE_IDENTITY() for reliability
          const idResult = await tx.$queryRawUnsafe(`
            SELECT TOP 1 REQUEST_ID FROM ${DB_SCHEMA}.REQUESTS 
            WHERE REQUEST_ID = SCOPE_IDENTITY()
          `);
          
          const requestId = Array.isArray(idResult) && idResult.length > 0 
            ? idResult[0].REQUEST_ID 
            : 0;
            
          console.log('Created request with ID:', requestId);
          
          // Step 2: Create a form instance using raw SQL
          await tx.$executeRawUnsafe(`
            INSERT INTO ${DB_SCHEMA}.FORMS_INSTANCE (
              FORM_ID,
              ASSIGNED_ID,
              SUBMITTED_DATE,
              UPDATE_USER_ID,
              CREATE_DATE,
              UPDATE_DATE
            ) VALUES (
              ${numericTemplateId},
              ${numericUserId},
              GETDATE(),
              ${numericUserId},
              GETDATE(),
              GETDATE()
            )
          `);
          
          // Get the newly created form instance using SCOPE_IDENTITY() for reliability
          const formIdResult = await tx.$queryRawUnsafe(`
            SELECT TOP 1 FORM_INSTANCE_ID FROM ${DB_SCHEMA}.FORMS_INSTANCE 
            WHERE FORM_INSTANCE_ID = SCOPE_IDENTITY()
          `);
          
          const formInstanceId = Array.isArray(formIdResult) && formIdResult.length > 0 
            ? formIdResult[0].FORM_INSTANCE_ID 
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
        // Step 1: Create a request using raw SQL
        await tx.$executeRaw`
          INSERT INTO ${DB_SCHEMA}.REQUESTS (
            REQUEST_NAME, 
            COMPANY_ID, 
            STATUS, 
            SUBMITTED_DATE, 
            UPDATE_USER_ID, 
            CREATE_DATE, 
            UPDATE_DATE,
            ABBREVIATION,
            FORM_ID
          ) VALUES (
            ${name},
            ${numericCompanyId},
            ${userInfo.status},
            GETDATE(),
            ${numericUserId},
            GETDATE(),
            GETDATE(),
            ${abbreviation},
            ${numericTemplateId}
          )
        `;
        
        // Get the newly created request ID using SCOPE_IDENTITY() for reliability
        const requestResults = await tx.$queryRaw`
          SELECT TOP 1 REQUEST_ID FROM ${DB_SCHEMA}.REQUESTS 
          WHERE REQUEST_ID = SCOPE_IDENTITY()
        `;
        
        const requestId = Array.isArray(requestResults) && requestResults.length > 0 
          ? requestResults[0].REQUEST_ID 
          : 0;
          
        console.log('Created request with ID:', requestId);
        
        // Step 2: Create a form instance using raw SQL
        await tx.$executeRaw`
          INSERT INTO ${DB_SCHEMA}.FORMS_INSTANCE (
            FORM_ID,
            ASSIGNED_ID,
            SUBMITTED_DATE,
            UPDATE_USER_ID,
            CREATE_DATE,
            UPDATE_DATE
          ) VALUES (
            ${numericTemplateId},
            ${numericUserId},
            GETDATE(),
            ${numericUserId},
            GETDATE(),
            GETDATE()
          )
        `;
        
        // Get the newly created form instance using SCOPE_IDENTITY() for reliability
        const formInstanceResults = await tx.$queryRaw`
          SELECT TOP 1 FORM_INSTANCE_ID FROM ${DB_SCHEMA}.FORMS_INSTANCE 
          WHERE FORM_INSTANCE_ID = SCOPE_IDENTITY()
        `;
        
        const formInstanceId = Array.isArray(formInstanceResults) && formInstanceResults.length > 0 
          ? formInstanceResults[0].FORM_INSTANCE_ID 
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
        const request = await tx.$executeRawUnsafe(`
          INSERT INTO ${DB_SCHEMA}.REQUESTS (
            REQUEST_NAME,
            REQUEST_DESCRIPTION,
            ABBREVIATION,
            STATUS,
            SUBMITTED_DATE,
            CREATE_USER_ID,
            UPDATE_USER_ID,
            CREATE_DATE,
            UPDATE_DATE,
            COMPANY_ID,
            FORM_ID,
            REQUESTOR_ID
          ) VALUES (
            '${name.replace(/'/g, "''")}',
            '${description.replace(/'/g, "''")}',
            '${abbreviation.replace(/'/g, "''")}',
            'P', /* Set status to 'P' for pending */
            GETDATE(),
            ${numericUserId},
            ${numericUserId},
            GETDATE(),
            GETDATE(),
            ${numericCompanyId},
            ${numericTemplateId},
            ${numericUserId}
          );
          SELECT SCOPE_IDENTITY() as REQUEST_ID;
        `); // Get the newly created request ID
        const requestResult = await tx.$queryRawUnsafe(`
          SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS 
          WHERE REQUEST_NAME = '${name.replace(/'/g, "''")}' AND CREATE_USER_ID = ${numericUserId}
          ORDER BY CREATE_DATE DESC
        `);
        
        const requestId = Array.isArray(requestResult) && requestResult.length > 0 
          ? requestResult[0].REQUEST_ID 
          : 0;
          
        console.log('Created request with ID:', requestId);
        
        if (requestId === 0) {
          throw new Error('Failed to create request or retrieve its ID.');
        }
        
        // Step 2: Create a form instance using raw SQL to avoid case sensitivity issues
        await tx.$executeRawUnsafe(`
          INSERT INTO GUARDIAN.FORMS_INSTANCE (
            FORM_ID,
            ASSIGNED_ID,
            SUBMITTED_DATE,
            CREATE_USER_ID,
            UPDATE_USER_ID,
            CREATE_DATE,
            UPDATE_DATE
          ) VALUES (
            ${numericTemplateId},
            ${numericUserId},
            GETDATE(),
            ${numericUserId},
            ${numericUserId},
            GETDATE(),
            GETDATE()
          );
        `); // Added backtick here
        
        // Get the newly created form instance
        const formInstanceResults = await tx.$queryRawUnsafe(`
          SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
          WHERE FORM_ID = ${numericTemplateId} AND CREATE_USER_ID = ${numericUserId}
          ORDER BY CREATE_DATE DESC
        `);
        
        const formInstanceId = Array.isArray(formInstanceResults) && formInstanceResults.length > 0 
          ? formInstanceResults[0].FORM_INSTANCE_ID 
          : 0;
          
        console.log('Created form instance with ID:', formInstanceId);
        
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
      res.status(500).json({
        error: 'Error creating request',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      });
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
      
      // Use a transaction to ensure both operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Create the request directly without template validation
        const currentDate = new Date();
        
        // Step 1: Create the request using raw SQL for consistency with schema
        await tx.$executeRaw`
          INSERT INTO ${DB_SCHEMA}.REQUESTS (
            REQUEST_NAME, 
            COMPANY_ID, 
            STATUS, 
            SUBMITTED_DATE, 
            CREATE_USER_ID,
            UPDATE_USER_ID, 
            CREATE_DATE, 
            UPDATE_DATE,
            ABBREVIATION,
            FORM_ID,
            REQUESTOR_ID,
            REQUEST_DESCRIPTION
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
          )
        `;
        
        // Step 2: Get the newly created request with SCOPE_IDENTITY() to get the exact inserted ID
        const requestResults = await tx.$queryRaw`
          SELECT TOP 1 * FROM ${DB_SCHEMA}.REQUESTS 
          WHERE REQUEST_ID = SCOPE_IDENTITY()
        `;
        
        // Extract the request from the results
        const request = Array.isArray(requestResults) && requestResults.length > 0 
          ? requestResults[0] 
          : { REQUEST_ID: 0 };
        
        console.log('Created request:', request);
        
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
      // Use raw SQL query to get all active requests
      const requests = await prisma.$queryRaw`
        SELECT * FROM GUARDIAN.REQUESTS 
        WHERE STATUS <> 'D' 
        ORDER BY CREATE_DATE DESC
      `;
      
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
        SELECT * FROM GUARDIAN.REQUESTS 
        WHERE REQUEST_ID = ${requestId} 
        AND STATUS <> 'D'
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
        UPDATE REQUESTS SET UPDATE_DATE = ${currentDate} 
        WHERE REQUEST_ID = ${requestId}
      `;
      
      // Update each field individually if provided
      if (name) {
        await prisma.$executeRaw`
          UPDATE REQUESTS SET REQUEST_NAME = ${name} 
          WHERE REQUEST_ID = ${requestId}
        `;
      }
      
      if (abbreviation) {
        await prisma.$executeRaw`
          UPDATE REQUESTS SET ABBREVIATION = ${abbreviation} 
          WHERE REQUEST_ID = ${requestId}
        `;
      }
      
      if (description) {
        await prisma.$executeRaw`
          UPDATE REQUESTS SET TRACKINGID = ${description} 
          WHERE REQUEST_ID = ${requestId}
        `;
      }
      
      if (status) {
        await prisma.$executeRaw`
          UPDATE REQUESTS SET STATUS = ${status} 
          WHERE REQUEST_ID = ${requestId}
        `;
      }
      
      if (assignedId) {
        await prisma.$executeRaw`
          UPDATE REQUESTS SET ASSIGNED_ID = ${assignedId} 
          WHERE REQUEST_ID = ${requestId}
        `;
      }
      
      // Get the updated request
      const requests = await prisma.$queryRaw`
        SELECT * FROM REQUESTS WHERE REQUEST_ID = ${requestId}
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
    const requestId = parseInt(req.params.id);
    const currentDate = new Date().toISOString();
    
    try {
      // Use raw SQL to perform soft delete
      await prisma.$executeRaw`
        UPDATE REQUESTS 
        SET STATUS = 'D', UPDATE_DATE = ${currentDate} 
        WHERE REQUEST_ID = ${requestId}
      `;
      
      res.json({ message: 'Request deleted successfully' });
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
      res.status(500).json({ error: 'Failed to delete request' });
    }
  });

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
      UPDATE ${DB_SCHEMA}.REQUESTS 
      SET ASSIGNED_ID = ${assignedUserId},
          UPDATE_USER_ID = ${updatedById},
          UPDATE_DATE = @currentDate
      WHERE REQUEST_ID = ${requestId}
    `, { currentDate });
    
    // Get the updated request to return
    const updatedRequest = await prisma.$queryRawUnsafe(`
      SELECT r.*, 
        u1.FIRST_NAME + ' ' + u1.LAST_NAME as REQUESTOR_NAME,
        u2.FIRST_NAME + ' ' + u2.LAST_NAME as ASSIGNED_TO_NAME
      FROM ${DB_SCHEMA}.REQUESTS r
      LEFT JOIN ${DB_SCHEMA}.USERS u1 ON r.REQUESTOR_ID = u1.USER_ID
      LEFT JOIN ${DB_SCHEMA}.USERS u2 ON r.ASSIGNED_ID = u2.USER_ID
      WHERE r.REQUEST_ID = ${requestId}
    `) as any[];
    
    console.log('Request assigned successfully');
    res.status(200).json(updatedRequest[0] || { message: 'Request assigned but details not available' });
  } catch (error: any) {
    console.error('Error assigning request:', error);
    res.status(500).json({
      error: 'Error assigning request',
      details: error?.message || 'Unknown error'
    });
  }
});

export default router;
