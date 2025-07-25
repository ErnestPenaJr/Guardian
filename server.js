const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

console.log('=== GUARDIAN SIMPLE SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || 3000}`);
console.log(`Process PID: ${process.pid}`);
console.log(`Current working directory: ${process.cwd()}`);

const app = express();
const PORT = process.env.PORT || 3000;

console.log('📦 Creating Prisma client...');
// Initialize Prisma with timeout
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
console.log('🔑 JWT configured');

// Test database connection with timeout
console.log('🔌 Testing database connection...');
const connectWithTimeout = () => {
  return Promise.race([
    prisma.$connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout after 10 seconds')), 10000)
    )
  ]);
};

connectWithTimeout()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️ Continuing without database connection...');
  });

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware to get user's company
const getAuthenticatedUserCompany = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authentication token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user's company ID from token
        if (!decoded.companyId) {
            return res.status(401).json({ error: 'No company ID in token' });
        }

        req.user = decoded;
        req.companyId = decoded.companyId;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid authentication token' });
    }
};

// === NO STATIC FILE SERVING IN EXPRESS ===
// Let IIS handle static files directly via web.config rules

// === API ROUTES AFTER STATIC ===

// Basic health check (no database required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        server: 'Guardian MVP Simple Server', 
        port: PORT,
        nodeVersion: process.version,
        uptime: process.uptime()
    });
});

// Basic test endpoint
app.get('/api/test', (req, res) => {
    res.json({success: true, message: 'API is working!', timestamp: new Date().toISOString()});
});

// Debug endpoint to check server version
app.get('/api/debug/endpoints', (req, res) => {
    res.json({
        success: true,
        message: 'Server running latest code with /api/invites endpoint',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        endpoints: ['/api/invites', '/api/invites/send (missing)', '/api/roles', '/api/users']
    });
});

// Debug forms endpoint (temporary)
app.get('/api/debug/forms', async (req, res) => {
    try {
        console.log('🔍 Debug: Testing forms query...');
        
        // Test basic forms query
        const allForms = await prisma.$queryRaw`
            SELECT * FROM GUARDIAN.FORMS 
            ORDER BY FORM_ID
        `;
        
        console.log(`🔍 Debug: Found ${allForms.length} total forms`);
        
        res.json({
            success: true,
            totalForms: allForms.length,
            forms: allForms,
            message: 'Debug forms query successful'
        });
        
    } catch (error) {
        console.error('🔍 Debug: Forms query error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Debug forms query failed'
        });
    }
});

// Real database authentication
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log(`🔐 Login attempt for: ${email}`);

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Query the database using raw SQL for GUARDIAN schema
        const users = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PASSWORD_HASH, STATUS, COMPANY_ID
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        if (users.length === 0) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Check if user is active
        if (user.STATUS !== 'A') {
            console.log(`❌ User not active: ${email}`);
            return res.status(401).json({
                error: 'Account is not active. Please contact support.'
            });
        }

        // Verify password
        if (!user.PASSWORD_HASH) {
            console.log(`❌ No password hash for user: ${email}`);
            return res.status(401).json({
                error: 'Password not set for this account. Please use password reset.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.PASSWORD_HASH);
        if (!isPasswordValid) {
            console.log(`❌ Invalid password for user: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Get user roles with role names
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${user.USER_ID}
        `;
        
        const roleIds = userRoles.map(ur => ur.ROLE_ID);
        const roleNames = userRoles.map(ur => ur.NAME);
        const roles = userRoles.map(ur => ({
            id: ur.ROLE_ID,
            name: ur.NAME,
            displayName: ur.DISPLAY_NAME,
            description: ur.DESCRIPTION
        }));

        // Generate JWT token with complete user data
        const token = jwt.sign(
            {
                id: user.USER_ID,
                userId: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                companyId: user.COMPANY_ID,
                roles: roleIds,
                roleNames: roleNames
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Login successful for: ${email} (User ID: ${user.USER_ID}, Company: ${user.COMPANY_ID})`);

        res.json({
            success: true,
            token: token,
            user: {
                id: user.USER_ID,
                userId: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                companyId: user.COMPANY_ID,
                company: user.COMPANY_ID,
                roles: roles,
                roleIds: roleIds,
                roleNames: roleNames,
                role: roleNames.length > 0 ? roleNames[0] : 'user',
                isAdmin: roleNames.includes('Admin') || roleNames.includes('Administrator')
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: 'Server error during login',
            message: error.message
        });
    }
});

// Real requests endpoint with database query
app.get('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📋 Fetching requests from database...');

        // Get requests from database filtered by company ID
        console.log(`📋 Fetching requests for company ID: ${req.companyId}`);
        const requests = await prisma.$queryRaw`
            SELECT 
                r.REQUEST_ID,
                r.REQUEST_NAME,
                r.REQUEST_DESCRIPTION,
                r.EXTERNAL_USER,
                r.SUBMITTED_DATE,
                r.REQUESTOR_ID,
                r.ASSIGNED_ID,
                r.STATUS,
                r.CREATE_DATE,
                r.UPDATE_DATE,
                r.CREATE_USER_ID,
                r.UPDATE_USER_ID,
                r.TRACKINGID,
                r.ABBREVIATION,
                r.COMPANY_ID,
                r.FORM_ID,
                requestor.FIRST_NAME as REQUESTOR_FIRST_NAME,
                requestor.LAST_NAME as REQUESTOR_LAST_NAME,
                requestor.EMAIL as REQUESTOR_EMAIL,
                assigned.FIRST_NAME as ASSIGNED_FIRST_NAME,
                assigned.LAST_NAME as ASSIGNED_LAST_NAME,
                assigned.EMAIL as ASSIGNED_EMAIL,
                creator.FIRST_NAME as CREATOR_FIRST_NAME,
                creator.LAST_NAME as CREATOR_LAST_NAME,
                creator.EMAIL as CREATOR_EMAIL
            FROM GUARDIAN.REQUESTS r
            LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID
            LEFT JOIN GUARDIAN.USERS assigned ON r.ASSIGNED_ID = assigned.USER_ID
            LEFT JOIN GUARDIAN.USERS creator ON r.CREATE_USER_ID = creator.USER_ID
            WHERE r.COMPANY_ID = ${req.companyId}
            ORDER BY r.CREATE_DATE DESC
        `;

        console.log(`✅ Found ${requests.length} requests in database`);

        // Format the data to match frontend expectations exactly
        const formattedRequests = requests.map(req => ({
            REQUEST_ID: req.REQUEST_ID,
            REQUEST_NAME: req.REQUEST_NAME || 'Untitled Request',
            STATUS: req.STATUS,
            FORM_ID: req.FORM_ID,
            REQUESTOR_ID: req.REQUESTOR_ID,
            ASSIGNED_ID: req.ASSIGNED_ID,
            SUBMITTED_DATE: req.SUBMITTED_DATE ? new Date(req.SUBMITTED_DATE).toISOString() : null,
            CREATE_DATE: req.CREATE_DATE ? new Date(req.CREATE_DATE).toISOString() : null,
            UPDATE_DATE: req.UPDATE_DATE ? new Date(req.UPDATE_DATE).toISOString() : null,
            CREATE_USER_ID: req.CREATE_USER_ID,
            UPDATE_USER_ID: req.UPDATE_USER_ID,
            TRACKINGID: req.TRACKINGID || `REQ-${req.REQUEST_ID}`,
            EXTERNAL_USER: req.EXTERNAL_USER,
            
            requestor: req.REQUESTOR_FIRST_NAME ? {
                FIRST_NAME: req.REQUESTOR_FIRST_NAME,
                LAST_NAME: req.REQUESTOR_LAST_NAME,
                EMAIL: req.REQUESTOR_EMAIL || ''
            } : null,
            
            assigned: req.ASSIGNED_FIRST_NAME ? {
                FIRST_NAME: req.ASSIGNED_FIRST_NAME,
                LAST_NAME: req.ASSIGNED_LAST_NAME,
                EMAIL: req.ASSIGNED_EMAIL || ''
            } : null,
            
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown',
            assignedName: req.ASSIGNED_FIRST_NAME ? 
                `${req.ASSIGNED_FIRST_NAME} ${req.ASSIGNED_LAST_NAME}` : 
                null
        }));

        console.log(`📤 Sending ${formattedRequests.length} formatted requests to frontend`);
        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching requests:', error);
        res.status(500).json({
            error: 'Failed to fetch requests',
            message: error.message
        });
    }
});

// Get all users (for backward compatibility)
app.get('/api/users', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`👥 Fetching users for company ID: ${req.companyId}`);

        const users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE,
                STRING_AGG(r.NAME, ', ') as ROLE_NAMES
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.STATUS = 'A' AND u.COMPANY_ID = ${req.companyId}
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.STATUS, u.COMPANY_ID, u.CREATE_DATE
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        console.log(`✅ Found ${users.length} users`);

        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            EMAIL: user.EMAIL,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            COMPANY_ID: user.COMPANY_ID,
            STATUS: user.STATUS,
            CREATE_DATE: user.CREATE_DATE,
            ROLE_NAMES: user.ROLE_NAMES || 'No roles assigned',
            id: user.USER_ID,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            email: user.EMAIL,
            companyId: user.COMPANY_ID,
            status: user.STATUS,
            createdAt: user.CREATE_DATE
        }));

        res.json({
            success: true,
            data: formattedUsers,
            count: formattedUsers.length
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Get users by company ID (for assignment dropdowns)
app.get('/api/users/company/:companyId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId);
        console.log(`👥 Fetching users for company ID: ${companyId}`);

        // Security check: users can only access their own company's users
        if (companyId !== req.companyId) {
            return res.status(403).json({
                error: 'Access denied: You can only view users from your own company'
            });
        }

        if (!companyId || isNaN(companyId)) {
            return res.status(400).json({
                error: 'Valid company ID is required'
            });
        }

        const users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                STRING_AGG(r.NAME, ', ') as ROLE_NAMES
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.COMPANY_ID = ${companyId} 
            AND u.STATUS = 'A'
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.STATUS, u.COMPANY_ID
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        console.log(`✅ Found ${users.length} users for company ${companyId}`);

        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            EMAIL: user.EMAIL,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            COMPANY_ID: user.COMPANY_ID,
            ROLE_NAMES: user.ROLE_NAMES || 'No roles assigned',
            value: user.USER_ID,
            label: `${user.FIRST_NAME} ${user.LAST_NAME} (${user.EMAIL})`,
            subtitle: user.ROLE_NAMES || 'No roles'
        }));

        res.json(formattedUsers);

    } catch (error) {
        console.error('❌ Error fetching company users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Update request assignment
app.put('/api/requests/:requestId/assign', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { assignedUserId } = req.body;

        console.log(`📝 Assigning request ${requestId} to user ${assignedUserId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // If assigning to someone, verify they're in the same company
        if (assignedUserId) {
            const userExists = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE USER_ID = ${assignedUserId} AND COMPANY_ID = ${req.companyId}
            `;

            if (!userExists.length) {
                return res.status(400).json({
                    error: 'Cannot assign to user outside your company'
                });
            }
        }

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET ASSIGNED_ID = ${assignedUserId || null}, 
                UPDATE_DATE = GETDATE()
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Request ${requestId} assigned successfully`);

        res.json({
            success: true,
            message: 'Request assigned successfully',
            requestId: requestId,
            assignedUserId: assignedUserId
        });

    } catch (error) {
        console.error('❌ Error assigning request:', error);
        res.status(500).json({
            error: 'Failed to assign request',
            message: error.message
        });
    }
});

// === REQUEST FULFILLMENT ENDPOINTS ===

// Get requests assigned to current user
app.get('/api/requests/assigned/me', async (req, res) => {
    try {
        // Extract user info from JWT token (you'll need to add auth middleware)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        console.log(`📋 Fetching assigned requests for user: ${userId}`);

        const requests = await prisma.$queryRaw`
            SELECT 
                r.REQUEST_ID,
                r.REQUEST_NAME,
                r.REQUEST_DESCRIPTION,
                r.STATUS,
                r.ASSIGNED_ID,
                r.REQUESTOR_ID,
                r.SUBMITTED_DATE,
                r.CREATE_DATE,
                r.UPDATE_DATE,
                r.TRACKINGID,
                r.FORM_ID,
                requestor.FIRST_NAME as REQUESTOR_FIRST_NAME,
                requestor.LAST_NAME as REQUESTOR_LAST_NAME,
                requestor.EMAIL as REQUESTOR_EMAIL
            FROM GUARDIAN.REQUESTS r
            LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID
            WHERE r.ASSIGNED_ID = ${userId}
            ORDER BY r.CREATE_DATE DESC
        `;

        const formattedRequests = requests.map(req => ({
            REQUEST_ID: req.REQUEST_ID,
            REQUEST_NAME: req.REQUEST_NAME || 'Untitled Request',
            REQUEST_DESCRIPTION: req.REQUEST_DESCRIPTION,
            STATUS: req.STATUS,
            ASSIGNED_ID: req.ASSIGNED_ID,
            REQUESTOR_ID: req.REQUESTOR_ID,
            SUBMITTED_DATE: req.SUBMITTED_DATE ? new Date(req.SUBMITTED_DATE).toISOString() : null,
            CREATE_DATE: req.CREATE_DATE ? new Date(req.CREATE_DATE).toISOString() : null,
            UPDATE_DATE: req.UPDATE_DATE ? new Date(req.UPDATE_DATE).toISOString() : null,
            TRACKINGID: req.TRACKINGID || `REQ-${req.REQUEST_ID}`,
            FORM_ID: req.FORM_ID,
            requestor: req.REQUESTOR_FIRST_NAME ? {
                FIRST_NAME: req.REQUESTOR_FIRST_NAME,
                LAST_NAME: req.REQUESTOR_LAST_NAME,
                EMAIL: req.REQUESTOR_EMAIL || ''
            } : null,
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown'
        }));

        console.log(`✅ Found ${formattedRequests.length} assigned requests`);
        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching assigned requests:', error);
        res.status(500).json({
            error: 'Failed to fetch assigned requests',
            message: error.message
        });
    }
});

// Start working on a request
app.post('/api/requests/:id/start', async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        
        // Extract user info from JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        console.log(`🚀 Starting request ${requestId} by user ${userId}`);

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'A',
                UPDATE_USER_ID = ${userId},
                UPDATE_DATE = GETDATE(),
                TRACKINGID = COALESCE(TRACKINGID, '') + CHAR(13) + CHAR(10) + 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
            WHERE REQUEST_ID = ${requestId} AND ASSIGNED_ID = ${userId}
        `;

        console.log(`✅ Request ${requestId} started successfully`);
        res.json({ success: true, message: 'Request started successfully' });

    } catch (error) {
        console.error('❌ Error starting request:', error);
        res.status(500).json({
            error: 'Failed to start request',
            message: error.message
        });
    }
});

// Complete a request
app.post('/api/requests/:id/complete', async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { completionNotes } = req.body;
        
        // Extract user info from JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        console.log(`✅ Completing request ${requestId} by user ${userId}`);

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'C',
                UPDATE_USER_ID = ${userId},
                UPDATE_DATE = GETDATE(),
                TRACKINGID = COALESCE(TRACKINGID, '') + CHAR(13) + CHAR(10) + 'Completed: ' + '${completionNotes || 'No notes provided'}'
            WHERE REQUEST_ID = ${requestId} AND ASSIGNED_ID = ${userId}
        `;

        console.log(`✅ Request ${requestId} completed successfully`);
        res.json({ success: true, message: 'Request completed successfully' });

    } catch (error) {
        console.error('❌ Error completing request:', error);
        res.status(500).json({
            error: 'Failed to complete request',
            message: error.message
        });
    }
});

// Update request progress
app.put('/api/requests/:id/progress', async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { progressNotes, progressPercentage } = req.body;
        
        // Extract user info from JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        console.log(`📊 Updating progress for request ${requestId} by user ${userId}`);

        const progressUpdate = progressNotes ? 
            `Progress Update (${progressPercentage || 0}%): ${progressNotes}` : 
            `Progress Update: ${progressPercentage || 0}%`;

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET UPDATE_USER_ID = ${userId},
                UPDATE_DATE = GETDATE(),
                TRACKINGID = COALESCE(TRACKINGID, '') + CHAR(13) + CHAR(10) + '${progressUpdate}'
            WHERE REQUEST_ID = ${requestId} AND ASSIGNED_ID = ${userId}
        `;

        console.log(`✅ Request ${requestId} progress updated successfully`);
        res.json({ success: true, message: 'Progress updated successfully' });

    } catch (error) {
        console.error('❌ Error updating progress:', error);
        res.status(500).json({
            error: 'Failed to update progress',
            message: error.message
        });
    }
});

// === FORMS API ENDPOINTS ===

// Get forms endpoint for templates
app.get('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📋 Fetching forms from database for company:', req.companyId);

        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
            FROM GUARDIAN.FORMS 
            WHERE ORGANIZATION_ID = ${req.companyId}
            ORDER BY FORM_NAME
        `;

        console.log(`✅ Found ${forms.length} forms for company ${req.companyId}`);

        // Format the data to match frontend expectations
        const formattedForms = forms.map(form => ({
            FORM_ID: form.FORM_ID,
            FORM_NAME: form.FORM_NAME,
            FORM_DESCRIPTION: form.FORM_DESCRIPTION,
            IS_ACTIVE: form.IS_ACTIVE,
            IS_PUBLIC: form.IS_PUBLIC,
            IS_DELETED: form.IS_DELETED,
            ORGANIZATION_ID: form.ORGANIZATION_ID
        }));

        console.log(`📤 Sending ${formattedForms.length} formatted forms to frontend`);
        res.json(formattedForms);

    } catch (error) {
        console.error('❌ Error fetching forms:', error);
        res.status(500).json({
            error: 'Failed to fetch forms',
            message: error.message
        });
    }
});

// Get a specific form with fields
app.get('/api/forms/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const form = await prisma.$queryRaw`
            SELECT * FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${parseInt(id)} AND IS_DELETED = 0
        `;
        
        if (form.length === 0) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Get the fields associated with this form
        const formFields = await prisma.$queryRaw`
            SELECT f.* 
            FROM GUARDIAN.FIELDS f
            JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${parseInt(id)}
            ORDER BY ff.SORT_ORDER
        `;
        
        // For fields with lookups, get their lookup values
        for (const field of formFields) {
            if (field.HAS_LOOKUP) {
                const lookups = await prisma.$queryRaw`
                    SELECT * FROM GUARDIAN.FIELDS_LOOKUP 
                    WHERE FIELD_ID = ${field.FIELD_ID}
                    ORDER BY SORT_ORDER
                `;
                
                field.OPTIONS = lookups.map(lookup => lookup.LOOKUP_DESCRIPTION).join(',');
            }
        }
        
        res.json({ form: form[0], fields: formFields });
    } catch (error) {
        console.error('❌ Error fetching form:', error);
        res.status(500).json({ error: 'Failed to fetch form' });
    }
});

// === FIELD TYPES API ENDPOINTS ===

// Get all field types
app.get('/api/field-types', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🔧 Fetching field types from database...');

        const fieldTypes = await prisma.$queryRaw`
            SELECT FIELD_TYPE_ID, FIELD_TYPE_DESC, SORT_ORDER
            FROM GUARDIAN.FIELD_TYPE 
            ORDER BY SORT_ORDER, FIELD_TYPE_DESC
        `;

        console.log(`✅ Found ${fieldTypes.length} field types`);

        // Format the data to match frontend expectations
        const formattedFieldTypes = fieldTypes.map(fieldType => ({
            FIELD_TYPE_ID: fieldType.FIELD_TYPE_ID,
            FIELD_TYPE_DESC: fieldType.FIELD_TYPE_DESC,
            SORT_ORDER: fieldType.SORT_ORDER
        }));

        console.log(`📤 Sending ${formattedFieldTypes.length} field types to frontend`);
        res.json(formattedFieldTypes);

    } catch (error) {
        console.error('❌ Error fetching field types:', error);
        res.status(500).json({
            error: 'Failed to fetch field types',
            message: error.message
        });
    }
});

// === FIELDS API ENDPOINTS ===

// Get all fields
app.get('/api/fields', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📝 Fetching fields from database for company:', req.companyId);

        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE f.ORGANIZATION_ID = ${req.companyId}
            ORDER BY f.SORT_ORDER, f.FIELD_NAME
        `;

        console.log(`✅ Found ${fields.length} fields for company ${req.companyId}`);

        // Format the data to match frontend expectations
        const formattedFields = fields.map(field => ({
            FIELD_ID: field.FIELD_ID,
            FIELD_NAME: field.FIELD_NAME,
            FIELD_TYPE_ID: field.FIELD_TYPE_ID,
            DISPLAY_FORMAT: field.DISPLAY_FORMAT,
            HAS_LOOKUP: field.HAS_LOOKUP,
            IS_PUBLIC: field.IS_PUBLIC,
            IS_ACTIVE: field.IS_ACTIVE,
            IS_DELETED: field.IS_DELETED,
            IS_REQUIRED: field.IS_REQUIRED,
            IS_SENSITIVE: field.IS_SENSITIVE,
            CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE,
            ORGANIZATION_ID: field.ORGANIZATION_ID,
            SORT_ORDER: field.SORT_ORDER,
            FIELD_TYPE: {
                FIELD_TYPE_DESC: field.FIELD_TYPE_DESC,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID
            }
        }));

        console.log(`📤 Sending ${formattedFields.length} fields to frontend`);
        res.json(formattedFields);

    } catch (error) {
        console.error('❌ Error fetching fields:', error);
        res.status(500).json({
            error: 'Failed to fetch fields',
            message: error.message
        });
    }
});

// === CREATE REQUEST ENDPOINT ===

// Create a new request
app.post('/api/requests', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        const companyId = decoded.companyId;

        const { 
            REQUEST_NAME, 
            REQUEST_DESCRIPTION, 
            FORM_ID, 
            ASSIGNED_ID, 
            EXTERNAL_USER, 
            formData 
        } = req.body;

        console.log(`📝 Creating new request: ${REQUEST_NAME} for company: ${companyId}`);

        // Create the request
        const result = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.REQUESTS (
                REQUEST_NAME, REQUEST_DESCRIPTION, FORM_ID, REQUESTOR_ID, ASSIGNED_ID,
                EXTERNAL_USER, STATUS, COMPANY_ID, CREATE_USER_ID, UPDATE_USER_ID,
                CREATE_DATE, UPDATE_DATE, SUBMITTED_DATE
            )
            OUTPUT INSERTED.REQUEST_ID
            VALUES (
                ${REQUEST_NAME}, ${REQUEST_DESCRIPTION || ''}, ${FORM_ID || null}, ${userId}, ${ASSIGNED_ID || null},
                ${EXTERNAL_USER || ''}, 'P', ${companyId}, ${userId}, ${userId},
                GETDATE(), GETDATE(), GETDATE()
            )
        `;

        // Get the newly created request ID
        const newRequest = await prisma.$queryRaw`
            SELECT TOP 1 REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE CREATE_USER_ID = ${userId} 
            ORDER BY CREATE_DATE DESC
        `;

        const requestId = newRequest[0]?.REQUEST_ID;

        if (requestId && formData) {
            // Save form field responses
            for (const [fieldId, value] of Object.entries(formData)) {
                if (value !== null && value !== undefined && value !== '') {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.REQUEST_RESPONSES (REQUEST_ID, FIELD_ID, RESPONSE_VALUE, CREATE_DATE)
                        VALUES (${requestId}, ${parseInt(fieldId)}, ${String(value)}, GETDATE())
                    `;
                }
            }
        }

        console.log(`✅ Request created successfully with ID: ${requestId}`);

        res.status(201).json({
            success: true,
            message: 'Request created successfully',
            requestId: requestId
        });

    } catch (error) {
        console.error('❌ Error creating request:', error);
        res.status(500).json({
            error: 'Failed to create request',
            message: error.message
        });
    }
});

// Get invites endpoint
app.get('/api/invites', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📧 Fetching invites for company ID: ${req.companyId}`);

        const invites = await prisma.$queryRaw`
            SELECT 
                i.INVITE_ID,
                i.EMAIL,
                i.ROLE_ID,
                i.COMPANY_ID,
                i.TOKEN,
                i.STATUS,
                i.EXPIRES_AT,
                i.USED_AT,
                i.CREATED_AT,
                r.NAME as ROLE_NAME,
                r.DISPLAY_NAME as ROLE_DISPLAY_NAME
            FROM GUARDIAN.INVITES i
            LEFT JOIN GUARDIAN.ROLES r ON i.ROLE_ID = r.ROLE_ID
            WHERE i.COMPANY_ID = ${req.companyId}
            ORDER BY i.CREATED_AT DESC
        `;

        console.log(`✅ Found ${invites.length} invites`);

        const formattedInvites = invites.map(invite => ({
            INVITE_ID: invite.INVITE_ID,
            EMAIL: invite.EMAIL,
            ROLE_ID: invite.ROLE_ID,
            COMPANY_ID: invite.COMPANY_ID,
            TOKEN: invite.TOKEN,
            STATUS: invite.STATUS,
            EXPIRES_AT: invite.EXPIRES_AT,
            USED_AT: invite.USED_AT,
            CREATED_AT: invite.CREATED_AT,
            ROLE_NAME: invite.ROLE_NAME,
            ROLE_DISPLAY_NAME: invite.ROLE_DISPLAY_NAME,
            // Add frontend-friendly aliases
            id: invite.INVITE_ID,
            email: invite.EMAIL,
            roleId: invite.ROLE_ID,
            roleName: invite.ROLE_DISPLAY_NAME || invite.ROLE_NAME,
            status: invite.STATUS,
            expiresAt: invite.EXPIRES_AT,
            usedAt: invite.USED_AT,
            createdAt: invite.CREATED_AT,
            companyId: invite.COMPANY_ID
        }));

        res.json(formattedInvites);

    } catch (error) {
        console.error('❌ Error fetching invites:', error);
        res.status(500).json({
            error: 'Failed to fetch invites',
            message: error.message
        });
    }
});

// Get roles endpoint
app.get('/api/roles', async (req, res) => {
    try {
        console.log('🎭 Fetching roles from database...');

        const roles = await prisma.$queryRaw`
            SELECT ROLE_ID, NAME, DISPLAY_NAME, DESCRIPTION, STATUS
            FROM GUARDIAN.ROLES 
            WHERE STATUS = 'A'
            ORDER BY DISPLAY_NAME
        `;

        console.log(`✅ Found ${roles.length} roles in database`);

        const formattedRoles = roles.map(role => ({
            id: role.ROLE_ID,
            ROLE_ID: role.ROLE_ID,
            name: role.NAME,
            NAME: role.NAME,
            displayName: role.DISPLAY_NAME,
            DISPLAY_NAME: role.DISPLAY_NAME,
            description: role.DESCRIPTION,
            DESCRIPTION: role.DESCRIPTION,
            status: role.STATUS,
            STATUS: role.STATUS
        }));

        res.json({
            success: true,
            data: formattedRoles,
            count: formattedRoles.length
        });

    } catch (error) {
        console.error('❌ Error fetching roles:', error);
        res.status(500).json({
            error: 'Failed to fetch roles',
            message: error.message
        });
    }
});

// Email validation endpoint (for frontend compatibility)
app.post('/api/validate-email', async (req, res) => {
    try {
        const { email, purpose = 'register' } = req.body;
        console.log(`📧 Email validation request for: ${email} (purpose: ${purpose})`);

        if (!email) {
            return res.status(400).json({
                valid: false,
                reason: 'Email is required'
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValidFormat = emailRegex.test(email);

        if (!isValidFormat) {
            return res.json({
                valid: false,
                reason: 'Invalid email format'
            });
        }

        // For registration, check if user already exists
        if (purpose === 'register') {
            const existingUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
            `;

            if (existingUser.length > 0) {
                return res.json({
                    valid: false,
                    reason: 'User with this email already exists'
                });
            }
        }

        // Email is valid
        res.json({
            valid: true,
            reason: 'Email is valid'
        });

    } catch (error) {
        console.error('❌ Email validation error:', error);
        res.status(500).json({
            valid: false,
            reason: 'Server error during email validation',
            message: error.message
        });
    }
});

// === INVITES API ENDPOINTS ===

// Send invites endpoint
app.post('/api/invites', async (req, res) => {
    try {
        const { invites } = req.body;
        console.log(`📧 Processing ${invites?.length || 0} invite requests`);

        if (!invites || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({
                error: 'Invites array is required and must not be empty'
            });
        }

        const results = [];
        const errors = [];

        for (const invite of invites) {
            try {
                const { email, roleId } = invite;

                if (!email || !roleId) {
                    errors.push(`Invalid invite data: email and roleId required`);
                    continue;
                }

                // Check if user already exists
                const existingUser = await prisma.$queryRaw`
                    SELECT USER_ID FROM GUARDIAN.USERS 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
                `;

                if (existingUser.length > 0) {
                    errors.push(`User with email ${email} already exists`);
                    continue;
                }

                // Generate unique token
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // Set expiration to 7 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                const companyId = 1; // Default company ID

                // Insert invite record
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.INVITES (EMAIL, ROLE_ID, COMPANY_ID, TOKEN, STATUS, EXPIRES_AT)
                    VALUES (${email}, ${roleId}, ${companyId}, ${token}, 'P', ${expiresAt})
                `;

                console.log(`✅ Invite created for ${email} with role ${roleId}`);
                
                results.push({
                    email: email,
                    status: 'created',
                    token: token,
                    expiresAt: expiresAt.toISOString()
                });

            } catch (inviteError) {
                console.error(`❌ Error processing invite for ${invite?.email}:`, inviteError);
                errors.push(`Failed to process invite for ${invite?.email}: ${inviteError.message}`);
            }
        }

        const response = {
            success: results.length > 0,
            message: `Processed ${invites.length} invite(s). ${results.length} created, ${errors.length} failed.`,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        };

        if (results.length === 0 && errors.length > 0) {
            return res.status(400).json(response);
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Error in invite endpoint:', error);
        res.status(500).json({
            error: 'Failed to process invites',
            message: error.message
        });
    }
});

// Registration endpoints

// Start registration process
app.post('/api/register', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`📝 Registration request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'User with this email already exists'
            });
        }

        // Generate 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // For production, we'll store the code in memory temporarily
        // In development server.cjs, this uses database storage
        global.verificationCodes = global.verificationCodes || {};
        global.verificationCodes[email] = {
            code: verificationCode,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
            verified: false
        };

        console.log(`✅ Verification code generated for ${email}: ${verificationCode}`);

        res.json({
            success: true,
            message: 'Verification code sent to your email',
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { verificationCode })
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            error: 'Failed to start registration',
            message: error.message
        });
    }
});

// Verify email with code
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        console.log(`🔍 Email verification attempt for: ${email}`);

        if (!email || !verificationCode) {
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Check verification code from memory
        global.verificationCodes = global.verificationCodes || {};
        const storedData = global.verificationCodes[email];

        if (!storedData) {
            return res.status(400).json({
                error: 'No verification code found for this email'
            });
        }

        if (new Date() > storedData.expiresAt) {
            delete global.verificationCodes[email];
            return res.status(400).json({
                error: 'Verification code has expired'
            });
        }

        if (storedData.code !== verificationCode) {
            return res.status(400).json({
                error: 'Invalid verification code'
            });
        }

        // Mark as verified
        storedData.verified = true;
        console.log(`✅ Email verified successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('❌ Email verification error:', error);
        res.status(500).json({
            error: 'Failed to verify email',
            message: error.message
        });
    }
});

// Complete registration after email verification
app.post('/api/complete-registration', async (req, res) => {
    try {
        const { email, password, fullName, workspaceName } = req.body;
        console.log(`👤 Completing registration for: ${email}`);

        if (!email || !password || !fullName) {
            return res.status(400).json({
                error: 'Email, password, and full name are required'
            });
        }

        // Check if email was verified
        global.verificationCodes = global.verificationCodes || {};
        const storedData = global.verificationCodes[email];

        if (!storedData || !storedData.verified) {
            return res.status(400).json({
                error: 'Email must be verified before completing registration'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Split full name
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create user
        const result = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                EMAIL, PASSWORD_HASH, FIRST_NAME, LAST_NAME, 
                STATUS, COMPANY_ID, CREATE_DATE, UPDATE_DATE
            )
            VALUES (
                ${email}, ${hashedPassword}, ${firstName}, ${lastName},
                'A', 1, GETDATE(), GETDATE()
            )
        `;

        // Clean up verification code
        delete global.verificationCodes[email];

        console.log(`✅ Registration completed successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Registration completed successfully'
        });

    } catch (error) {
        console.error('❌ Complete registration error:', error);
        res.status(500).json({
            error: 'Failed to complete registration',
            message: error.message
        });
    }
});

// Accept invite
app.post('/api/invite/accept', async (req, res) => {
    try {
        const { token, firstName, lastName, password } = req.body;
        console.log(`📩 Processing invite acceptance with token: ${token}`);

        if (!token || !firstName || !lastName || !password) {
            return res.status(400).json({
                error: 'Token, first name, last name, and password are required'
            });
        }

        // Find and validate invite
        const invites = await prisma.$queryRaw`
            SELECT INVITE_ID, EMAIL, ROLE_ID, COMPANY_ID, STATUS, EXPIRES_AT
            FROM GUARDIAN.INVITES 
            WHERE TOKEN = ${token} AND STATUS = 'P' AND EXPIRES_AT > GETDATE()
        `;

        if (invites.length === 0) {
            return res.status(400).json({
                error: 'Invalid or expired invite token'
            });
        }

        const invite = invites[0];

        // Check if user already exists
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${invite.EMAIL}))
        `;

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user account
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                EMAIL, PASSWORD_HASH, FIRST_NAME, LAST_NAME, 
                STATUS, COMPANY_ID, CREATE_DATE, UPDATE_DATE
            )
            VALUES (
                ${invite.EMAIL}, ${hashedPassword}, ${firstName}, ${lastName},
                'A', ${invite.COMPANY_ID}, GETDATE(), GETDATE()
            )
        `;

        // Get the newly created user ID
        const newUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${invite.EMAIL}))
        `;

        const userId = newUser[0].USER_ID;

        // Assign the role from the invite
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${userId}, ${invite.ROLE_ID}, GETDATE(), GETDATE())
        `;

        // Mark invite as used
        await prisma.$executeRaw`
            UPDATE GUARDIAN.INVITES 
            SET STATUS = 'U', USED_AT = GETDATE()
            WHERE INVITE_ID = ${invite.INVITE_ID}
        `;

        console.log(`✅ Invite accepted successfully for: ${invite.EMAIL} (User ID: ${userId})`);

        res.json({
            success: true,
            message: 'Invite accepted successfully. You can now log in.'
        });

    } catch (error) {
        console.error('❌ Invite acceptance error:', error);
        res.status(500).json({
            error: 'Failed to accept invite',
            message: error.message
        });
    }
});

// Request password reset
app.post('/api/request-password-reset', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`🔄 Password reset request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Check if user exists
        const users = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        if (users.length === 0) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        // Generate a 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store reset code in memory
        global.passwordResetCodes = global.passwordResetCodes || {};
        global.passwordResetCodes[email] = {
            code: resetCode,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15) // 15 minutes
        };

        console.log(`✅ Password reset code generated for ${email}: ${resetCode}`);

        res.json({
            success: true,
            message: 'If an account with this email exists, you will receive a password reset link.',
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { resetCode })
        });

    } catch (error) {
        console.error('❌ Password reset request error:', error);
        res.status(500).json({
            error: 'Failed to process password reset request',
            message: error.message
        });
    }
});

// Verify reset code (just validation, doesn't reset password)
app.post('/api/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        console.log(`🔍 Verifying reset code for: ${email}`);

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                error: 'Email and verification code are required'
            });
        }

        // Check reset code from memory
        global.passwordResetCodes = global.passwordResetCodes || {};
        const storedData = global.passwordResetCodes[email];

        if (!storedData) {
            return res.status(400).json({
                success: false,
                error: 'No active password reset request found'
            });
        }

        if (new Date() > storedData.expiresAt) {
            delete global.passwordResetCodes[email];
            return res.status(400).json({
                success: false,
                error: 'Verification code has expired'
            });
        }

        if (storedData.code !== code) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code'
            });
        }

        console.log(`✅ Reset code verified successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Verification code is valid'
        });

    } catch (error) {
        console.error('❌ Reset code verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify reset code',
            message: error.message
        });
    }
});

// Reset password with code
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, resetCode, newPassword } = req.body;
        // Support both 'code' and 'resetCode' parameter names
        const verificationCode = code || resetCode;
        console.log(`🔒 Password reset attempt for: ${email}`);

        if (!email || !verificationCode || !newPassword) {
            return res.status(400).json({
                error: 'Email, reset code, and new password are required'
            });
        }

        // Check reset code from memory
        global.passwordResetCodes = global.passwordResetCodes || {};
        const storedData = global.passwordResetCodes[email];

        if (!storedData) {
            return res.status(400).json({
                error: 'No active password reset request found'
            });
        }

        if (new Date() > storedData.expiresAt) {
            delete global.passwordResetCodes[email];
            return res.status(400).json({
                error: 'Password reset code has expired'
            });
        }

        if (storedData.code !== verificationCode) {
            return res.status(400).json({
                error: 'Invalid reset code'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET PASSWORD_HASH = ${hashedPassword}, UPDATE_DATE = GETDATE()
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        // Clean up reset code
        delete global.passwordResetCodes[email];

        console.log(`✅ Password reset successful for: ${email}`);

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('❌ Password reset error:', error);
        res.status(500).json({
            error: 'Failed to reset password',
            message: error.message
        });
    }
});

// Resend verification email
app.post('/api/send-verification-email', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`📧 Resend verification code request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Generate new 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set expiration to 30 minutes from now
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        // Update verification data
        global.verificationCodes = global.verificationCodes || {};
        global.verificationCodes[email] = {
            code: verificationCode,
            expiresAt: expiresAt,
            verified: false
        };

        console.log(`✅ New verification code generated for ${email}: ${verificationCode}`);

        res.json({
            success: true,
            message: 'Verification code resent to your email',
            expiryTime: expiresAt.toISOString(),
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
        });

    } catch (error) {
        console.error('❌ Resend verification error:', error);
        res.status(500).json({
            error: 'Failed to resend verification code',
            message: error.message
        });
    }
});

// Logout endpoint
app.post('/logout', async (req, res) => {
    try {
        console.log('🚪 Logout request received');
        
        // Since we're using JWT tokens (stateless), logout is mainly handled client-side
        // The client should remove the token from localStorage/sessionStorage
        // Here we can log the logout event or perform any server-side cleanup if needed
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout',
            message: error.message
        });
    }
});

// === NO CATCH-ALL ROUTE ===
// IIS handles SPA routing via web.config

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server immediately, don't wait for database
console.log('🚀 Starting Express server...');
const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Static files: ${path.join(__dirname, 'dist')}`);
    console.log(`🌐 Health check: /api/health`);
    console.log(`🧪 Simple test: /api/simple-test`);
    console.log('🎉 Server startup complete!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');  
    server.close(() => process.exit(0));
});

module.exports = app;