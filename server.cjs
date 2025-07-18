const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Email service using Resend
let sendVerificationEmail, sendInviteEmail;

try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.SMTP_PASSWORD); // Resend API key
    const FROM_EMAIL = process.env.EMAIL_FROM || 'support@shieldlytics.com';

    sendVerificationEmail = async (email, verificationCode) => {
        try {
            console.log(`📧 Sending verification email to: ${email}`);
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: 'Verify Your Guardian Account',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
                        
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Thank you for registering with Guardian. Please use the following verification code to complete your registration:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; background-color: #f5f5f5; padding: 15px 25px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #333;">
                                ${verificationCode}
                            </div>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
                        </p>
                        
                        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #999; font-size: 12px;">
                                © 2024 Guardian. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }

            console.log('✅ Verification email sent successfully:', data?.id);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
    };

    sendInviteEmail = async (email, token, role) => {
        console.log(`📧 [PLACEHOLDER] Would send invite email to ${email} with token: ${token}`);
        return false;
    };

    console.log('✅ Email service initialized with Resend');
} catch (error) {
    console.log('⚠️ Resend not available, using fallback mode:', error.message);
    sendVerificationEmail = async (email, code) => {
        console.log(`📧 [FALLBACK] Would send verification email to ${email} with code: ${code}`);
        return false; // Return false to indicate email not sent
    };
    sendInviteEmail = async (email, token, role) => {
        console.log(`📧 [FALLBACK] Would send invite email to ${email} with token: ${token}`);
        return false; // Return false to indicate email not sent
    };
}

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

// === STATIC FILE SERVING ===
// Serve static files from current directory (where dist contents are deployed)
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

// Middleware to get authenticated user's company ID
const getAuthenticatedUserCompany = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authentication token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user's company ID from database
        const user = await prisma.uSERS.findFirst({
            where: { USER_ID: decoded.userId },
            select: { USER_ID: true, COMPANY_ID: true, EMAIL: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        req.companyId = user.COMPANY_ID;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid authentication token' });
    }
};

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
        console.log(`📋 Fetching requests for company ID: ${req.companyId}`);

        // Get requests from database filtered by company ID
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

// Get roles endpoint for invite forms
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

        // Format the data to match frontend expectations
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

        console.log(`📤 Sending ${formattedRoles.length} formatted roles to frontend`);
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

// Get field types endpoint
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

// Get fields endpoint
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
        
        // Hash the verification code for secure storage
        const crypto = require('crypto');
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
        const passwordHash = crypto.createHash('sha256').update('').digest('hex');
        
        // Get name parts from email
        const firstName = email.split('@')[0].split('.')[0];
        const lastName = email.split('@')[0].split('.')[1] || '';

        // Extract domain for company name
        let companyNameToUse = 'Default Company';
        if (email && email.includes('@')) {
          const emailDomain = email.split('@')[1];
          if (emailDomain) {
            const domainParts = emailDomain.split('.');
            if (domainParts.length > 0 && domainParts[0].length > 0) {
              companyNameToUse = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
              
              // Handle common domains
              if (emailDomain.includes('gmail.com')) {
                companyNameToUse = 'Gmail';
              } else if (emailDomain.includes('outlook.com') || emailDomain.includes('hotmail.com')) {
                companyNameToUse = 'Microsoft';
              } else if (emailDomain.includes('yahoo.com')) {
                companyNameToUse = 'Yahoo';
              } else if (emailDomain.includes('icloud.com') || emailDomain.includes('me.com') || emailDomain.includes('mac.com')) {
                companyNameToUse = 'Apple';
              }
            }
          }
        }

        // Create company
        let company = await prisma.cOMPANY.findFirst({ where: { NAME: companyNameToUse } });
        if (!company) {
          company = await prisma.cOMPANY.create({ data: { NAME: companyNameToUse } });
        }

        // Create user in database
        const user = await prisma.uSERS.create({
          data: {
            EMAIL: email,
            PASSWORD_HASH: passwordHash,
            EMAIL_VALIDATION_TOKEN: hashedCode,
            EMAIL_VALIDATION_TOKEN_EXPIRY: tokenExpiry,
            EMAIL_VALIDATED: false,
            STATUS: 'P',
            CREATE_DATE: new Date(),
            UPDATE_DATE: new Date(),
            FIRST_NAME: firstName,
            LAST_NAME: lastName,
            COMPANY_ID: company.COMPANY_ID
          }
        });

        // Create company_info entry
        await prisma.cOMPANY_INFO.create({
          data: {
            USER_ID: user.USER_ID,
            COMPANY_ID: company.COMPANY_ID,
          }
        });

        // Assign Admin role
        let adminRole = await prisma.rOLES.findFirst({ where: { NAME: 'Admin' } });
        if (!adminRole) {
          adminRole = await prisma.rOLES.create({ 
            data: { NAME: 'ADMIN', DISPLAY_NAME: 'Administrator', DESCRIPTION: 'Default admin role' } 
          });
        }
        await prisma.uSER_ROLES.create({ 
          data: { USER_ID: user.USER_ID, ROLE_ID: adminRole.ROLE_ID } 
        });

        console.log(`✅ User created in database with ID: ${user.USER_ID}, verification code: ${verificationCode}`);

        // Send actual email with verification code using Resend
        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send email to ${email}, but user created in database (code available in dev mode)`);
        }

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
        console.log(`📧 Request body:`, JSON.stringify(req.body, null, 2));

        if (!email || !verificationCode) {
            console.log(`❌ Missing required fields - email: ${!!email}, verificationCode: ${!!verificationCode}`);
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Look up user in database
        console.log(`🔍 Looking up user in database for email: ${email}`);
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: email }
        });

        if (!user) {
            console.log(`❌ No user found with email: ${email}`);
            return res.status(400).json({
                error: 'No user found with this email'
            });
        }

        console.log(`✅ User found - ID: ${user.USER_ID}, Email Validated: ${user.EMAIL_VALIDATED}`);
        console.log(`🔑 Has validation token: ${!!user.EMAIL_VALIDATION_TOKEN}`);
        console.log(`⏰ Token expiry: ${user.EMAIL_VALIDATION_TOKEN_EXPIRY}`);

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            console.log(`❌ No verification code found for email: ${email}`);
            return res.status(400).json({
                error: 'No verification code found for this email'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            console.log(`❌ Verification code expired for ${email}. Expired at: ${user.EMAIL_VALIDATION_TOKEN_EXPIRY}`);
            return res.status(400).json({
                error: 'Verification code has expired'
            });
        }

        // Hash the provided code and compare with stored hash
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        
        console.log(`🔍 Comparing codes for ${email}:`);
        console.log(`📥 Provided code: ${verificationCode}`);
        console.log(`🔐 Hashed provided: ${hashedProvidedCode}`);
        console.log(`💾 Stored hash: ${user.EMAIL_VALIDATION_TOKEN}`);
        console.log(`✅ Codes match: ${user.EMAIL_VALIDATION_TOKEN === hashedProvidedCode}`);

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
            console.log(`❌ Invalid verification code for ${email}`);
            return res.status(400).json({
                error: 'Invalid verification code'
            });
        }

        // Mark user as verified in database
        await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                EMAIL_VALIDATED: true,
                EMAIL_VALIDATION_TOKEN: null,
                EMAIL_VALIDATION_TOKEN_EXPIRY: null,
                STATUS: 'A', // Active
                UPDATE_DATE: new Date()
            }
        });
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

        // Send actual email with verification code using Resend
        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to resend email to ${email}, but continuing (code available in dev mode)`);
        }

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
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: email }
        });

        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        // Generate a 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the reset code for secure storage
        const crypto = require('crypto');
        const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');
        const resetExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

        // Store reset code in user record
        await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                EMAIL_VALIDATION_TOKEN: hashedCode,
                EMAIL_VALIDATION_TOKEN_EXPIRY: resetExpiry,
                UPDATE_DATE: new Date()
            }
        });

        // Send reset email
        const emailSent = await sendVerificationEmail(email, resetCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send reset email to ${email}, but continuing (code available in dev mode)`);
        }

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

        // Find user
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: email }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid reset request'
            });
        }

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                success: false,
                error: 'No active password reset request found'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                success: false,
                error: 'Verification code has expired'
            });
        }

        // Verify reset code
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(code).digest('hex');

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
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

        // Find user
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: email }
        });

        if (!user) {
            return res.status(400).json({
                error: 'Invalid reset request'
            });
        }

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                error: 'No active password reset request found'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                error: 'Password reset code has expired'
            });
        }

        // Verify reset code
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
            return res.status(400).json({
                error: 'Invalid reset code'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                PASSWORD_HASH: hashedPassword,
                EMAIL_VALIDATION_TOKEN: null,
                EMAIL_VALIDATION_TOKEN_EXPIRY: null,
                UPDATE_DATE: new Date()
            }
        });

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

// Complete registration after email verification
app.post('/api/complete-registration', async (req, res) => {
    try {
        const { email, password, fullName, workspaceName, role, teamSize, companySize } = req.body;
        console.log(`👤 Completing registration for: ${email}`);
        console.log(`📋 Complete registration request body:`, JSON.stringify(req.body, null, 2));

        // Validate required fields
        console.log(`✅ Field validation - email: ${!!email}, password: ${!!password}, fullName: ${!!fullName}, workspaceName: ${!!workspaceName}`);
        if (!email || !password || !fullName || !workspaceName) {
            console.log(`❌ Missing required fields for complete-registration`);
            return res.status(400).json({
                error: 'Email, password, full name, and workspace name are required'
            });
        }

        // Check if user exists and email was verified
        console.log(`🔍 Looking up user in database for complete-registration: ${email}`);
        let existingUser;
        try {
            existingUser = await prisma.uSERS.findFirst({
                where: { EMAIL: email }
            });
            console.log(`✅ Database query successful for user lookup`);
        } catch (dbError) {
            console.error(`❌ Database error during user lookup:`, dbError);
            return res.status(500).json({
                error: 'Database connection error',
                details: dbError.message
            });
        }

        console.log(`🔍 Checking user existence for: ${email}`);
        if (!existingUser) {
            console.log(`❌ No user found for email: ${email}`);
            return res.status(400).json({
                error: 'User not found. Please register first.'
            });
        }

        console.log(`✅ User found - ID: ${existingUser.USER_ID}, Email: ${existingUser.EMAIL}`);
        console.log(`📧 Email validated: ${existingUser.EMAIL_VALIDATED}`);
        console.log(`🔐 Has password: ${!!existingUser.PASSWORD_HASH}`);

        if (!existingUser.EMAIL_VALIDATED) {
            console.log(`❌ Email not validated for: ${email}`);
            return res.status(400).json({
                error: 'Email must be verified before completing registration'
            });
        }

        console.log(`✅ Email validation check passed`);

        // Allow profile updates even if user already has a password
        if (existingUser.PASSWORD_HASH && existingUser.PASSWORD_HASH !== '') {
            console.log(`ℹ️ User already has password, will update profile information for: ${email}`);
        }

        console.log(`✅ Password check passed - ready to update user`);
        
        // Hash password
        console.log(`🔐 Starting password hashing process`);
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log(`✅ Password hashed successfully`);

        // Split full name into first and last name
        console.log(`📝 Processing name: ${fullName}`);
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        console.log(`✅ Name parsed - First: ${firstName}, Last: ${lastName}`);

        // Update the existing user with password and name
        console.log(`💾 Starting database update for user ID: ${existingUser.USER_ID}`);
        await prisma.uSERS.update({
            where: { USER_ID: existingUser.USER_ID },
            data: {
                PASSWORD_HASH: hashedPassword,
                FIRST_NAME: firstName,
                LAST_NAME: lastName,
                STATUS: 'A', // Active
                UPDATE_DATE: new Date()
            }
        });
        console.log(`✅ User updated successfully in database`);

        const userId = existingUser.USER_ID;

        // Check if user already has roles, if not assign Admin role (they already have it from registration)
        const existingRoles = await prisma.uSER_ROLES.findMany({
            where: { USER_ID: userId }
        });

        if (existingRoles.length === 0) {
            // Assign Admin role if no roles exist
            let adminRole = await prisma.rOLES.findFirst({ where: { NAME: 'Admin' } });
            if (adminRole) {
                await prisma.uSER_ROLES.create({
                    data: { USER_ID: userId, ROLE_ID: adminRole.ROLE_ID }
                });
            }
        }

        // Update company info if provided
        console.log(`📝 Updating company info for user ${userId}`);
        if (role || teamSize || companySize || workspaceName) {
            const existingCompanyInfo = await prisma.cOMPANY_INFO.findFirst({
                where: { USER_ID: userId }
            });

            if (existingCompanyInfo) {
                console.log(`✅ Found existing company info record with ID: ${existingCompanyInfo.COMPANY_INFO_ID}`);
                // Update existing record using the unique COMPANY_INFO_ID
                await prisma.cOMPANY_INFO.update({
                    where: { COMPANY_INFO_ID: existingCompanyInfo.COMPANY_INFO_ID },
                    data: {
                        ...(workspaceName && { WORKSPACE_NAME: workspaceName }),
                        ...(role && { ROLE: role }),
                        ...(teamSize && { TEAM_SIZE: teamSize }),
                        ...(companySize && { COMPANY_SIZE: companySize }),
                        UPDATED_AT: new Date()
                    }
                });
                console.log(`✅ Company info updated successfully`);
            } else {
                console.log(`❌ No existing company info found for user ${userId}`);
            }
        }

        console.log(`✅ Registration completed successfully for: ${email} (User ID: ${userId})`);

        res.json({
            success: true,
            message: 'Registration completed successfully',
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: existingUser.COMPANY_ID
            }
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
            message: 'Invite accepted successfully. You can now log in.',
            user: {
                id: userId,
                email: invite.EMAIL,
                firstName: firstName,
                lastName: lastName,
                companyId: invite.COMPANY_ID,
                roleId: invite.ROLE_ID
            }
        });

    } catch (error) {
        console.error('❌ Invite acceptance error:', error);
        res.status(500).json({
            error: 'Failed to accept invite',
            message: error.message
        });
    }
});

// Send invites endpoint
app.post('/invites/send', async (req, res) => {
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

                // Check if there's already a pending invite
                const existingInvite = await prisma.$queryRaw`
                    SELECT INVITE_ID FROM GUARDIAN.INVITES 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email})) 
                    AND STATUS = 'P' AND EXPIRES_AT > GETDATE()
                `;

                if (existingInvite.length > 0) {
                    errors.push(`Active invite already exists for ${email}`);
                    continue;
                }

                // Generate unique token
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // Set expiration to 7 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                // For now, default to company ID 1 - you may want to get this from the authenticated user
                const companyId = 1;

                // Insert invite record
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.INVITES (EMAIL, ROLE_ID, COMPANY_ID, TOKEN, STATUS, EXPIRES_AT)
                    VALUES (${email}, ${roleId}, ${companyId}, ${token}, 'P', ${expiresAt})
                `;

                console.log(`✅ Invite created for ${email} with role ${roleId}`);
                
                // Send actual invite email using Resend
                const emailSent = await sendInviteEmail(email, token, 'User'); // TODO: Get actual role name from roleId
                const status = emailSent ? 'sent' : 'created'; // Mark as 'created' if email failed but record exists
                
                results.push({
                    email: email,
                    status: status,
                    token: token,
                    expiresAt: expiresAt.toISOString(),
                    emailSent: emailSent
                });

                if (!emailSent) {
                    console.log(`⚠️ Failed to send invite email to ${email}, but invite record created`);
                    console.log(`📧 Invite token for ${email}: ${token} (expires: ${expiresAt.toISOString()})`);
                }

            } catch (inviteError) {
                console.error(`❌ Error processing invite for ${invite?.email}:`, inviteError);
                errors.push(`Failed to process invite for ${invite?.email}: ${inviteError.message}`);
            }
        }

        const response = {
            success: results.length > 0,
            message: `Processed ${invites.length} invite(s). ${results.length} sent, ${errors.length} failed.`,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        };

        console.log(`📤 Invite processing complete:`, response);

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
// === SPA FALLBACK ROUTE ===
// Handle all non-API routes for React Router (must be last!)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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