import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { sendVerificationEmail, sendInviteEmail } from './src/utils/resend-email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        
        // Set expiration to 30 minutes from now
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        // Store verification data in a temp table or cache
        // For now, we'll use a simple in-memory store (you might want to use Redis or database)
        global.verificationCodes = global.verificationCodes || {};
        global.verificationCodes[email] = {
            code: verificationCode,
            expiresAt: expiresAt,
            verified: false
        };

        console.log(`✅ Verification code generated for ${email}: ${verificationCode} (expires: ${expiresAt})`);

        // Send actual email with verification code using Resend
        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send email to ${email}, but continuing (code available in dev mode)`);
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

        if (!email || !verificationCode) {
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Check verification code
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

// Complete registration after email verification
app.post('/api/complete-registration', async (req, res) => {
    try {
        const { email, password, fullName, workspaceName, role, teamSize, companySize } = req.body;
        console.log(`👤 Completing registration for: ${email}`);

        // Validate required fields
        if (!email || !password || !fullName || !workspaceName) {
            return res.status(400).json({
                error: 'Email, password, full name, and workspace name are required'
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

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Split full name into first and last name
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Get an existing company ID (use the first available company)
        const companies = await prisma.$queryRaw`
            SELECT TOP 1 COMPANY_ID FROM GUARDIAN.COMPANY
        `;
        let companyId = companies.length > 0 ? companies[0].COMPANY_ID : 31; // Fallback to 31
        
        // TODO: You might want to create a company based on workspace name
        // For now, we'll use a default company ID

        // Create user record
        const result = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                EMAIL, PASSWORD_HASH, FIRST_NAME, LAST_NAME, 
                STATUS, COMPANY_ID, CREATE_DATE, UPDATE_DATE
            )
            VALUES (
                ${email}, ${hashedPassword}, ${firstName}, ${lastName},
                'A', ${companyId}, GETDATE(), GETDATE()
            )
        `;

        // Get the newly created user ID
        const newUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        const userId = newUser[0].USER_ID;

        // Assign default role (General User = role ID 2, adjust as needed)
        const defaultRoleId = 2;
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${userId}, ${defaultRoleId}, GETDATE(), GETDATE())
        `;

        // Store company info if provided
        if (role || teamSize || companySize) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.COMPANY_INFO (
                    COMPANY_ID, USER_ID, WORKSPACE_NAME, ROLE, TEAM_SIZE, COMPANY_SIZE, CREATED_AT, UPDATED_AT
                )
                VALUES (
                    ${companyId}, ${userId}, ${workspaceName}, ${role || null}, 
                    ${teamSize || null}, ${companySize || null}, GETDATE(), GETDATE()
                )
            `;
        }

        // Clean up verification code
        delete global.verificationCodes[email];

        console.log(`✅ Registration completed successfully for: ${email} (User ID: ${userId})`);

        res.json({
            success: true,
            message: 'Registration completed successfully',
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: companyId
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

export default app;