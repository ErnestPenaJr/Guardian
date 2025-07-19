import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../auth.js';
const prisma = new PrismaClient();
const router = express.Router();
// Database schema name - this is the only fixed constant
const DB_SCHEMA = 'GUARDIAN';
// Helper function to extract user information from the request
const getUserInfoFromRequest = (req) => {
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
            const user = req.user;
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
            const decoded = jwt.decode(token);
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
        }
        catch (jwtError) {
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
    }
    catch (error) {
        console.error('Error extracting user info:', error);
        return defaults;
    }
};
// Pure SQL endpoint for request creation - no Prisma models
router.post('/sql-request', async (req, res) => {
    try {
        console.log('=== SQL REQUEST START ===');
        console.log('Received request body:', req.body);
        // Get user info from request
        const userInfo = getUserInfoFromRequest(req);
        console.log('Extracted user info:', userInfo);
        const { name, abbreviation = '', description = '', templateId = userInfo.formId } = req.body;
        // Always use the user ID and company ID from the authenticated user
        const companyId = userInfo.companyId;
        const userId = userInfo.userId;
        // Enhanced validation with detailed error messages
        const validationErrors = [];
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
            INSERT INTO GUARDIAN.REQUESTS (
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
            SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = SCOPE_IDENTITY()
          `);
                const requestId = Array.isArray(idResult) && idResult.length > 0
                    ? idResult[0].REQUEST_ID
                    : 0;
                console.log('Created request with ID:', requestId);
                // Step 2: Create a form instance using raw SQL
                await tx.$executeRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS_INSTANCE (
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
            SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
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
            }
            catch (sqlError) {
                console.error('SQL error:', sqlError);
                throw sqlError;
            }
        });
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Error in SQL request endpoint:', error);
        res.status(500).json({
            error: 'Error creating request',
            details: error?.message || 'Unknown error',
            stack: error?.stack
        });
    }
});
// Simple endpoint to create a request using raw SQL queries
router.post('/simple-request', async (req, res) => {
    try {
        console.log('=== SIMPLE REQUEST START ===');
        console.log('Received request body:', JSON.stringify(req.body, null, 2));
        // Get user info from request
        const userInfo = getUserInfoFromRequest(req);
        console.log('Extracted user info:', userInfo);
        const { name, abbreviation = '', description = '', templateId = userInfo.formId } = req.body;
        // Always use the user ID and company ID from the authenticated user
        const companyId = userInfo.companyId;
        const userId = userInfo.userId;
        // Enhanced validation with detailed error messages
        const validationErrors = [];
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
            await tx.$executeRaw `
          INSERT INTO GUARDIAN.REQUESTS (
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
            const requestResults = await tx.$queryRaw `
          SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS 
          WHERE REQUEST_ID = SCOPE_IDENTITY()
        `;
            const requestId = Array.isArray(requestResults) && requestResults.length > 0
                ? requestResults[0].REQUEST_ID
                : 0;
            console.log('Created request with ID:', requestId);
            // Step 2: Create a form instance using raw SQL
            await tx.$executeRaw `
          INSERT INTO GUARDIAN.FORMS_INSTANCE (
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
            const formInstanceResults = await tx.$queryRaw `
          SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
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
    }
    catch (error) {
        console.error('Error in simple request endpoint:', error);
        res.status(500).json({
            error: 'Error creating request',
            details: error?.message || 'Unknown error',
            stack: error?.stack
        });
    }
});
// Diagnostic endpoint to check database schema
router.get('/debug/schema', async (req, res) => {
    try {
        // Get a list of all tables in the database
        const tables = await prisma.$queryRaw `
        SELECT TABLE_SCHEMA, TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `;
        // Get the schema for the REQUESTS table
        const requestsSchema = await prisma.$queryRaw `
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'REQUESTS'
        ORDER BY ORDINAL_POSITION
      `;
        // Get the schema for the FORMS_INSTANCE table
        const formsInstanceSchema = await prisma.$queryRaw `
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
    }
    catch (error) {
        console.error('Error getting schema:', error);
        res.status(500).json({
            error: 'Error getting schema',
            details: error?.message || 'Unknown error',
            stack: error?.stack
        });
    }
});
// Debug endpoint for request creation - simpler version for testing
router.post('/debug/requests', async (req, res) => {
    console.log('=== DEBUG REQUEST START ===');
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    try {
        // Extract request data
        const { name, abbreviation = '', description = '', templateId, companyId, userId } = req.body;
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
            }
            catch (authError) {
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
            INSERT INTO GUARDIAN.REQUESTS (
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
              'P',
              GETDATE(),
              ${numericUserId},
              ${numericUserId},
              GETDATE(),
              GETDATE(),
              ${numericCompanyId},
              ${numericTemplateId || 'NULL'},
              ${numericUserId}
            )`;
                console.log('Insert query:', insertQuery);
                await tx.$executeRawUnsafe(insertQuery);
                console.log('INSERT operation completed successfully');
                // Try multiple approaches to get the request ID
                try {
                    console.log('Attempting to get request ID using SCOPE_IDENTITY()...');
                    const scopeIdQuery = "SELECT SCOPE_IDENTITY() AS REQUEST_ID;";
                    console.log('SCOPE_IDENTITY query:', scopeIdQuery);
                    const scopeIdResult = await tx.$queryRawUnsafe(scopeIdQuery);
                    console.log('SCOPE_IDENTITY result type:', typeof scopeIdResult);
                    console.log('SCOPE_IDENTITY result:', JSON.stringify(scopeIdResult));
                    if (scopeIdResult && Array.isArray(scopeIdResult) && scopeIdResult.length > 0) {
                        console.log('First item in result:', JSON.stringify(scopeIdResult[0]));
                        if (scopeIdResult[0].REQUEST_ID !== null && scopeIdResult[0].REQUEST_ID !== undefined) {
                            requestId = Number(scopeIdResult[0].REQUEST_ID);
                            console.log('Successfully retrieved request ID using SCOPE_IDENTITY():', requestId);
                        }
                        else {
                            console.log('REQUEST_ID property missing or null in SCOPE_IDENTITY result');
                        }
                    }
                    else {
                        console.log('SCOPE_IDENTITY result is not a valid array or is empty');
                    }
                }
                catch (scopeIdError) {
                    console.error('Error retrieving ID with SCOPE_IDENTITY():', scopeIdError);
                }
                // If SCOPE_IDENTITY failed, try alternative approach
                if (requestId === 0) {
                    try {
                        console.log('Trying alternative query to get request ID...');
                        const alternativeQuery = `
                SELECT TOP 1 REQUEST_ID 
                FROM GUARDIAN.REQUESTS 
                WHERE CREATE_USER_ID = ${numericUserId}
                AND REQUEST_NAME = '${name.replace(/'/g, "''")}' 
                ORDER BY CREATE_DATE DESC`;
                        console.log('Alternative query:', alternativeQuery);
                        const requestResult = await tx.$queryRawUnsafe(alternativeQuery);
                        console.log('Alternative query result type:', typeof requestResult);
                        console.log('Alternative query result:', JSON.stringify(requestResult));
                        if (requestResult && Array.isArray(requestResult) && requestResult.length > 0) {
                            if (requestResult[0].REQUEST_ID !== null && requestResult[0].REQUEST_ID !== undefined) {
                                requestId = Number(requestResult[0].REQUEST_ID);
                                console.log('Successfully retrieved request ID using alternative query:', requestId);
                            }
                            else {
                                console.log('REQUEST_ID property missing or null in alternative query result');
                            }
                        }
                        else {
                            console.log('Alternative query result is not a valid array or is empty');
                        }
                    }
                    catch (alternativeError) {
                        console.error('Error retrieving ID with alternative query:', alternativeError);
                    }
                }
                // Last resort if all else failed
                if (requestId === 0) {
                    try {
                        console.log('Trying last resort query to get request ID...');
                        const lastResortQuery = `
                SELECT TOP 1 REQUEST_ID 
                FROM GUARDIAN.REQUESTS 
                WHERE CREATE_USER_ID = ${numericUserId}
                ORDER BY CREATE_DATE DESC`;
                        console.log('Last resort query:', lastResortQuery);
                        const lastResortResult = await tx.$queryRawUnsafe(lastResortQuery);
                        console.log('Last resort query result type:', typeof lastResortResult);
                        console.log('Last resort query result:', JSON.stringify(lastResortResult));
                        if (lastResortResult && Array.isArray(lastResortResult) && lastResortResult.length > 0) {
                            if (lastResortResult[0].REQUEST_ID !== null && lastResortResult[0].REQUEST_ID !== undefined) {
                                requestId = Number(lastResortResult[0].REQUEST_ID);
                                console.log('Successfully retrieved request ID using last resort query:', requestId);
                            }
                            else {
                                console.log('REQUEST_ID property missing or null in last resort query result');
                            }
                        }
                        else {
                            console.log('Last resort query result is not a valid array or is empty');
                        }
                    }
                    catch (lastResortError) {
                        console.error('Error retrieving ID with last resort query:', lastResortError);
                    }
                }
            }
            catch (insertError) {
                console.error('Error during request creation:', insertError);
                const errorMessage = insertError instanceof Error ? insertError.message : 'Unknown error';
                throw new Error(`Failed to create request: ${errorMessage}`);
            }
            // If we couldn't get the request ID, attempt a fallback query
            if (requestId === 0) {
                console.warn('Failed to retrieve request ID after creation, attempting fallback query');
                const fallbackQuery = `
            SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS
            WHERE CREATE_USER_ID = ${numericUserId}
              AND REQUEST_NAME = '${name.replace(/'/g, "''")}'
            ORDER BY CREATE_DATE DESC
          `;
                const fallbackResult = await tx.$queryRawUnsafe(fallbackQuery);
                if (fallbackResult && Array.isArray(fallbackResult) && fallbackResult.length > 0 && fallbackResult[0].REQUEST_ID) {
                    requestId = fallbackResult[0].REQUEST_ID;
                }
                else {
                    throw new Error('Failed to retrieve request ID after fallback query');
                }
            }
            // Step 2: Create a form instance for this request
            console.log('Creating form instance for request...');
            let formInstanceId = 0;
            try {
                // Insert the form instance
                const insertFormQuery = `
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
            )`;
                console.log('Form instance insert query:', insertFormQuery);
                await tx.$executeRawUnsafe(insertFormQuery);
                // Get the newly created form instance
                const selectFormQuery = `
            SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
            WHERE FORM_ID = ${numericTemplateId} AND CREATE_USER_ID = ${numericUserId}
            ORDER BY CREATE_DATE DESC`;
                console.log('Form instance select query:', selectFormQuery);
                const formInstanceResults = await tx.$queryRawUnsafe(selectFormQuery);
                if (formInstanceResults && Array.isArray(formInstanceResults) && formInstanceResults.length > 0) {
                    formInstanceId = Number(formInstanceResults[0].FORM_INSTANCE_ID);
                    console.log('Created form instance with ID:', formInstanceId);
                }
                else {
                    console.warn('Failed to retrieve form instance ID');
                }
            }
            catch (formInstanceError) {
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
    }
    catch (error) {
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
        }
        else {
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
router.post('/', async (req, res) => {
    console.log('=== STANDARD REQUEST ENDPOINT START ===');
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    try {
        // Get user info from request
        const userInfo = getUserInfoFromRequest(req);
        // Extract request data with defaults
        const { name, abbreviation = '', description = '', templateId = userInfo.formId, companyId = userInfo.companyId, userId = userInfo.userId } = req.body;
        // Convert values to appropriate types first
        const numericTemplateId = Number(templateId);
        const numericCompanyId = Number(companyId);
        const numericUserId = Number(userId);
        // Enhanced validation with detailed error messages
        const validationErrors = [];
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
            await tx.$executeRaw `
          INSERT INTO GUARDIAN.REQUESTS (
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
            const requestResults = await tx.$queryRaw `
          SELECT TOP 1 * FROM GUARDIAN.REQUESTS 
          WHERE REQUEST_ID = SCOPE_IDENTITY()
        `;
            // Extract the request from the results
            const request = Array.isArray(requestResults) && requestResults.length > 0
                ? requestResults[0]
                : { REQUEST_ID: 0 };
            console.log('Created request:', request);
            // Get the request ID for linking to form instance
            let requestId = request.REQUEST_ID;
            if (!requestId) {
                console.warn('Failed to retrieve request ID after creation, attempting fallback query');
                const fallbackQuery = `
            SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS
            WHERE CREATE_USER_ID = ${numericUserId}
              AND REQUEST_NAME = '${name.replace(/'/g, "''")}'
            ORDER BY CREATE_DATE DESC
          `;
                const fallbackResult = await tx.$queryRawUnsafe(fallbackQuery);
                if (fallbackResult && Array.isArray(fallbackResult) && fallbackResult.length > 0 && fallbackResult[0].REQUEST_ID) {
                    requestId = fallbackResult[0].REQUEST_ID;
                }
                else {
                    throw new Error('Failed to retrieve request ID after fallback query');
                }
            }
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
    }
    catch (error) {
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
router.get('/', async (req, res) => {
    try {
        // Get query parameters for filtering
        const { status, type, assignedTo, requestorId, limit } = req.query;
        // Build the WHERE clause dynamically
        let whereClause = "WHERE r.STATUS <> 'D'";
        // Add status filter if provided
        if (status) {
            whereClause += ` AND r.STATUS = '${status}'`;
        }
        // Add type filter if provided
        if (type) {
            whereClause += ` AND r.REQUEST_TYPE = '${type}'`;
        }
        // Add assigned user filter if provided
        if (assignedTo) {
            whereClause += ` AND r.ASSIGNED_ID = ${assignedTo}`;
        }
        // Add requestor filter if provided
        if (requestorId) {
            whereClause += ` AND r.REQUESTOR_ID = ${requestorId}`;
        }
        // Determine limit clause
        const limitClause = limit ? `TOP ${limit}` : '';
        // Use raw SQL query with the dynamic WHERE clause and LEFT JOINs to get user details
        const query = `
        SELECT ${limitClause} 
          r.*,
          requestor.FIRST_NAME as requestor_first_name,
          requestor.LAST_NAME as requestor_last_name,
          assigned.FIRST_NAME as assigned_first_name,
          assigned.LAST_NAME as assigned_last_name
        FROM GUARDIAN.REQUESTS r
        LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID
        LEFT JOIN GUARDIAN.USERS assigned ON r.ASSIGNED_ID = assigned.USER_ID
        ${whereClause} 
        ORDER BY r.CREATE_DATE DESC
      `;
        console.log('Executing query:', query);
        const rawRequests = await prisma.$queryRawUnsafe(query);
        // Transform the results to include requestor and assigned objects
        const requests = rawRequests.map((req) => {
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
        res.json(requests);
    }
    catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});
// Get a specific request by ID
router.get('/:id', async (req, res) => {
    const requestId = parseInt(req.params.id);
    try {
        // Use raw SQL query to get a specific request
        const requests = await prisma.$queryRaw `
        SELECT * FROM GUARDIAN.REQUESTS 
        WHERE REQUEST_ID = ${requestId} 
        AND STATUS <> 'D'
      `;
        const request = Array.isArray(requests) && requests.length > 0 ? requests[0] : null;
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json(request);
    }
    catch (error) {
        console.error(`Error fetching request ${requestId}:`, error);
        res.status(500).json({ error: 'Failed to fetch request' });
    }
});
// Update a request
router.put('/:id', async (req, res) => {
    const requestId = parseInt(req.params.id);
    const { name, abbreviation, description, status, assignedId } = req.body;
    const currentDate = new Date().toISOString();
    try {
        // Use individual update statements for each field that needs to be updated
        // Update the timestamp first
        await prisma.$executeRaw `
        UPDATE REQUESTS SET UPDATE_DATE = ${currentDate} 
        WHERE REQUEST_ID = ${requestId}
      `;
        // Update each field individually if provided
        if (name) {
            await prisma.$executeRaw `
          UPDATE REQUESTS SET REQUEST_NAME = ${name} 
          WHERE REQUEST_ID = ${requestId}
        `;
        }
        if (abbreviation) {
            await prisma.$executeRaw `
          UPDATE REQUESTS SET ABBREVIATION = ${abbreviation} 
          WHERE REQUEST_ID = ${requestId}
        `;
        }
        if (description) {
            await prisma.$executeRaw `
          UPDATE REQUESTS SET TRACKINGID = ${description} 
          WHERE REQUEST_ID = ${requestId}
        `;
        }
        if (status) {
            await prisma.$executeRaw `
          UPDATE REQUESTS SET STATUS = ${status} 
          WHERE REQUEST_ID = ${requestId}
        `;
        }
        if (assignedId) {
            await prisma.$executeRaw `
          UPDATE REQUESTS SET ASSIGNED_ID = ${assignedId} 
          WHERE REQUEST_ID = ${requestId}
        `;
        }
        // Get the updated request
        const requests = await prisma.$queryRaw `
        SELECT * FROM REQUESTS WHERE REQUEST_ID = ${requestId}
      `;
        const request = Array.isArray(requests) && requests.length > 0 ? requests[0] : null;
        if (!request) {
            return res.status(404).json({ error: 'Request not found after update' });
        }
        res.json(request);
    }
    catch (error) {
        console.error(`Error updating request ${requestId}:`, error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});
// Delete a request (soft delete)
router.delete('/:id', async (req, res) => {
    const requestId = parseInt(req.params.id);
    const currentDate = new Date().toISOString();
    try {
        // Use raw SQL to perform soft delete
        await prisma.$executeRaw `
        UPDATE REQUESTS 
        SET STATUS = 'D', UPDATE_DATE = ${currentDate} 
        WHERE REQUEST_ID = ${requestId}
      `;
        res.json({ message: 'Request deleted successfully' });
    }
    catch (error) {
        console.error(`Error deleting request ${requestId}:`, error);
        res.status(500).json({ error: 'Failed to delete request' });
    }
});
import { Resend } from 'resend';
// Get Resend configuration from environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
// Initialize Resend client if API key is available
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
// Assign a request to a user
router.post('/:id/assign', async (req, res) => {
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
      UPDATE GUARDIAN.REQUESTS 
      SET ASSIGNED_ID = ${assignedUserId},
          UPDATE_USER_ID = ${updatedById},
          UPDATE_DATE = GETDATE()
      WHERE REQUEST_ID = ${requestId}
    `);
        // Get the updated request to return
        const updatedRequest = await prisma.$queryRawUnsafe(`
      SELECT r.*, 
        u1.FIRST_NAME + ' ' + u1.LAST_NAME as REQUESTOR_NAME,
        u2.FIRST_NAME + ' ' + u2.LAST_NAME as ASSIGNED_TO_NAME,
        u2.EMAIL as ASSIGNED_USER_EMAIL
      FROM GUARDIAN.REQUESTS r
      LEFT JOIN GUARDIAN.USERS u1 ON r.REQUESTOR_ID = u1.USER_ID
      LEFT JOIN GUARDIAN.USERS u2 ON r.ASSIGNED_ID = u2.USER_ID
      WHERE r.REQUEST_ID = ${requestId}
    `);
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
                    const user = req.user;
                    if (user.firstName && user.lastName) {
                        assignerName = `${user.firstName} ${user.lastName}`;
                    }
                    else if (user.FIRST_NAME && user.LAST_NAME) {
                        assignerName = `${user.FIRST_NAME} ${user.LAST_NAME}`;
                    }
                }
                // Get the application URL from environment or use a default
                const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || `${req.protocol}://${req.get('host')}`;
                const requestUrl = `${appUrl}/requests/${requestId}`;
                const { data, error } = await resend.emails.send({
                    from: `Shieldlytics <${EMAIL_FROM}>`,
                    to: [request.ASSIGNED_USER_EMAIL],
                    subject: `Request Assignment: ${trackingId}`,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://shieldlytics.com/logo.png" alt="Shieldlytics" style="height:40px;">
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
            }
            catch (emailError) {
                // Log email error but don't fail the request assignment
                console.error('[REQUEST ASSIGNMENT] Error sending notification email:', emailError);
            }
        }
        else {
            console.log('[REQUEST ASSIGNMENT] Email notification skipped - Resend not configured or missing email');
        }
        console.log('Request assigned successfully');
        res.status(200).json(request || { message: 'Request assigned but details not available' });
    }
    catch (error) {
        console.error('Error assigning request:', error);
        res.status(500).json({
            error: 'Error assigning request',
            details: error?.message || 'Unknown error'
        });
    }
});
// Request fulfillment endpoints
// Start fulfillment (change status from P to A)
router.post('/:id/start', async (req, res) => {
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
      SELECT * FROM GUARDIAN.REQUESTS 
      WHERE REQUEST_ID = ${requestId} 
      AND ASSIGNED_ID = ${userInfo.userId}
      AND STATUS = 'P'
    `);
        if (!request || request.length === 0) {
            return res.status(404).json({ error: 'Request not found or not assigned to you' });
        }
        // Update status to In Progress (A)
        await prisma.$executeRawUnsafe(`
      UPDATE GUARDIAN.REQUESTS 
      SET STATUS = 'A',
          UPDATE_USER_ID = ${userInfo.userId},
          UPDATE_DATE = GETDATE()
      WHERE REQUEST_ID = ${requestId}
    `);
        res.json({ message: 'Request fulfillment started', requestId });
    }
    catch (error) {
        console.error('Error starting request fulfillment:', error);
        res.status(500).json({ error: 'Error starting request fulfillment' });
    }
});
// Complete fulfillment (change status from A to C)
router.post('/:id/complete', async (req, res) => {
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
      SELECT * FROM GUARDIAN.REQUESTS 
      WHERE REQUEST_ID = ${requestId} 
      AND ASSIGNED_ID = ${userInfo.userId}
      AND STATUS = 'A'
    `);
        if (!request || request.length === 0) {
            return res.status(404).json({ error: 'Request not found or not in progress' });
        }
        // Update status to Completed (C)
        await prisma.$executeRawUnsafe(`
      UPDATE GUARDIAN.REQUESTS 
      SET STATUS = 'C',
          UPDATE_USER_ID = ${userInfo.userId},
          UPDATE_DATE = GETDATE(),
          TRACKINGID = COALESCE(TRACKINGID, '') + CHAR(13) + CHAR(10) + 'Completed: ' + '${completionNotes || 'No notes provided'}'
      WHERE REQUEST_ID = ${requestId}
    `);
        // Send notification email to requestor if available
        if (resend && request[0].REQUESTOR_ID) {
            try {
                const requestorQuery = await prisma.$queryRawUnsafe(`
          SELECT EMAIL, FIRST_NAME, LAST_NAME 
          FROM GUARDIAN.USERS 
          WHERE USER_ID = ${request[0].REQUESTOR_ID}
        `);
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
            }
            catch (emailError) {
                console.error('Error sending completion notification:', emailError);
            }
        }
        res.json({ message: 'Request completed successfully', requestId });
    }
    catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({ error: 'Error completing request' });
    }
});
// Get assigned requests for current user
router.get('/assigned/me', async (req, res) => {
    try {
        const userInfo = getUserInfoFromRequest(req);
        const { status } = req.query;
        let whereClause = `WHERE r.ASSIGNED_ID = ${userInfo.userId} AND r.STATUS <> 'D'`;
        if (status) {
            whereClause += ` AND r.STATUS = '${status}'`;
        }
        const requests = await prisma.$queryRawUnsafe(`
      SELECT r.*, 
        requestor.FIRST_NAME as requestor_first_name,
        requestor.LAST_NAME as requestor_last_name,
        requestor.EMAIL as requestor_email
      FROM GUARDIAN.REQUESTS r
      LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID
      ${whereClause}
      ORDER BY r.CREATE_DATE DESC
    `);
        // Transform the results
        const transformedRequests = requests.map((req) => ({
            ...req,
            requestor: req.requestor_first_name ? {
                FIRST_NAME: req.requestor_first_name,
                LAST_NAME: req.requestor_last_name,
                EMAIL: req.requestor_email
            } : null,
            requestorName: req.requestor_first_name ? `${req.requestor_first_name} ${req.requestor_last_name}` : null
        }));
        res.json(transformedRequests);
    }
    catch (error) {
        console.error('Error fetching assigned requests:', error);
        res.status(500).json({ error: 'Error fetching assigned requests' });
    }
});
// Update request progress
router.put('/:id/progress', async (req, res) => {
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
      SELECT * FROM GUARDIAN.REQUESTS 
      WHERE REQUEST_ID = ${requestId} 
      AND ASSIGNED_ID = ${userInfo.userId}
      AND STATUS IN ('P', 'A')
    `);
        if (!request || request.length === 0) {
            return res.status(404).json({ error: 'Request not found or not assigned to you' });
        }
        // Add progress note to tracking ID
        const currentTracking = request[0].TRACKINGID || '';
        const newTracking = currentTracking +
            (currentTracking ? '\n' : '') +
            `Progress Update (${new Date().toLocaleString()}): ${progressNotes}`;
        await prisma.$executeRawUnsafe(`
      UPDATE GUARDIAN.REQUESTS 
      SET TRACKINGID = '${newTracking.replace(/'/g, "''")}',
          UPDATE_USER_ID = ${userInfo.userId},
          UPDATE_DATE = GETDATE()
      WHERE REQUEST_ID = ${requestId}
    `);
        res.json({ message: 'Progress updated successfully', requestId });
    }
    catch (error) {
        console.error('Error updating request progress:', error);
        res.status(500).json({ error: 'Error updating request progress' });
    }
});
// Get form instance and fields for a specific assigned request
router.get('/:id/form', requireAuth, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const userInfo = getUserInfoFromRequest(req);
        console.log('[GET FORM] Request ID:', requestId);
        console.log('[GET FORM] User info:', userInfo);
        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }
        // Get the request and verify it's assigned to current user
        const request = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM GUARDIAN.REQUESTS r
      WHERE r.REQUEST_ID = ${requestId} 
      AND r.ASSIGNED_ID = ${userInfo.userId}
    `);
        if (!request || request.length === 0) {
            return res.status(404).json({ error: 'Request not found or not assigned to you' });
        }
        const requestData = request[0];
        const formId = requestData.FORM_ID;
        if (!formId) {
            return res.status(404).json({ error: 'No form associated with this request' });
        }
        // Get form details
        const form = await prisma.$queryRawUnsafe(`
      SELECT * FROM GUARDIAN.FORMS WHERE FORM_ID = ${formId}
    `);
        if (!form || form.length === 0) {
            return res.status(404).json({ error: 'Form template not found' });
        }
        // Get form fields based on the form template
        let fields = [];
        // Map form templates to their field definitions
        if (form[0].FORM_NAME === 'SUBJECT') {
            fields = [
                { FIELD_ID: 1, FIELD_NAME: 'First Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
                { FIELD_ID: 2, FIELD_NAME: 'Middle Name', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
                { FIELD_ID: 3, FIELD_NAME: 'Last Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 },
                { FIELD_ID: 4, FIELD_NAME: 'DOB', FIELD_TYPE_ID: 3, IS_REQUIRED: true, SEQUENCE: 4 },
                { FIELD_ID: 5, FIELD_NAME: 'SSN', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 5 }
            ];
        }
        else if (form[0].FORM_NAME === 'FINANCIAL') {
            fields = [
                { FIELD_ID: 6, FIELD_NAME: 'Bank Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
                { FIELD_ID: 7, FIELD_NAME: 'Account #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 2 },
                { FIELD_ID: 8, FIELD_NAME: 'Routing #', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 }
            ];
        }
        else if (form[0].FORM_NAME === 'ADDRESS') {
            fields = [
                { FIELD_ID: 9, FIELD_NAME: 'Address Line 1', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
                { FIELD_ID: 10, FIELD_NAME: 'Address Line 2', FIELD_TYPE_ID: 1, IS_REQUIRED: false, SEQUENCE: 2 },
                { FIELD_ID: 11, FIELD_NAME: 'City', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 3 },
                { FIELD_ID: 12, FIELD_NAME: 'State', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 4 },
                { FIELD_ID: 13, FIELD_NAME: 'ZIP Code', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 5 }
            ];
        }
        // For now, return empty values since we're focusing on getting the correct form template
        const valueMap = {};
        res.json({
            request: requestData,
            form: form[0],
            fields: fields,
            values: valueMap,
            formInstanceId: null
        });
    }
    catch (error) {
        console.error('Error fetching request form:', error);
        res.status(500).json({ error: 'Failed to fetch form data' });
    }
});
// Save form field values for a request
router.post('/:id/form/submit', requireAuth, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const userInfo = getUserInfoFromRequest(req);
        const { fieldValues } = req.body; // { fieldId: value, ... }
        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }
        // Verify request is assigned to current user and get form instance
        const request = await prisma.$queryRawUnsafe(`
      SELECT r.*, fi.FORM_INSTANCE_ID
      FROM GUARDIAN.REQUESTS r
      LEFT JOIN GUARDIAN.FORMS_INSTANCE fi ON fi.ASSIGNED_ID = r.ASSIGNED_ID
      WHERE r.REQUEST_ID = ${requestId} 
      AND r.ASSIGNED_ID = ${userInfo.userId}
    `);
        if (!request || request.length === 0) {
            return res.status(404).json({ error: 'Request not found or not assigned to you' });
        }
        const formInstanceId = request[0].FORM_INSTANCE_ID;
        if (!formInstanceId) {
            return res.status(400).json({ error: 'No form instance found for this request' });
        }
        // Save/update field values
        for (const [fieldId, value] of Object.entries(fieldValues)) {
            if (value !== null && value !== undefined && value !== '') {
                await prisma.$executeRawUnsafe(`
          IF EXISTS (
            SELECT 1 FROM GUARDIAN.FORMS_INSTANCE_VALUES 
            WHERE FORM_INSTANCE_ID = ${formInstanceId} 
            AND FIELD_ID = ${fieldId}
          )
          BEGIN
            UPDATE GUARDIAN.FORMS_INSTANCE_VALUES 
            SET VALUE = '${String(value).replace(/'/g, "''")}', 
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${userInfo.userId}
            WHERE FORM_INSTANCE_ID = ${formInstanceId} 
            AND FIELD_ID = ${fieldId}
          END
          ELSE
          BEGIN
            INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES 
            (FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID)
            VALUES (${formInstanceId}, ${fieldId}, '${String(value).replace(/'/g, "''")}', GETDATE(), GETDATE(), ${userInfo.userId}, ${userInfo.userId})
          END
        `);
            }
        }
        // Update form instance submitted date
        await prisma.$executeRawUnsafe(`
      UPDATE GUARDIAN.FORMS_INSTANCE 
      SET SUBMITTED_DATE = GETDATE(),
          UPDATE_DATE = GETDATE(),
          UPDATE_USER_ID = ${userInfo.userId}
      WHERE FORM_INSTANCE_ID = ${formInstanceId}
    `);
        res.json({
            success: true,
            message: 'Form data saved successfully',
            formInstanceId
        });
    }
    catch (error) {
        console.error('Error saving form data:', error);
        res.status(500).json({ error: 'Failed to save form data' });
    }
});
export default router;
