const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

console.log('=== GUARDIAN AZURE SERVER STARTING ===');
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

// === STATIC FILE SERVING ===
// For Azure App Service, serve static files from current directory
app.use(express.static('.', {
  index: 'index.html',
  setHeaders: (res, path) => {
    // Set proper MIME types for JavaScript modules
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// === API ROUTES ===

// Basic health check (no database required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        server: 'Guardian MVP Azure Server', 
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
        message: 'Azure server running latest code with all endpoints',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: [
            '/api/users', '/api/users/company/:companyId', '/api/invites', 
            '/api/roles', '/api/requests', '/api/forms', '/api/fields', '/api/field-types',
            '/api/login', '/api/register', '/api/verify-email', '/api/complete-registration',
            '/api/request-password-reset', '/api/verify-reset-code', '/api/reset-password'
        ]
    });
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

// Get field types
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

// Get fields
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

// Registration endpoints for Azure production

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
        
        // For production, store the code in memory temporarily
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

// === SPA FALLBACK ROUTE ===
// Handle all non-API routes for React Router (must be last!)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server immediately, don't wait for database
console.log('🚀 Starting Azure Express server...');
const server = app.listen(PORT, () => {
    console.log(`✅ Azure server running on port ${PORT}`);
    console.log(`📁 Static files served from current directory`);
    console.log(`🌐 Health check: /api/health`);
    console.log(`🧪 Debug endpoints: /api/debug/endpoints`);
    console.log('🎉 Azure server startup complete!');
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