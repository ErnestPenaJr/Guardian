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
app.get('/api/requests', async (req, res) => {
    try {
        console.log('📋 Fetching requests from database...');

        // Get requests from database with all fields and related user information
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
app.get('/api/users', async (req, res) => {
    try {
        console.log('👥 Fetching all users...');

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
            WHERE u.STATUS = 'A'
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
app.get('/api/users/company/:companyId', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId);
        console.log(`👥 Fetching users for company ID: ${companyId}`);

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
app.put('/api/requests/:requestId/assign', async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { assignedUserId } = req.body;

        console.log(`📝 Assigning request ${requestId} to user ${assignedUserId}`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET ASSIGNED_ID = ${assignedUserId || null}, 
                UPDATE_DATE = GETDATE()
            WHERE REQUEST_ID = ${requestId}
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

// Get all forms for a company
app.get('/api/forms', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const companyId = decoded.companyId;

        console.log(`📋 Fetching forms from database for company: ${companyId}`);
        
        // First check if any forms exist at all
        const allForms = await prisma.$queryRaw`
            SELECT COUNT(*) as total_forms FROM GUARDIAN.FORMS 
            WHERE IS_DELETED = 0 AND IS_ACTIVE = 1
        `;
        console.log(`📊 Total active forms in database: ${allForms[0]?.total_forms || 0}`);
        
        // Check global forms specifically
        const globalForms = await prisma.$queryRaw`
            SELECT COUNT(*) as global_forms FROM GUARDIAN.FORMS 
            WHERE COMPANY_ID IS NULL AND IS_DELETED = 0 AND IS_ACTIVE = 1
        `;
        console.log(`🌍 Global forms (COMPANY_ID IS NULL): ${globalForms[0]?.global_forms || 0}`);

        const forms = await prisma.$queryRaw`
            SELECT f.* 
            FROM GUARDIAN.FORMS f
            WHERE (f.COMPANY_ID = ${companyId} OR f.COMPANY_ID IS NULL)
            AND f.IS_DELETED = 0
            AND f.IS_ACTIVE = 1
            ORDER BY f.FORM_NAME
        `;

        console.log(`✅ Found ${forms.length} forms for company ${companyId}`);

        const formattedForms = forms.map(form => ({
            FORM_ID: form.FORM_ID,
            FORM_NAME: form.FORM_NAME,
            FORM_DESCRIPTION: form.FORM_DESCRIPTION,
            IS_PUBLIC: form.IS_PUBLIC,
            IS_ACTIVE: form.IS_ACTIVE,
            IS_DELETED: form.IS_DELETED,
            CREATE_DATE: form.CREATE_DATE,
            UPDATE_DATE: form.UPDATE_DATE
        }));

        console.log(`📤 Sending ${formattedForms.length} formatted forms to frontend`);
        
        // Prevent caching to ensure fresh data
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
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
app.get('/api/field-types', async (req, res) => {
    try {
        console.log('📊 Fetching field types from database...');

        const fieldTypes = await prisma.$queryRaw`
            SELECT * FROM GUARDIAN.FIELD_TYPE 
            ORDER BY SORT_ORDER
        `;

        console.log(`✅ Found ${fieldTypes.length} field types`);

        res.json(fieldTypes);

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
app.get('/api/fields', async (req, res) => {
    try {
        console.log('🔗 Fetching fields from database...');

        const fields = await prisma.$queryRaw`
            SELECT * FROM GUARDIAN.FIELDS 
            WHERE IS_DELETED = 0
            ORDER BY FIELD_NAME
        `;

        console.log(`✅ Found ${fields.length} fields`);

        res.json(fields);

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