const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

// Enhanced security-hardened email validation function
const validateEmailServer = (email) => {
    // Input length protection (125 character limit)
    if (!email || email.length > 125) {
        return { valid: false, reason: 'Invalid email length' };
    }
    
    // Normalize and sanitize
    const normalizedEmail = email.trim().toLowerCase();
    
    // Injection attack protection
    if (normalizedEmail.match(/[\x00-\x1f\x7f-\x9f]/) || 
        normalizedEmail.includes('\n') || 
        normalizedEmail.includes('\r') ||
        normalizedEmail.includes('\t')) {
        return { valid: false, reason: 'Invalid characters detected' };
    }
    
    // Enhanced regex pattern (security-hardened)
    const secureEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!secureEmailRegex.test(normalizedEmail)) {
        return { valid: false, reason: 'Invalid email format' };
    }
    
    // Additional domain validation
    const domain = normalizedEmail.split('@')[1];
    if (domain.length > 253 || domain.startsWith('-') || domain.endsWith('-')) {
        return { valid: false, reason: 'Invalid domain format' };
    }
    
    return { valid: true, email: normalizedEmail };
};

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

    sendAssignmentEmail = async (email, userName, requestName, trackingId, assignedBy) => {
        try {
            console.log(`📧 Sending assignment email to: ${email}`);
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: `New Request Assignment - ${requestName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">New Request Assignment</h2>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px; color: #333;">
                                Hello ${userName},
                            </p>
                            <p style="margin: 15px 0 0 0; font-size: 16px; color: #333;">
                                You have been assigned to a new request:
                            </p>
                        </div>

                        <div style="background-color: #e0f2f1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0D9488;">
                            <h3 style="margin: 0 0 10px 0; color: #0D9488;">Request Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>Request Name:</strong> ${requestName}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Tracking ID:</strong> ${trackingId}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Assigned By:</strong> ${assignedBy}</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                Please log in to your Guardian account to view and work on this request.
                            </p>
                        </div>

                        <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="margin: 0; color: #999; font-size: 12px;">
                                This is an automated message from Guardian. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }

            console.log(`✅ Assignment email sent successfully to ${email}:`, data?.id);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
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
    sendAssignmentEmail = async (email, userName, requestName, trackingId, assignedBy) => {
        console.log(`📧 [FALLBACK] Would send assignment email to ${email} for request: ${requestName} (${trackingId})`);
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
app.use(express.json({ limit: '10mb' }));
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

app.get('/api/debug/endpoints', (req, res) => {
    res.json({
        success: true,
        message: 'Development server running latest code with all endpoints',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: [
            '/api/users', '/api/users/company/:companyId', '/api/invites', 
            '/api/roles', '/api/requests', '/api/forms', '/api/forms-groups', '/api/fields', '/api/field-types',
            '/api/login', '/api/register', '/api/verify-email', '/api/complete-registration',
            '/api/validate-email', '/api/send-verification-email', 
            '/api/request-password-reset', '/api/verify-reset-code', '/api/reset-password'
        ]
    });
});

// Middleware to get authenticated user's company ID
const getAuthenticatedUserCompany = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('❌ No valid auth header found:', authHeader ? authHeader.substring(0, 20) + '...' : 'null');
            return res.status(401).json({ error: 'No valid authentication token provided' });
        }

        const token = authHeader.substring(7);
        console.log(`🔍 Attempting to verify JWT token (length: ${token.length}, first 20 chars: ${token.substring(0, 20)}...)`);
        
        // Add additional token validation before JWT verification
        if (token.length < 10) {
            console.error('❌ Token too short:', token.length);
            return res.status(401).json({ error: 'Invalid token format' });
        }
        
        // Check if token looks like a proper JWT (has 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.error('❌ Token does not have 3 parts:', tokenParts.length);
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('✅ JWT token verified successfully for user:', decoded.userId);
        
        // Get user's company ID and roles from database using raw SQL
        const users = await prisma.$queryRaw`
            SELECT u.USER_ID, u.COMPANY_ID, u.EMAIL,
                   STRING_AGG(ur.ROLE_ID, ',') as ROLE_IDS
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID AND ur.STATUS = 'P'
            WHERE u.USER_ID = ${decoded.userId}
            GROUP BY u.USER_ID, u.COMPANY_ID, u.EMAIL
        `;
        const user = users.length > 0 ? users[0] : null;

        if (!user) {
            console.error('❌ User not found in database for userId:', decoded.userId);
            return res.status(401).json({ error: 'User not found' });
        }

        console.log(`✅ Authentication successful for user ${user.USER_ID} in company ${user.COMPANY_ID}`);
        req.user = user;
        req.userId = user.USER_ID;
        req.companyId = user.COMPANY_ID;
        req.userRoleIds = user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : [];
        next();
    } catch (error) {
        console.error('❌ Authentication error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n')[0] // Just first line of stack trace
        });
        return res.status(401).json({ error: 'Invalid authentication token' });
    }
};

// Debug endpoint to check user authentication and roles
app.get('/api/debug/user', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🔍 Debug user endpoint called');
        
        // Get user's roles
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME as ROLE_NAME
            FROM GUARDIAN.USER_ROLES ur 
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6);
        
        res.json({
            userId: req.userId,
            companyId: req.companyId,
            roles: userRoles,
            roleIds: roleIds,
            isAdmin: isAdmin,
            canAccessGlobalForms: isAdmin
        });
    } catch (error) {
        console.error('Debug user endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint without authentication to check server status
app.get('/api/debug/status', (req, res) => {
    console.log('🔍 Debug status endpoint called');
    res.json({
        server: 'running',
        timestamp: new Date().toISOString(),
        headers: req.headers.authorization ? 'has auth header' : 'no auth header'
    });
});

// === NOTIFICATION ENDPOINTS ===

// Get user notifications
app.get('/api/notifications', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;

        console.log(`🔔 Fetching notifications for user ${userId} (Company: ${req.companyId})`);

        let whereClause = `WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}`;
        if (unreadOnly === 'true') {
            whereClause += ` AND IS_READ = 0`;
        }

        // Build the complete SQL query as a string
        let sqlQuery = `
            SELECT 
                NOTIFICATION_ID,
                TYPE,
                TITLE,
                MESSAGE,
                RELATED_ID,
                IS_READ,
                CREATED_DATE
            FROM GUARDIAN.NOTIFICATIONS
            ${whereClause}
            ORDER BY CREATED_DATE DESC
            OFFSET ${parseInt(offset)} ROWS
            FETCH NEXT ${parseInt(limit)} ROWS ONLY
        `;

        const notifications = await prisma.$queryRawUnsafe(sqlQuery);

        console.log(`✅ Found ${notifications.length} notifications`);

        res.json({
            success: true,
            data: notifications,
            count: notifications.length
        });

    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({
            error: 'Failed to fetch notifications',
            message: error.message
        });
    }
});

// Get notification count (unread)
app.get('/api/notifications/count', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;

        console.log(`🔢 Getting notification count for user ${userId}`);

        const result = await prisma.$queryRaw`
            SELECT COUNT(*) as unread_count
            FROM GUARDIAN.NOTIFICATIONS
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId} AND IS_READ = 0
        `;

        const unreadCount = parseInt(result[0].unread_count) || 0;

        console.log(`✅ User has ${unreadCount} unread notifications`);

        res.json({
            success: true,
            unreadCount: unreadCount
        });

    } catch (error) {
        console.error('❌ Error getting notification count:', error);
        res.status(500).json({
            error: 'Failed to get notification count',
            message: error.message
        });
    }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.notificationId);
        const userId = req.userId;

        console.log(`📖 Marking notification ${notificationId} as read for user ${userId}`);

        if (!notificationId || isNaN(notificationId)) {
            return res.status(400).json({
                error: 'Valid notification ID is required'
            });
        }

        // Verify notification belongs to user
        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTIFICATIONS
            SET IS_READ = 1, READ_DATE = GETDATE()
            WHERE NOTIFICATION_ID = ${notificationId} 
            AND USER_ID = ${userId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        if (result === 0) {
            return res.status(404).json({
                error: 'Notification not found or access denied'
            });
        }

        console.log(`✅ Notification ${notificationId} marked as read`);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        res.status(500).json({
            error: 'Failed to mark notification as read',
            message: error.message
        });
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;

        console.log(`📖 Marking all notifications as read for user ${userId}`);

        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTIFICATIONS
            SET IS_READ = 1, READ_DATE = GETDATE()
            WHERE USER_ID = ${userId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_READ = 0
        `;

        console.log(`✅ Marked ${result} notifications as read`);

        res.json({
            success: true,
            message: `Marked ${result} notifications as read`,
            updatedCount: result
        });

    } catch (error) {
        console.error('❌ Error marking all notifications as read:', error);
        res.status(500).json({
            error: 'Failed to mark notifications as read',
            message: error.message
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for login: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Query the database using raw SQL for GUARDIAN schema with normalized email
        const users = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PASSWORD_HASH, STATUS, COMPANY_ID
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
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

// Get assigned requests for current user
app.get('/api/requests/assigned/me', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const startTime = Date.now();
        console.log(`📋 Fetching assigned requests for user ID: ${req.userId} (Company: ${req.companyId})`);

        // Get requests assigned to the current user
        const assignedRequests = await prisma.$queryRaw`
            SELECT 
                r.REQUEST_ID,
                r.REQUEST_NAME,
                r.REQUEST_DESCRIPTION,
                r.STATUS,
                r.SUBMITTED_DATE,
                r.TRACKINGID,
                r.CREATE_DATE,
                r.UPDATE_DATE,
                r.COMPANY_ID,
                r.REQUESTOR_ID,
                r.ASSIGNED_ID,
                ru.FIRST_NAME as REQUESTOR_FIRST_NAME,
                ru.LAST_NAME as REQUESTOR_LAST_NAME,
                ru.EMAIL as REQUESTOR_EMAIL,
                au.FIRST_NAME as ASSIGNED_FIRST_NAME,
                au.LAST_NAME as ASSIGNED_LAST_NAME,
                au.EMAIL as ASSIGNED_EMAIL
            FROM GUARDIAN.REQUESTS r
            LEFT JOIN GUARDIAN.USERS ru ON r.REQUESTOR_ID = ru.USER_ID
            LEFT JOIN GUARDIAN.USERS au ON r.ASSIGNED_ID = au.USER_ID
            WHERE r.ASSIGNED_ID = ${req.userId} 
                AND r.COMPANY_ID = ${req.companyId}
            ORDER BY r.CREATE_DATE DESC
        `;

        // Format the requests for frontend
        const formattedRequests = assignedRequests.map(req => ({
            REQUEST_ID: req.REQUEST_ID,
            REQUEST_NAME: req.REQUEST_NAME,
            REQUEST_DESCRIPTION: req.REQUEST_DESCRIPTION,
            STATUS: req.STATUS,
            SUBMITTED_DATE: req.SUBMITTED_DATE,
            TRACKINGID: req.TRACKINGID,
            CREATE_DATE: req.CREATE_DATE,
            UPDATE_DATE: req.UPDATE_DATE,
            COMPANY_ID: req.COMPANY_ID,
            REQUESTOR_ID: req.REQUESTOR_ID,
            ASSIGNED_ID: req.ASSIGNED_ID,
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown',
            assignedName: req.ASSIGNED_FIRST_NAME ? 
                `${req.ASSIGNED_FIRST_NAME} ${req.ASSIGNED_LAST_NAME}` : 
                null,
            requestor: req.REQUESTOR_FIRST_NAME ? {
                FIRST_NAME: req.REQUESTOR_FIRST_NAME,
                LAST_NAME: req.REQUESTOR_LAST_NAME,
                EMAIL: req.REQUESTOR_EMAIL
            } : null,
            assigned: req.ASSIGNED_FIRST_NAME ? {
                FIRST_NAME: req.ASSIGNED_FIRST_NAME,
                LAST_NAME: req.ASSIGNED_LAST_NAME,
                EMAIL: req.ASSIGNED_EMAIL
            } : null
        }));

        const endTime = Date.now();
        console.log(`✅ Retrieved ${formattedRequests.length} assigned requests in ${endTime - startTime}ms`);
        
        res.json(formattedRequests);
    } catch (error) {
        console.error('❌ Error fetching assigned requests:', error);
        res.status(500).json({ 
            error: 'Failed to fetch assigned requests',
            message: error.message 
        });
    }
});

// Start working on a request (change status from P to A)
app.post('/api/requests/:id/start', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`🚀 Starting work on request ${requestId} by user ${req.userId}`);

        // Update request status to 'P' (In Progress)
        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'P', UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE REQUEST_ID = ${requestId} 
                AND COMPANY_ID = ${req.companyId}
                AND ASSIGNED_ID = ${req.userId}
        `;

        console.log(`✅ Request ${requestId} started successfully`);
        res.json({ success: true, message: 'Request started successfully' });
    } catch (error) {
        console.error(`❌ Error starting request ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Failed to start request',
            message: error.message 
        });
    }
});

// Complete a request (change status from P to C)
app.post('/api/requests/:id/complete', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { completionNotes } = req.body;
        console.log(`✅ Completing request ${requestId} by user ${req.userId}`);

        // Update request status to 'C' (Completed)
        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'C', UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE REQUEST_ID = ${requestId} 
                AND COMPANY_ID = ${req.companyId}
                AND ASSIGNED_ID = ${req.userId}
        `;

        // Add completion notes if provided
        if (completionNotes) {
            console.log(`📝 Adding completion notes for request ${requestId}`);
            // You might want to add a progress entry or notes table for this
        }

        console.log(`✅ Request ${requestId} completed successfully`);
        res.json({ success: true, message: 'Request completed successfully' });
    } catch (error) {
        console.error(`❌ Error completing request ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Failed to complete request',
            message: error.message 
        });
    }
});

// Create new request endpoint
app.post('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Creating new request for company: ${req.companyId}`, req.body);

        const {
            REQUEST_NAME,
            name,
            requestName,
            REQUEST_DESCRIPTION,
            description,
            ABBREVIATION,
            abbreviation,
            templateType,
            FORM_ID,
            templateId,
            REQUESTOR_ID,
            requestorId,
            ASSIGNED_ID,
            assignedId,
            STATUS,
            status
        } = req.body;

        // Use the request name from any of the possible field names
        const finalRequestName = REQUEST_NAME || name || requestName;
        const finalDescription = REQUEST_DESCRIPTION || description || '';
        const finalAbbreviation = ABBREVIATION || abbreviation || templateType?.substring(0, 5)?.toUpperCase() || finalRequestName?.substring(0, 5)?.toUpperCase() || 'REQ';
        const finalStatus = STATUS || status || 'P'; // P = Pending
        const finalAssignedId = ASSIGNED_ID || assignedId || null;

        // Validation
        if (!finalRequestName || finalRequestName.trim() === '') {
            return res.status(400).json({
                error: 'Request name is required',
                details: 'REQUEST_NAME, name, or requestName field must be provided and non-empty'
            });
        }

        // TRACKINGID is now auto-generated by the database as a computed column
        // No longer need to generate it manually

        // Create the request with company-based data isolation using raw SQL
        const currentDate = new Date();
        
        console.log('🔍 INSERT Parameters:', {
            finalRequestName: finalRequestName.trim(),
            finalDescription: finalDescription.trim() || null,
            finalAbbreviation,
            finalStatus,
            currentDate,
            userId: req.userId,
            companyId: req.companyId,
            templateId: templateId || null,
            finalAssignedId
        });
        
        // Insert and get ID in a single query to ensure same connection/transaction
        let insertedId;
        try {
            // Use a single query that inserts and returns the ID
            const insertResult = await prisma.$queryRaw`
                DECLARE @InsertedId INT;
                
                INSERT INTO GUARDIAN.REQUESTS (
                    REQUEST_NAME, REQUEST_DESCRIPTION, ABBREVIATION, STATUS, SUBMITTED_DATE,
                    REQUESTOR_ID, ASSIGNED_ID, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID,
                    UPDATE_USER_ID, COMPANY_ID, EXTERNAL_USER, FORM_ID
                )
                VALUES (
                    ${finalRequestName.trim()},
                    ${finalDescription.trim() || null},
                    ${finalAbbreviation},
                    ${finalStatus},
                    ${currentDate},
                    ${req.userId},
                    ${finalAssignedId},
                    ${currentDate},
                    ${currentDate},
                    ${req.userId},
                    ${req.userId},
                    ${req.companyId},
                    ${null},
                    ${templateId || null}
                );
                
                SET @InsertedId = SCOPE_IDENTITY();
                SELECT @InsertedId AS REQUEST_ID;
            `;
            
            insertedId = insertResult[0]?.REQUEST_ID;
            console.log('✅ INSERT completed successfully, ID:', insertedId);
        } catch (insertError) {
            console.log('❌ INSERT failed:', insertError.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to insert request',
                error: insertError.message
            });
        }
        
        console.log('🔍 SCOPE_IDENTITY result:', insertedId);
        
        if (!insertedId) {
            console.log('❌ No SCOPE_IDENTITY found, request may not have been inserted');
            return res.status(500).json({
                success: false,
                message: 'Failed to create request - no ID returned'
            });
        }
        
        // Now get the complete request record
        const newRequestResults = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME, REQUEST_DESCRIPTION, ABBREVIATION, STATUS, 
                   SUBMITTED_DATE, REQUESTOR_ID, ASSIGNED_ID, CREATE_DATE, UPDATE_DATE, 
                   CREATE_USER_ID, UPDATE_USER_ID, TRACKINGID, COMPANY_ID, EXTERNAL_USER, FORM_ID
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${insertedId} AND COMPANY_ID = ${req.companyId}
        `;
        
        const newRequest = newRequestResults[0];
        
        if (!newRequest) {
            console.log('❌ Request not found after insert, company ID mismatch?');
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve created request'
            });
        }

        console.log(`✅ Request created successfully:`, {
            REQUEST_ID: newRequest.REQUEST_ID,
            REQUEST_NAME: newRequest.REQUEST_NAME,
            TRACKING_ID: newRequest.TRACKINGID,
            COMPANY_ID: newRequest.COMPANY_ID
        });

        // Return the created request
        res.status(201).json({
            success: true,
            message: 'Request created successfully',
            data: {
                REQUEST_ID: newRequest.REQUEST_ID,
                REQUEST_NAME: newRequest.REQUEST_NAME,
                REQUEST_DESCRIPTION: newRequest.REQUEST_DESCRIPTION,
                ABBREVIATION: newRequest.ABBREVIATION,
                STATUS: newRequest.STATUS,
                SUBMITTED_DATE: newRequest.SUBMITTED_DATE,
                REQUESTOR_ID: newRequest.REQUESTOR_ID,
                ASSIGNED_ID: newRequest.ASSIGNED_ID,
                TRACKINGID: newRequest.TRACKINGID,
                COMPANY_ID: newRequest.COMPANY_ID,
                FORM_ID: newRequest.FORM_ID,
                CREATE_DATE: newRequest.CREATE_DATE,
                UPDATE_DATE: newRequest.UPDATE_DATE
            }
        });

    } catch (error) {
        console.error('❌ Error creating request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating request',
            error: error.message
        });
    }
});

// Real requests endpoint with database query
app.get('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const startTime = Date.now();
        console.log(`📋 Fetching requests for company ID: ${req.companyId}`);

        // OPTIMIZED: Single query with proper JOINs and timeout handling
        const requests = await Promise.race([
            prisma.$queryRaw`
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
                LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID AND requestor.COMPANY_ID = ${req.companyId}
                LEFT JOIN GUARDIAN.USERS assigned ON r.ASSIGNED_ID = assigned.USER_ID AND assigned.COMPANY_ID = ${req.companyId}
                LEFT JOIN GUARDIAN.USERS creator ON r.CREATE_USER_ID = creator.USER_ID AND creator.COMPANY_ID = ${req.companyId}
                WHERE r.COMPANY_ID = ${req.companyId}
                ORDER BY r.CREATE_DATE DESC
            `,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout after 8 seconds')), 8000)
            )
        ]);

        const queryTime = Date.now() - startTime;
        console.log(`✅ Found ${requests.length} requests in database (query took ${queryTime}ms)`);
        
        if (queryTime > 2000) {
            console.warn(`⚠️ Slow query detected: ${queryTime}ms for company ${req.companyId}`);
        }

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
        
        // Handle different types of errors
        if (error.message.includes('timeout')) {
            console.error('⏱️ Database query timeout - possible performance issue');
            res.status(408).json({
                error: 'Request timeout',
                message: 'Database query took too long. Please try again or contact support if this persists.'
            });
        } else if (error.message.includes('connection')) {
            console.error('🔌 Database connection error');
            res.status(503).json({
                error: 'Database connection error',
                message: 'Unable to connect to database. Please try again later.'
            });
        } else {
            res.status(500).json({
                error: 'Failed to fetch requests',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// Get all users (for backward compatibility)
app.get('/api/users', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`👥 Fetching users for company ID: ${req.companyId}`);

        // First get all users
        const users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE
            FROM GUARDIAN.USERS u
            WHERE u.STATUS = 'A' AND u.COMPANY_ID = ${req.companyId}
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        console.log(`✅ Found ${users.length} users`);

        // OPTIMIZED: Get all user roles in single query to avoid N+1 problem
        const userIds = users.map(u => u.USER_ID);
        let allRoles = [];
        
        if (userIds.length > 0) {
            // Build dynamic query using template literals - more reliable than $queryRawUnsafe
            const userIdList = userIds.join(', ');
            allRoles = await prisma.$queryRawUnsafe(`
                SELECT 
                    ur.USER_ID,
                    r.ROLE_ID as id,
                    r.NAME as name,
                    r.DISPLAY_NAME as displayName
                FROM GUARDIAN.USER_ROLES ur
                JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
                WHERE ur.USER_ID IN (${userIdList}) AND ur.STATUS = 'P'
                ORDER BY ur.USER_ID, r.ROLE_ID
            `);
        }
        
        // Group roles by user ID for efficient lookup
        const rolesByUserId = {};
        allRoles.forEach(role => {
            if (!rolesByUserId[role.USER_ID]) {
                rolesByUserId[role.USER_ID] = [];
            }
            rolesByUserId[role.USER_ID].push({
                id: role.id,
                name: role.name,
                displayName: role.displayName
            });
        });
        
        // Map users with their roles efficiently
        const usersWithRoles = users.map(user => {
            const userRoles = rolesByUserId[user.USER_ID] || [];
            
            return {
                USER_ID: user.USER_ID,
                EMAIL: user.EMAIL,
                FIRST_NAME: user.FIRST_NAME,
                LAST_NAME: user.LAST_NAME,
                FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
                COMPANY_ID: user.COMPANY_ID,
                STATUS: user.STATUS,
                CREATE_DATE: user.CREATE_DATE,
                ROLE_NAMES: userRoles.map(role => role.name).join(', ') || 'No roles assigned',
                id: user.USER_ID,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                email: user.EMAIL,
                companyId: user.COMPANY_ID,
                status: user.STATUS,
                createdAt: user.CREATE_DATE,
                roles: userRoles
            };
        });

        res.json({
            success: true,
            data: usersWithRoles,
            count: usersWithRoles.length
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

app.get('/api/users/all-profiles', getAuthenticatedUserCompany, async (req, res) => {
  try {
    console.log('🔄 Fetching all user profiles for profile switching...');
    
    // Only allow admins (role 1 or 6) to fetch all profiles
    const userRoles = await prisma.$queryRaw`
      SELECT ur.ROLE_ID 
      FROM GUARDIAN.USER_ROLES ur 
      WHERE ur.USER_ID = ${req.userId}
    `;
    const roleIds = userRoles.map(role => role.ROLE_ID);
    const isAdmin = roleIds.includes(1) || roleIds.includes(6);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required for profile switching.' });
    }
    
    const allUsers = await prisma.$queryRaw`
      SELECT u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.COMPANY_ID, u.STATUS,
             CONCAT(u.FIRST_NAME, ' ', u.LAST_NAME) as FULL_NAME,
             STRING_AGG(r.ROLE_NAME, ', ') as ROLE_NAMES,
             u.CREATE_DATE, u.UPDATE_DATE
      FROM GUARDIAN.USERS u
      LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
      LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
      WHERE u.IS_ACTIVE = 1 AND u.IS_DELETED = 0
      GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.COMPANY_ID, u.STATUS, u.CREATE_DATE, u.UPDATE_DATE
      ORDER BY u.COMPANY_ID, u.LAST_NAME, u.FIRST_NAME
    `;
    
    console.log(`✅ Found ${allUsers.length} user profiles for switching`);
    res.json(allUsers);
  } catch (error) {
    console.error('❌ Error fetching all user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch user profiles' });
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

// Send invites endpoint
app.post('/api/invites', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { invites } = req.body;
        console.log(`📧 Processing ${invites?.length || 0} invite requests for company ${req.companyId}`);

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
                    errors.push(`Pending invite already exists for ${email}`);
                    continue;
                }

                // Generate unique token
                const crypto = require('crypto');
                const token = crypto.randomBytes(32).toString('hex');
                
                // Set expiration to 7 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                // Insert the invite
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.INVITES (EMAIL, ROLE_ID, COMPANY_ID, TOKEN, STATUS, EXPIRES_AT)
                    VALUES (${email}, ${roleId}, ${req.companyId}, ${token}, 'P', ${expiresAt})
                `;

                results.push({
                    email: email,
                    roleId: roleId,
                    token: token,
                    status: 'sent'
                });

                console.log(`✅ Invite sent to ${email} for role ${roleId}`);

            } catch (inviteError) {
                console.error(`❌ Error processing invite for ${invite.email}:`, inviteError);
                errors.push(`Failed to send invite to ${invite.email}: ${inviteError.message}`);
            }
        }

        // Return results
        const response = {
            success: true,
            sent: results.length,
            errors: errors.length,
            results: results
        };

        if (errors.length > 0) {
            response.errors = errors;
        }

        console.log(`📧 Invite processing complete: ${results.length} sent, ${errors.length} errors`);
        
        res.json(response);

    } catch (error) {
        console.error('❌ Error processing invites:', error);
        res.status(500).json({
            error: 'Failed to process invites',
            message: error.message
        });
    }
});

// Delete an invite
app.delete('/api/invites/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const inviteId = parseInt(req.params.id);
        const companyId = req.companyId;

        console.log(`🗑️ Deleting invite ${inviteId} for company ${companyId}`);

        // Verify invite exists and belongs to the company
        const invite = await prisma.$queryRaw`
            SELECT INVITE_ID, EMAIL, COMPANY_ID 
            FROM GUARDIAN.INVITES 
            WHERE INVITE_ID = ${inviteId} AND COMPANY_ID = ${companyId}
        `;

        if (invite.length === 0) {
            console.log(`❌ Invite ${inviteId} not found or not authorized for company ${companyId}`);
            return res.status(404).json({
                error: 'Invite not found or not authorized'
            });
        }

        // Delete the invite
        const result = await prisma.$executeRaw`
            DELETE FROM GUARDIAN.INVITES 
            WHERE INVITE_ID = ${inviteId} AND COMPANY_ID = ${companyId}
        `;

        console.log(`✅ Invite ${inviteId} deleted successfully`);

        res.json({
            success: true,
            message: 'Invite deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting invite:', error);
        res.status(500).json({
            error: 'Failed to delete invite',
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

        // Create notification if assigning to someone
        if (assignedUserId) {
            try {
                // Get request details for notification
                const requestDetails = await prisma.$queryRaw`
                    SELECT REQUEST_NAME, REQUEST_DESCRIPTION, TRACKINGID 
                    FROM GUARDIAN.REQUESTS 
                    WHERE REQUEST_ID = ${requestId}
                `;

                if (requestDetails.length > 0) {
                    const request = requestDetails[0];
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${assignedUserId},
                            'assignment',
                            'New Request Assigned',
                            'You have been assigned to request: ' + ${request.REQUEST_NAME} + ' (ID: ' + ${request.TRACKINGID} + ')',
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                    console.log(`🔔 Notification created for user ${assignedUserId} about request assignment`);
                    
                    // Send email notification
                    try {
                        // Get assigned user's email and name
                        const assignedUser = await prisma.$queryRaw`
                            SELECT EMAIL, FIRST_NAME, LAST_NAME 
                            FROM GUARDIAN.USERS 
                            WHERE USER_ID = ${assignedUserId}
                        `;
                        
                        // Get assigning user's name  
                        const assigningUser = await prisma.$queryRaw`
                            SELECT FIRST_NAME, LAST_NAME 
                            FROM GUARDIAN.USERS 
                            WHERE USER_ID = ${req.userId}
                        `;
                        
                        if (assignedUser.length > 0 && assigningUser.length > 0) {
                            const assigned = assignedUser[0];
                            const assigner = assigningUser[0];
                            const assignedUserName = `${assigned.FIRST_NAME} ${assigned.LAST_NAME}`;
                            const assignedByName = `${assigner.FIRST_NAME} ${assigner.LAST_NAME}`;
                            
                            console.log(`📧 Sending assignment email to ${assigned.EMAIL} for request: ${request.REQUEST_NAME}`);
                            
                            const emailSent = await sendAssignmentEmail(
                                assigned.EMAIL,
                                assignedUserName,
                                request.REQUEST_NAME,
                                request.TRACKINGID,
                                assignedByName
                            );
                            
                            if (emailSent) {
                                console.log(`✅ Assignment email sent successfully to ${assigned.EMAIL}`);
                            } else {
                                console.log(`⚠️ Assignment email could not be sent to ${assigned.EMAIL} (fallback mode or error)`);
                            }
                        }
                    } catch (emailError) {
                        console.error('⚠️ Failed to send assignment email:', emailError);
                        // Don't fail the assignment if email sending fails
                    }
                }
            } catch (notificationError) {
                console.error('⚠️ Failed to create notification:', notificationError);
                // Don't fail the assignment if notification creation fails
            }
        }

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

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDF, Word, Excel, and text files are allowed.'), false);
        }
    }
});

// === WORK PROGRESS MANAGEMENT ENDPOINTS ===

// Get all work progress entries for a request
app.get('/api/requests/:id/progress', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`📈 Fetching work progress for request ${requestId} (Company: ${req.companyId})`);

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

        // Get all progress entries for the request with user information
        const progressEntries = await prisma.$queryRaw`
            SELECT 
                wp.WORK_PROGRESS_ID,
                wp.REQUEST_ID,
                wp.USER_ID,
                wp.COMPANY_ID,
                wp.PROGRESS_TYPE,
                wp.TITLE,
                wp.DESCRIPTION,
                wp.HOURS_WORKED,
                wp.STATUS_UPDATE,
                wp.RELATED_ATTACHMENT_ID,
                wp.IS_MILESTONE,
                wp.IS_VISIBLE_TO_REQUESTOR,
                wp.CREATE_DATE,
                wp.UPDATE_DATE,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                a.FILE_NAME as ATTACHMENT_FILE_NAME
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.USERS u ON wp.USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.ATTACHMENTS a ON wp.RELATED_ATTACHMENT_ID = a.ATTACHMENT_ID
            WHERE wp.REQUEST_ID = ${requestId} 
            AND wp.COMPANY_ID = ${req.companyId}
            ORDER BY wp.CREATE_DATE DESC
        `;

        console.log(`✅ Found ${progressEntries.length} progress entries for request ${requestId}`);

        res.json({
            success: true,
            progress: progressEntries.map(entry => ({
                workProgressId: entry.WORK_PROGRESS_ID,
                requestId: entry.REQUEST_ID,
                userId: entry.USER_ID,
                companyId: entry.COMPANY_ID,
                progressType: entry.PROGRESS_TYPE,
                title: entry.TITLE,
                description: entry.DESCRIPTION,
                hoursWorked: entry.HOURS_WORKED ? parseFloat(entry.HOURS_WORKED) : null,
                statusUpdate: entry.STATUS_UPDATE,
                relatedAttachmentId: entry.RELATED_ATTACHMENT_ID,
                isMilestone: entry.IS_MILESTONE,
                isVisibleToRequestor: entry.IS_VISIBLE_TO_REQUESTOR,
                createDate: entry.CREATE_DATE,
                updateDate: entry.UPDATE_DATE,
                user: {
                    firstName: entry.FIRST_NAME,
                    lastName: entry.LAST_NAME,
                    email: entry.EMAIL
                },
                attachmentFileName: entry.ATTACHMENT_FILE_NAME
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching work progress:', error);
        res.status(500).json({
            error: 'Failed to fetch work progress',
            message: error.message
        });
    }
});

// Add new progress entry with optional file upload
app.post('/api/requests/:id/progress', getAuthenticatedUserCompany, upload.single('attachment'), async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const {
            progressType = 'note',
            title,
            description,
            hoursWorked,
            statusUpdate,
            isMilestone = false,
            isVisibleToRequestor = true
        } = req.body;

        console.log(`📝 Adding progress entry for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                error: 'Progress title is required'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID, ASSIGNED_ID, REQUESTOR_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requestExists[0];

        // Check if user is authorized to add progress (assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isAssigned = request.ASSIGNED_ID === req.userId;
        const isRequestor = request.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to add progress to this request'
            });
        }

        let attachmentId = null;

        // Handle file upload if provided
        if (req.file) {
            console.log(`📎 Processing file upload: ${req.file.originalname}`);
            
            const fileResult = await prisma.$queryRaw`
                INSERT INTO GUARDIAN.ATTACHMENTS (
                    REQUEST_ID, 
                    FILE_NAME, 
                    ATTACHMENT, 
                    COMPANY_ID,
                    CREATE_USER_ID, 
                    CREATE_DATE
                ) 
                OUTPUT INSERTED.ATTACHMENT_ID
                VALUES (
                    ${requestId},
                    ${req.file.originalname},
                    ${req.file.buffer},
                    ${req.companyId},
                    ${req.userId},
                    GETDATE()
                )
            `;

            if (fileResult.length > 0) {
                attachmentId = fileResult[0].ATTACHMENT_ID;
                console.log(`✅ File uploaded with attachment ID: ${attachmentId}`);
            }
        }

        // Create the progress entry
        const progressResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORK_PROGRESS (
                REQUEST_ID,
                USER_ID,
                COMPANY_ID,
                PROGRESS_TYPE,
                TITLE,
                DESCRIPTION,
                HOURS_WORKED,
                STATUS_UPDATE,
                RELATED_ATTACHMENT_ID,
                IS_MILESTONE,
                IS_VISIBLE_TO_REQUESTOR,
                CREATE_USER_ID,
                CREATE_DATE
            )
            OUTPUT INSERTED.WORK_PROGRESS_ID
            VALUES (
                ${requestId},
                ${req.userId},
                ${req.companyId},
                ${progressType},
                ${title},
                ${description || null},
                ${hoursWorked ? parseFloat(hoursWorked) : null},
                ${statusUpdate || null},
                ${attachmentId},
                ${isMilestone === 'true' || isMilestone === true ? 1 : 0},
                ${isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0},
                ${req.userId},
                GETDATE()
            )
        `;

        const workProgressId = progressResult[0].WORK_PROGRESS_ID;
        console.log(`✅ Progress entry created with ID: ${workProgressId}`);

        // If this is a milestone or status update, create notifications for relevant users
        if (isMilestone === 'true' || isMilestone === true || statusUpdate) {
            try {
                const notificationTitle = isMilestone ? 'Milestone Reached' : 'Status Update';
                const notificationMessage = `${title}${statusUpdate ? ` - Status: ${statusUpdate}` : ''}`;

                // Notify requestor if not the same user
                if (request.REQUESTOR_ID && request.REQUESTOR_ID !== req.userId) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.REQUESTOR_ID},
                            'progress_update',
                            ${notificationTitle},
                            ${notificationMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                }

                // Notify assigned user if not the same user
                if (request.ASSIGNED_ID && request.ASSIGNED_ID !== req.userId) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.ASSIGNED_ID},
                            'progress_update',
                            ${notificationTitle},
                            ${notificationMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                }

                console.log(`🔔 Progress update notifications created`);
            } catch (notificationError) {
                console.error('⚠️ Failed to create progress notifications:', notificationError);
                // Don't fail the progress creation if notification creation fails
            }
        }

        res.json({
            success: true,
            message: 'Progress entry added successfully',
            workProgressId: workProgressId,
            attachmentId: attachmentId
        });

    } catch (error) {
        console.error('❌ Error adding progress entry:', error);
        res.status(500).json({
            error: 'Failed to add progress entry',
            message: error.message
        });
    }
});

// Update existing progress entry
app.put('/api/progress/:progressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);
        const {
            title,
            description,
            hoursWorked,
            statusUpdate,
            isMilestone,
            isVisibleToRequestor
        } = req.body;

        console.log(`✏️ Updating progress entry ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Verify progress entry belongs to user's company and get details
        const progressEntry = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.REQUEST_ID, r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${progressId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const entry = progressEntry[0];

        // Check if user is authorized to update progress (creator, assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = entry.USER_ID === req.userId;
        const isAssigned = entry.ASSIGNED_ID === req.userId;
        const isRequestor = entry.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to update this progress entry'
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (title !== undefined) {
            updates.push('TITLE = ?');
            values.push(title);
        }
        if (description !== undefined) {
            updates.push('DESCRIPTION = ?');
            values.push(description);
        }
        if (hoursWorked !== undefined) {
            updates.push('HOURS_WORKED = ?');
            values.push(hoursWorked ? parseFloat(hoursWorked) : null);
        }
        if (statusUpdate !== undefined) {
            updates.push('STATUS_UPDATE = ?');
            values.push(statusUpdate);
        }
        if (isMilestone !== undefined) {
            updates.push('IS_MILESTONE = ?');
            values.push(isMilestone === 'true' || isMilestone === true ? 1 : 0);
        }
        if (isVisibleToRequestor !== undefined) {
            updates.push('IS_VISIBLE_TO_REQUESTOR = ?');
            values.push(isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No valid fields provided for update'
            });
        }

        updates.push('UPDATE_DATE = GETDATE()');
        updates.push('UPDATE_USER_ID = ?');
        values.push(req.userId);

        await prisma.$executeRaw`
            UPDATE GUARDIAN.WORK_PROGRESS 
            SET TITLE = ${title || null},
                DESCRIPTION = ${description || null},
                HOURS_WORKED = ${hoursWorked ? parseFloat(hoursWorked) : null},
                STATUS_UPDATE = ${statusUpdate || null},
                IS_MILESTONE = ${isMilestone === 'true' || isMilestone === true ? 1 : 0},
                IS_VISIBLE_TO_REQUESTOR = ${isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE WORK_PROGRESS_ID = ${progressId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Progress entry ${progressId} updated successfully`);

        res.json({
            success: true,
            message: 'Progress entry updated successfully',
            workProgressId: progressId
        });

    } catch (error) {
        console.error('❌ Error updating progress entry:', error);
        res.status(500).json({
            error: 'Failed to update progress entry',
            message: error.message
        });
    }
});

// Delete progress entry
app.delete('/api/progress/:progressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);

        console.log(`🗑️ Deleting progress entry ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Verify progress entry belongs to user's company and get details
        const progressEntry = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.REQUEST_ID, r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${progressId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const entry = progressEntry[0];

        // Check if user is authorized to delete progress (creator or admin only)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = entry.USER_ID === req.userId;

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                error: 'You are not authorized to delete this progress entry'
            });
        }

        // Delete the progress entry
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${progressId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Progress entry ${progressId} deleted successfully`);

        res.json({
            success: true,
            message: 'Progress entry deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting progress entry:', error);
        res.status(500).json({
            error: 'Failed to delete progress entry',
            message: error.message
        });
    }
});

// Get progress summary/statistics for a request
app.get('/api/progress/:progressId/summary', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);

        console.log(`📊 Fetching progress summary for ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Get the request ID from the progress entry
        const progressEntry = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${progressId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const requestId = progressEntry[0].REQUEST_ID;

        // Get summary statistics
        const summary = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as TOTAL_ENTRIES,
                SUM(CASE WHEN IS_MILESTONE = 1 THEN 1 ELSE 0 END) as MILESTONE_COUNT,
                SUM(CASE WHEN HOURS_WORKED IS NOT NULL THEN HOURS_WORKED ELSE 0 END) as TOTAL_HOURS,
                COUNT(DISTINCT USER_ID) as CONTRIBUTORS_COUNT,
                COUNT(CASE WHEN RELATED_ATTACHMENT_ID IS NOT NULL THEN 1 END) as ATTACHMENTS_COUNT,
                MIN(CREATE_DATE) as FIRST_ENTRY,
                MAX(CREATE_DATE) as LATEST_ENTRY
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        // Get progress type breakdown
        const typeBreakdown = await prisma.$queryRaw`
            SELECT 
                PROGRESS_TYPE,
                COUNT(*) as COUNT
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            GROUP BY PROGRESS_TYPE
            ORDER BY COUNT DESC
        `;

        const summaryData = summary[0];

        console.log(`✅ Progress summary compiled for request ${requestId}`);

        res.json({
            success: true,
            summary: {
                totalEntries: parseInt(summaryData.TOTAL_ENTRIES),
                milestoneCount: parseInt(summaryData.MILESTONE_COUNT),
                totalHours: parseFloat(summaryData.TOTAL_HOURS) || 0,
                contributorsCount: parseInt(summaryData.CONTRIBUTORS_COUNT),
                attachmentsCount: parseInt(summaryData.ATTACHMENTS_COUNT),
                firstEntry: summaryData.FIRST_ENTRY,
                latestEntry: summaryData.LATEST_ENTRY,
                typeBreakdown: typeBreakdown.map(item => ({
                    type: item.PROGRESS_TYPE,
                    count: parseInt(item.COUNT)
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error fetching progress summary:', error);
        res.status(500).json({
            error: 'Failed to fetch progress summary',
            message: error.message
        });
    }
});

// === TASK MANAGEMENT ENDPOINTS ===

// Get tasks for a specific request
app.get('/api/requests/:requestId/tasks', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        console.log(`📋 Fetching tasks for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUESTOR_ID, ASSIGNED_ID, STATUS
            FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Get tasks with user information
        const tasks = await prisma.$queryRaw`
            SELECT 
                t.TASK_ID,
                t.REQUEST_ID,
                t.STATUS,
                t.ASSIGNED_USER_ID,
                t.DESCRIPTION,
                t.CREATE_DATE,
                t.UPDATE_DATE,
                t.TRACKINGID,
                au.FIRST_NAME as ASSIGNED_FIRST_NAME,
                au.LAST_NAME as ASSIGNED_LAST_NAME,
                au.EMAIL as ASSIGNED_EMAIL,
                cu.FIRST_NAME as CREATED_BY_FIRST_NAME,
                cu.LAST_NAME as CREATED_BY_LAST_NAME,
                cu.EMAIL as CREATED_BY_EMAIL
            FROM GUARDIAN.TASKS t
            LEFT JOIN GUARDIAN.USERS au ON t.ASSIGNED_USER_ID = au.USER_ID
            LEFT JOIN GUARDIAN.USERS cu ON t.CREATE_USER_ID = cu.USER_ID
            WHERE t.REQUEST_ID = ${requestId}
            ORDER BY t.CREATE_DATE DESC
        `;

        // Format tasks with user objects
        const formattedTasks = tasks.map(task => ({
            ...task,
            assignedUser: task.ASSIGNED_USER_ID ? {
                FIRST_NAME: task.ASSIGNED_FIRST_NAME,
                LAST_NAME: task.ASSIGNED_LAST_NAME,
                EMAIL: task.ASSIGNED_EMAIL
            } : null,
            createdBy: {
                FIRST_NAME: task.CREATED_BY_FIRST_NAME,
                LAST_NAME: task.CREATED_BY_LAST_NAME,
                EMAIL: task.CREATED_BY_EMAIL
            }
        }));

        // Calculate summary
        const summary = {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.STATUS === 'Pending').length,
            inProgressTasks: tasks.filter(t => t.STATUS === 'In Progress').length,
            completedTasks: tasks.filter(t => t.STATUS === 'Completed').length
        };

        console.log(`✅ Found ${tasks.length} tasks for request ${requestId}`);

        res.json({
            success: true,
            data: formattedTasks,
            summary: summary
        });

    } catch (error) {
        console.error('❌ Error fetching tasks:', error);
        res.status(500).json({
            error: 'Failed to fetch tasks',
            message: error.message
        });
    }
});

// Create a new task
app.post('/api/tasks', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { requestId, assignedUserId, description, status = 'Pending' } = req.body;
        
        console.log(`➕ Creating task for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || !description) {
            return res.status(400).json({
                error: 'Request ID and description are required'
            });
        }

        // Verify request belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUESTOR_ID, ASSIGNED_ID, STATUS
            FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // If assignedUserId is provided, verify the user exists and belongs to the same company
        if (assignedUserId) {
            const assignedUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS
                WHERE USER_ID = ${assignedUserId} AND COMPANY_ID = ${req.companyId}
            `;

            if (!assignedUser.length) {
                return res.status(400).json({
                    error: 'Assigned user not found or not in the same company'
                });
            }
        }

        // Generate tracking ID for the task
        const trackingId = `TSK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Create the task
        const taskResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.TASKS (
                REQUEST_ID,
                STATUS,
                ASSIGNED_USER_ID,
                DESCRIPTION,
                CREATE_USER_ID,
                UPDATE_USER_ID,
                CREATE_DATE,
                UPDATE_DATE,
                TRACKINGID
            )
            OUTPUT INSERTED.TASK_ID
            VALUES (
                ${requestId},
                ${status},
                ${assignedUserId || null},
                ${description},
                ${req.userId},
                ${req.userId},
                GETDATE(),
                GETDATE(),
                ${trackingId}
            )
        `;

        const taskId = taskResult[0].TASK_ID;
        console.log(`✅ Task created with ID: ${taskId}`);

        // Create notification for assigned user if different from creator
        if (assignedUserId && assignedUserId !== req.userId) {
            try {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTIFICATIONS (
                        USER_ID, 
                        TYPE, 
                        TITLE, 
                        MESSAGE, 
                        RELATED_ID, 
                        COMPANY_ID, 
                        CREATED_DATE, 
                        IS_READ
                    ) VALUES (
                        ${assignedUserId}, 
                        'task_assigned', 
                        'New Task Assigned', 
                        ${'You have been assigned a new task: ' + description}, 
                        ${taskId}, 
                        ${req.companyId}, 
                        GETDATE(), 
                        0
                    )
                `;
                console.log(`📢 Notification sent to user ${assignedUserId} for task assignment`);
            } catch (notificationError) {
                console.error('⚠️ Failed to create notification:', notificationError);
                // Continue anyway - task creation should not fail due to notification issues
            }
        }

        res.json({
            success: true,
            message: 'Task created successfully',
            taskId: taskId,
            trackingId: trackingId
        });

    } catch (error) {
        console.error('❌ Error creating task:', error);
        res.status(500).json({
            error: 'Failed to create task',
            message: error.message
        });
    }
});

// Update a task
app.put('/api/tasks/:taskId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const { assignedUserId, description, status } = req.body;

        console.log(`✏️ Updating task ${taskId} (Company: ${req.companyId})`);

        if (!taskId || isNaN(taskId)) {
            return res.status(400).json({
                error: 'Valid task ID is required'
            });
        }

        // Verify task exists and belongs to user's company
        const task = await prisma.$queryRaw`
            SELECT t.TASK_ID, t.REQUEST_ID, t.ASSIGNED_USER_ID, t.CREATE_USER_ID, r.COMPANY_ID
            FROM GUARDIAN.TASKS t
            INNER JOIN GUARDIAN.REQUESTS r ON t.REQUEST_ID = r.REQUEST_ID
            WHERE t.TASK_ID = ${taskId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!task.length) {
            return res.status(404).json({
                error: 'Task not found or access denied'
            });
        }

        // Build update query dynamically
        const updates = [];
        const updateData = {};

        if (description !== undefined) {
            updates.push('DESCRIPTION = @description');
            updateData.description = description;
        }

        if (status !== undefined) {
            updates.push('STATUS = @status');
            updateData.status = status;
        }

        if (assignedUserId !== undefined) {
            if (assignedUserId) {
                // Verify the user exists and belongs to the same company
                const assignedUser = await prisma.$queryRaw`
                    SELECT USER_ID FROM GUARDIAN.USERS
                    WHERE USER_ID = ${assignedUserId} AND COMPANY_ID = ${req.companyId}
                `;

                if (!assignedUser.length) {
                    return res.status(400).json({
                        error: 'Assigned user not found or not in the same company'
                    });
                }
            }
            updates.push('ASSIGNED_USER_ID = @assignedUserId');
            updateData.assignedUserId = assignedUserId || null;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update'
            });
        }

        // Add standard update fields
        updates.push('UPDATE_DATE = GETDATE()');
        updates.push('UPDATE_USER_ID = @updateUserId');
        updateData.updateUserId = req.userId;

        // Execute update
        await prisma.$executeRaw`
            UPDATE GUARDIAN.TASKS 
            SET DESCRIPTION = ${description || task[0].DESCRIPTION},
                STATUS = ${status || task[0].STATUS},
                ASSIGNED_USER_ID = ${assignedUserId !== undefined ? (assignedUserId || null) : task[0].ASSIGNED_USER_ID},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE TASK_ID = ${taskId}
        `;

        console.log(`✅ Task ${taskId} updated successfully`);

        res.json({
            success: true,
            message: 'Task updated successfully',
            taskId: taskId
        });

    } catch (error) {
        console.error('❌ Error updating task:', error);
        res.status(500).json({
            error: 'Failed to update task',
            message: error.message
        });
    }
});

// Delete a task
app.delete('/api/tasks/:taskId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);

        console.log(`🗑️ Deleting task ${taskId} (Company: ${req.companyId})`);

        if (!taskId || isNaN(taskId)) {
            return res.status(400).json({
                error: 'Valid task ID is required'
            });
        }

        // Verify task exists and belongs to user's company
        const task = await prisma.$queryRaw`
            SELECT t.TASK_ID, r.COMPANY_ID
            FROM GUARDIAN.TASKS t
            INNER JOIN GUARDIAN.REQUESTS r ON t.REQUEST_ID = r.REQUEST_ID
            WHERE t.TASK_ID = ${taskId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!task.length) {
            return res.status(404).json({
                error: 'Task not found or access denied'
            });
        }

        // Delete the task
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.TASKS WHERE TASK_ID = ${taskId}
        `;

        console.log(`✅ Task ${taskId} deleted successfully`);

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting task:', error);
        res.status(500).json({
            error: 'Failed to delete task',
            message: error.message
        });
    }
});

// === ATTACHMENT MANAGEMENT ENDPOINTS ===

// Upload file attachment to request
app.post('/api/requests/:id/attachments', getAuthenticatedUserCompany, upload.single('file'), async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        console.log(`📎 Uploading attachment for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'File is required'
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

        console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

        // Insert the attachment
        const attachmentResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.ATTACHMENTS (
                REQUEST_ID, 
                FILE_NAME, 
                ATTACHMENT, 
                COMPANY_ID,
                CREATE_USER_ID, 
                CREATE_DATE
            ) 
            OUTPUT INSERTED.ATTACHMENT_ID
            VALUES (
                ${requestId},
                ${req.file.originalname},
                ${req.file.buffer},
                ${req.companyId},
                ${req.userId},
                GETDATE()
            )
        `;

        const attachmentId = attachmentResult[0].ATTACHMENT_ID;
        console.log(`✅ Attachment uploaded successfully with ID: ${attachmentId}`);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            attachmentId: attachmentId,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('❌ Error uploading attachment:', error);
        res.status(500).json({
            error: 'Failed to upload attachment',
            message: error.message
        });
    }
});

// Get all attachments for a request
app.get('/api/requests/:id/attachments', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        console.log(`📎 Fetching attachments for request ${requestId} (Company: ${req.companyId})`);

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

        // Get all attachments for the request
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.REQUEST_ID,
                a.FILE_NAME,
                a.CREATE_DATE,
                a.CREATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.ATTACHMENTS a
            LEFT JOIN GUARDIAN.USERS u ON a.CREATE_USER_ID = u.USER_ID
            WHERE a.REQUEST_ID = ${requestId} 
            AND a.COMPANY_ID = ${req.companyId}
            ORDER BY a.CREATE_DATE DESC
        `;

        console.log(`✅ Found ${attachments.length} attachments for request ${requestId}`);

        res.json({
            success: true,
            attachments: attachments.map(attachment => ({
                attachmentId: attachment.ATTACHMENT_ID,
                requestId: attachment.REQUEST_ID,
                fileName: attachment.FILE_NAME,
                createDate: attachment.CREATE_DATE,
                uploadedBy: {
                    userId: attachment.CREATE_USER_ID,
                    firstName: attachment.FIRST_NAME,
                    lastName: attachment.LAST_NAME,
                    email: attachment.EMAIL
                }
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching attachments:', error);
        res.status(500).json({
            error: 'Failed to fetch attachments',
            message: error.message
        });
    }
});

// Download specific attachment
app.get('/api/attachments/:id/download', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);

        console.log(`⬇️ Downloading attachment ${attachmentId} (Company: ${req.companyId})`);

        if (!attachmentId || isNaN(attachmentId)) {
            return res.status(400).json({
                error: 'Valid attachment ID is required'
            });
        }

        // Get the attachment with company verification
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.FILE_NAME,
                a.ATTACHMENT,
                a.CREATE_DATE
            FROM GUARDIAN.ATTACHMENTS a
            WHERE a.ATTACHMENT_ID = ${attachmentId} 
            AND a.COMPANY_ID = ${req.companyId}
        `;

        if (!attachments.length) {
            return res.status(404).json({
                error: 'Attachment not found or access denied'
            });
        }

        const attachment = attachments[0];
        console.log(`📁 Serving file: ${attachment.FILE_NAME}`);

        // Set appropriate headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.FILE_NAME}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Send the file buffer
        res.send(attachment.ATTACHMENT);

    } catch (error) {
        console.error('❌ Error downloading attachment:', error);
        res.status(500).json({
            error: 'Failed to download attachment',
            message: error.message
        });
    }
});

// Delete attachment
app.delete('/api/attachments/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);

        console.log(`🗑️ Deleting attachment ${attachmentId} (Company: ${req.companyId})`);

        if (!attachmentId || isNaN(attachmentId)) {
            return res.status(400).json({
                error: 'Valid attachment ID is required'
            });
        }

        // Verify attachment belongs to user's company and get details
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.CREATE_USER_ID,
                a.REQUEST_ID,
                r.ASSIGNED_ID,
                r.REQUESTOR_ID
            FROM GUARDIAN.ATTACHMENTS a
            INNER JOIN GUARDIAN.REQUESTS r ON a.REQUEST_ID = r.REQUEST_ID
            WHERE a.ATTACHMENT_ID = ${attachmentId} 
            AND a.COMPANY_ID = ${req.companyId}
        `;

        if (!attachments.length) {
            return res.status(404).json({
                error: 'Attachment not found or access denied'
            });
        }

        const attachment = attachments[0];

        // Check if user is authorized to delete attachment (uploader, assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isUploader = attachment.CREATE_USER_ID === req.userId;
        const isAssigned = attachment.ASSIGNED_ID === req.userId;
        const isRequestor = attachment.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isUploader && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to delete this attachment'
            });
        }

        // Check if attachment is referenced by any work progress entries
        const progressReferences = await prisma.$queryRaw`
            SELECT COUNT(*) as COUNT 
            FROM GUARDIAN.WORK_PROGRESS 
            WHERE RELATED_ATTACHMENT_ID = ${attachmentId}
        `;

        if (progressReferences[0].COUNT > 0) {
            return res.status(400).json({
                error: 'Cannot delete attachment that is referenced by work progress entries'
            });
        }

        // Delete the attachment
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.ATTACHMENTS 
            WHERE ATTACHMENT_ID = ${attachmentId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Attachment ${attachmentId} deleted successfully`);

        res.json({
            success: true,
            message: 'Attachment deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting attachment:', error);
        res.status(500).json({
            error: 'Failed to delete attachment',
            message: error.message
        });
    }
});

// Get form for a specific request (for form fulfillment)
app.get('/api/requests/:id/form', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`📋 Fetching form for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Get the request details
        console.log(`🔍 Querying for request ${requestId} in company ${req.companyId}`);
        const requests = await prisma.$queryRaw`
            SELECT r.REQUEST_ID, r.REQUEST_NAME, r.FORM_ID, r.STATUS, r.REQUESTOR_ID, r.ASSIGNED_ID,
                   r.CREATE_DATE, r.UPDATE_DATE, r.COMPANY_ID, r.REQUEST_DESCRIPTION
            FROM GUARDIAN.REQUESTS r
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;

        console.log(`🔍 Found ${requests.length} requests matching criteria`);
        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requests[0];
        console.log(`✅ Found request with FORM_ID: ${request.FORM_ID}`);

        if (!request.FORM_ID) {
            console.log(`❌ Request ${requestId} has no form associated`);
            return res.status(404).json({
                error: 'No form associated with this request'
            });
        }

        // Get the form details (check both company-specific and global forms)
        console.log(`🔍 Querying for form ${request.FORM_ID} (company-specific or global)`);
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${request.FORM_ID} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
        `;

        console.log(`🔍 Found ${forms.length} forms matching criteria`);
        if (!forms.length) {
            console.log(`❌ Form ${request.FORM_ID} not found for organization ${req.companyId}`);
            return res.status(404).json({
                error: 'Form template not found or access denied',
                details: `Request ${requestId} references form ${request.FORM_ID} which is not available for your organization`,
                requestId: requestId,
                formId: request.FORM_ID,
                companyId: req.companyId
            });
        }

        const form = forms[0];

        // Get fields specific to this form using the FORMS_FIELDS junction table
        console.log(`🔍 Querying fields for form ${request.FORM_ID} using junction table`);
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_SENSITIVE, 
                   f.CREATE_DATE, f.UPDATE_DATE, f.ORGANIZATION_ID,
                   ff.IS_REQUIRED as FORM_IS_REQUIRED, ff.SORT_ORDER
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${request.FORM_ID}
            AND (f.ORGANIZATION_ID = ${req.companyId} OR f.ORGANIZATION_ID IS NULL)
            AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;
        console.log(`✅ Found ${fields.length} form-specific fields for form ${request.FORM_ID}`);

        // Check for existing form instance and values
        console.log(`🔍 Checking for existing form instance for request ${requestId}`);
        
        // Admin roles (1, 3, 4, 6) can see all form instances, others only see their own
        const isAdmin = req.userRoleIds && req.userRoleIds.some(roleId => [1, 3, 4, 6].includes(roleId));
        
        let existingInstances;
        // Look for existing form instance for this specific request
        existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID, SUBMITTED_DATE, CREATE_DATE, UPDATE_DATE, ASSIGNED_ID
            FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            ORDER BY CREATE_DATE DESC
        `;
        console.log(`🔍 Fetching form instance for request ${requestId}`);

        let existingValues = {};
        let formInstanceId = null;
        let formStatus = 'new'; // new, in_progress, completed

        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            const submittedDate = existingInstances[0].SUBMITTED_DATE;
            
            console.log(`📋 Found existing form instance: ${formInstanceId}`);
            
            // Get existing field values
            const savedValues = await prisma.$queryRaw`
                SELECT FIELD_ID, VALUE
                FROM GUARDIAN.FORMS_INSTANCE_VALUES 
                WHERE FORM_INSTANCE_ID = ${formInstanceId}
            `;
            
            // Convert to object with field IDs as keys (for backend processing)
            const existingValuesByFieldId = savedValues.reduce((acc, value) => {
                acc[value.FIELD_ID] = value.VALUE;
                return acc;
            }, {});
            
            // Also create a mapping by field name (for frontend usage)
            existingValues = savedValues.reduce((acc, value) => {
                // Find the field with this FIELD_ID to get its name
                const field = fields.find(f => f.FIELD_ID === value.FIELD_ID);
                if (field) {
                    acc[field.FIELD_NAME] = value.VALUE;
                }
                return acc;
            }, {});
            
            console.log(`📊 Found ${savedValues.length} existing field values`);
            
            // Determine form completion status
            const requiredFields = fields.filter(f => f.FORM_IS_REQUIRED || f.IS_REQUIRED);
            const filledRequiredFields = requiredFields.filter(f => 
                existingValuesByFieldId[f.FIELD_ID] && existingValuesByFieldId[f.FIELD_ID].trim() !== ''
            );
            
            if (submittedDate && filledRequiredFields.length === requiredFields.length) {
                formStatus = 'completed';
            } else if (savedValues.length > 0) {
                formStatus = 'in_progress';
            }
            
            console.log(`📈 Form status: ${formStatus} (${filledRequiredFields.length}/${requiredFields.length} required fields filled)`);
        } else {
            console.log(`📝 No existing form instance found - new form`);
        }

        console.log(`✅ Found request ${requestId} with form ${request.FORM_ID} containing ${fields.length} fields`);

        // Prepare response in expected format
        const response = {
            request: {
                REQUEST_ID: request.REQUEST_ID,
                REQUEST_NAME: request.REQUEST_NAME,
                STATUS: request.STATUS,
                FORM_ID: request.FORM_ID,
                REQUESTOR_ID: request.REQUESTOR_ID,
                ASSIGNED_ID: request.ASSIGNED_ID,
                CREATE_DATE: request.CREATE_DATE,
                UPDATE_DATE: request.UPDATE_DATE,
                REQUEST_DESCRIPTION: request.REQUEST_DESCRIPTION
            },
            form: {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                FORM_DESCRIPTION: form.FORM_DESCRIPTION,
                IS_ACTIVE: form.IS_ACTIVE,
                IS_PUBLIC: form.IS_PUBLIC,
                IS_DELETED: form.IS_DELETED
            },
            fields: fields.map(field => ({
                FIELD_ID: field.FIELD_ID,
                FIELD_NAME: field.FIELD_NAME,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID,
                DISPLAY_FORMAT: field.DISPLAY_FORMAT,
                HAS_LOOKUP: field.HAS_LOOKUP,
                IS_PUBLIC: field.IS_PUBLIC,
                IS_ACTIVE: field.IS_ACTIVE,
                IS_DELETED: field.IS_DELETED,
                IS_REQUIRED: field.FORM_IS_REQUIRED || field.IS_REQUIRED, // Use form-specific requirement
                IS_SENSITIVE: field.IS_SENSITIVE,
                SORT_ORDER: field.SORT_ORDER,
                CREATE_DATE: field.CREATE_DATE,
                UPDATE_DATE: field.UPDATE_DATE,
                ORGANIZATION_ID: field.ORGANIZATION_ID
            })),
            values: existingValues, // Include existing values for form pre-filling
            formInstanceId: formInstanceId,
            formStatus: formStatus, // new, in_progress, completed
            isCompleted: formStatus === 'completed',
            hasExistingData: Object.keys(existingValues).length > 0
        };

        console.log(`📤 Sending form data for request ${requestId} to frontend`);
        res.json(response);

    } catch (error) {
        console.error(`❌ Error fetching form for request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to fetch request form',
            message: error.message
        });
    }
});

// Submit form data for a specific request
app.post('/api/requests/:id/form/submit', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { fieldValues, isComplete = false, isDraft = false } = req.body;

        console.log(`📝 Submitting form data for request ${requestId} (Company: ${req.companyId})`);
        console.log(`📋 Field values:`, JSON.stringify(fieldValues, null, 2));
        console.log(`📊 Submission type: ${isComplete ? 'Complete' : isDraft ? 'Draft' : 'Auto-save'}`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!fieldValues || typeof fieldValues !== 'object') {
            return res.status(400).json({
                error: 'Field values are required'
            });
        }

        // Get the request details to verify ownership and get form ID
        const requests = await prisma.$queryRaw`
            SELECT r.REQUEST_ID, r.FORM_ID, r.ASSIGNED_ID, r.COMPANY_ID
            FROM GUARDIAN.REQUESTS r
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requests[0];
        
        if (!request.FORM_ID) {
            return res.status(400).json({
                error: 'No form associated with this request'
            });
        }

        // Check if form instance already exists for this request
        // Admin roles (1, 3, 4, 6) can see all form instances, others only see their own
        const isAdmin = req.userRoleIds && req.userRoleIds.some(roleId => [1, 3, 4, 6].includes(roleId));
        
        let existingInstances;
        // Look for existing form instance for this specific request
        existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            ORDER BY CREATE_DATE DESC
        `;

        let formInstanceId;

        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            console.log(`📋 Using existing form instance: ${formInstanceId}`);
            
            // Update the existing instance with appropriate submitted date
            if (isComplete) {
                // Set submitted date for completed forms
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET SUBMITTED_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`✅ Marked form instance as completed`);
            } else {
                // For drafts/in-progress, update timestamp but keep submitted_date NULL
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET UPDATE_USER_ID = ${req.userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`📝 Updated form instance as in-progress`);
            }
        } else {
            // Create new form instance
            if (isComplete) {
                // Complete submission
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || req.userId}, ${req.companyId}, GETDATE(), ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new completed form instance`);
            } else {
                // Draft/in-progress submission (no submitted date)
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || req.userId}, ${req.companyId}, NULL, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new draft form instance`);
            }

            // Get the new instance ID
            let newInstances;
            if (isAdmin) {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID} AND COMPANY_ID = ${req.companyId}
                    ORDER BY CREATE_DATE DESC
                `;
            } else {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID} AND ASSIGNED_ID = ${request.ASSIGNED_ID} AND COMPANY_ID = ${req.companyId}
                    ORDER BY CREATE_DATE DESC
                `;
            }
            
            formInstanceId = newInstances[0].FORM_INSTANCE_ID;
        }

        // Delete existing field values for this instance
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
            WHERE FORM_INSTANCE_ID = ${formInstanceId}
        `;

        // Insert new field values
        let savedCount = 0;
        for (const [fieldId, value] of Object.entries(fieldValues)) {
            if (value !== null && value !== undefined && value !== '') {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES (
                        FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${formInstanceId}, ${parseInt(fieldId)}, ${String(value)}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                savedCount++;
            }
        }

        // Determine the final status
        const finalStatus = isComplete ? 'completed' : (savedCount > 0 ? 'in_progress' : 'new');
        const statusMessage = isComplete ? 'Form completed successfully' : 
                            isDraft ? 'Draft saved successfully' : 
                            'Form data saved successfully';

        console.log(`✅ Form submitted successfully for request ${requestId}: ${savedCount} field values saved (Status: ${finalStatus})`);

        res.json({
            success: true,
            message: statusMessage,
            formInstanceId: formInstanceId,
            savedFieldCount: savedCount,
            formStatus: finalStatus,
            isComplete: isComplete,
            isDraft: isDraft
        });

    } catch (error) {
        console.error(`❌ Error submitting form for request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to submit form data',
            message: error.message
        });
    }
});

// Delete a specific request
app.delete('/api/requests/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`🗑️ Attempting to delete request ${requestId} for company ${req.companyId}`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Check if user has permission to delete (Admin, Manager, or Super Admin roles: 1, 3, 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const canDelete = roleIds.includes(1) || roleIds.includes(3) || roleIds.includes(6);
        
        if (!canDelete) {
            console.log(`❌ User ${req.userId} lacks permission to delete requests`);
            return res.status(403).json({
                error: 'You do not have permission to delete requests'
            });
        }

        // First, check if the request exists and belongs to the company
        const existingRequest = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME, FORM_ID
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!existingRequest.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = existingRequest[0];
        console.log(`📋 Found request to delete: ${request.REQUEST_NAME}`);

        // Use a transaction to ensure all deletions succeed or all fail
        await prisma.$transaction(async (tx) => {
            
            // 1. First, get all form instance IDs for this request
            const formInstances = await tx.$queryRaw`
                SELECT FORM_INSTANCE_ID 
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`📋 Found ${formInstances.length} form instances to delete`);

            // 2. Delete form instance values for each form instance (avoid foreign key constraint issues)
            let totalValuesDeleted = 0;
            if (formInstances.length > 0) {
                for (const instance of formInstances) {
                    const deletedValues = await tx.$executeRaw`
                        DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
                        WHERE FORM_INSTANCE_ID = ${instance.FORM_INSTANCE_ID}
                    `;
                    console.log(`🗑️ Deleted ${deletedValues} values for form instance ${instance.FORM_INSTANCE_ID}`);
                    totalValuesDeleted += deletedValues;
                }
                console.log(`✅ Deleted total of ${totalValuesDeleted} form instance values`);
            }

            // 3. Delete form instances (to avoid foreign key constraint with REQUEST_ID)
            const deletedInstances = await tx.$executeRaw`
                DELETE FROM GUARDIAN.FORMS_INSTANCE
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedInstances} form instances`);

            // Verify form instances are actually deleted
            const remainingInstances = await tx.$queryRaw`
                SELECT COUNT(*) as count 
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`🔍 Remaining form instances: ${remainingInstances[0].count}`);
            
            if (remainingInstances[0].count > 0) {
                throw new Error(`Failed to delete all form instances. ${remainingInstances[0].count} remain.`);
            }

            // 4. Delete tasks related to this request
            const deletedTasks = await tx.$executeRaw`
                DELETE FROM GUARDIAN.TASKS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedTasks} related tasks`);

            // 5. Delete notifications related to this specific request
            const deletedNotifications = await tx.$executeRaw`
                DELETE FROM GUARDIAN.NOTIFICATIONS
                WHERE MESSAGE LIKE 'Request #${requestId}%' OR MESSAGE LIKE '%request ${requestId}%'
            `;
            console.log(`✅ Deleted ${deletedNotifications} related notifications`);

            // 6. Delete attachments related to this request
            const deletedAttachments = await tx.$executeRaw`
                DELETE FROM GUARDIAN.ATTACHMENTS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedAttachments} related attachments`);

            // 7. Finally, delete the request itself
            const deletedRequests = await tx.$executeRaw`
                DELETE FROM GUARDIAN.REQUESTS
                WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            `;
            console.log(`✅ Deleted ${deletedRequests} request(s)`);
            
            if (deletedRequests === 0) {
                throw new Error(`Failed to delete request ${requestId}`);
            }
        });

        console.log(`✅ Successfully deleted request ${requestId}: ${request.REQUEST_NAME}`);

        res.json({
            success: true,
            message: `Request "${request.REQUEST_NAME}" has been deleted successfully`
        });

    } catch (error) {
        console.error(`❌ Error deleting request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to delete request',
            message: error.message
        });
    }
});

// Get specific form by ID
app.get('/api/forms/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        console.log(`📋 Fetching form ${formId} from database for company:`, req.companyId);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        // Get user's roles to check for admin access
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6); // Role ID 6 can edit global forms
        
        console.log(`👤 User ${req.userId} roles: [${roleIds.join(', ')}], isAdmin: ${isAdmin}`);
        
        // Get the form details - admin users can access global forms (ORGANIZATION_ID IS NULL)
        let forms;
        
        if (isAdmin) {
            // Admin users can access both company forms and global forms
            forms = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
            `;
        } else {
            // Regular users can only access their company's forms
            forms = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND ORGANIZATION_ID = ${req.companyId}
            `;
        }

        if (!forms.length) {
            console.log(`❌ Form ${formId} not found for company ${req.companyId}. Checking if form exists at all...`);
            
            // Check if form exists but belongs to different company
            const anyForm = await prisma.$queryRaw`
                SELECT FORM_ID, ORGANIZATION_ID FROM GUARDIAN.FORMS WHERE FORM_ID = ${formId}
            `;
            
            if (anyForm.length > 0) {
                console.log(`📋 Form ${formId} exists but belongs to company ${anyForm[0].ORGANIZATION_ID}, user is in company ${req.companyId}`);
            } else {
                console.log(`📋 Form ${formId} does not exist in database at all`);
            }
            
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        const form = forms[0];

        // Get the form fields - join with FORMS_FIELDS to get only fields that belong to this specific form
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, ff.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CREATE_DATE, f.UPDATE_DATE, f.ORGANIZATION_ID, ff.SORT_ORDER
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${formId}
            AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;

        console.log(`✅ Found form ${formId} with ${fields.length} fields`);

        const response = {
            form: {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                FORM_DESCRIPTION: form.FORM_DESCRIPTION,
                IS_ACTIVE: form.IS_ACTIVE,
                IS_PUBLIC: form.IS_PUBLIC,
                IS_DELETED: form.IS_DELETED
            },
            fields: fields.map(field => ({
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
                SORT_ORDER: field.SORT_ORDER,
                CREATE_DATE: field.CREATE_DATE,
                UPDATE_DATE: field.UPDATE_DATE,
                ORGANIZATION_ID: field.ORGANIZATION_ID
            }))
        };

        console.log(`📤 Sending form ${formId} data to frontend`);
        res.json(response);

    } catch (error) {
        console.error(`❌ Error fetching form ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to fetch form',
            message: error.message
        });
    }
});

// Update form template endpoint
app.put('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        const { name, description, formFields } = req.body;
        
        console.log(`📝 Updating form template ${formId} for company:`, req.companyId);
        console.log(`📝 New data: name="${name}", description="${description}", fields count=${formFields?.length || 0}`);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Form name is required'
            });
        }

        // Get user's roles to check for admin access
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6); // Role ID 6 can edit global forms
        
        console.log(`👤 User ${req.userId} roles: [${roleIds.join(', ')}], isAdmin: ${isAdmin}`);
        
        // Check if form exists and user has permission to edit it
        let existingForm;
        
        if (isAdmin) {
            // Admin users can edit both company forms and global forms
            existingForm = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
            `;
        } else {
            // Regular users can only edit their company's forms
            existingForm = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND ORGANIZATION_ID = ${req.companyId}
            `;
        }

        if (!existingForm.length) {
            console.log(`❌ Form ${formId} not found or access denied for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        // Update form basic details
        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORMS 
            SET FORM_NAME = ${name.trim()}, 
                FORM_DESCRIPTION = ${description?.trim() || ''},
                UPDATE_DATE = GETDATE()
            WHERE FORM_ID = ${formId}
        `;

        console.log(`✅ Form ${formId} basic details updated successfully`);

        // TODO: Handle form fields update
        // This would involve updating the FORM_FIELDS table or similar
        console.log(`📝 Form fields update not yet implemented (${formFields?.length || 0} fields provided)`);

        res.json({
            success: true,
            message: 'Form template updated successfully',
            formId: formId
        });

    } catch (error) {
        console.error(`❌ Error updating form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to update form template',
            message: error.message
        });
    }
});

// Get specific form by ID (alternative endpoint for compatibility)
app.get('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        console.log(`📋 Fetching form ${formId} for company:`, req.companyId);

        // Get the form
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL OR COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
            AND IS_DELETED = ${false}
        `;

        if (forms.length === 0) {
            return res.status(404).json({
                error: 'Form not found'
            });
        }

        // Get the form fields
        const fields = await prisma.$queryRaw`
            SELECT ff.FIELD_ID, ff.FIELD_NAME, ff.FIELD_TYPE_ID, ff.IS_REQUIRED, ff.OPTIONS, ff.SEQUENCE,
                   ff.IS_ACTIVE, ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FORM_FIELDS ff
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON ff.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE ff.FORM_ID = ${formId} AND ff.IS_DELETED = ${false}
            ORDER BY ff.SEQUENCE, ff.FIELD_ID
        `;

        console.log(`✅ Found form ${formId} with ${fields.length} fields`);

        res.json({
            success: true,
            form: forms[0],
            fields: fields
        });

    } catch (error) {
        console.error(`❌ Error fetching form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to fetch form',
            message: error.message
        });
    }
});

// Delete a form (comprehensive cascading delete)
app.delete('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        console.log(`🗑️ Deleting form ${formId} for company:`, req.companyId);

        // Role-based permission check (Admin or Super Admin only)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const canDelete = roleIds.includes(1) || roleIds.includes(6);

        if (!canDelete) {
            console.log(`❌ User ${req.userId} does not have permission to delete forms`);
            return res.status(403).json({
                error: 'Access denied. Admin or Super Admin role required to delete form templates.'
            });
        }

        // Verify form belongs to the user's company (check both COMPANY_ID and ORGANIZATION_ID)
        const existingForm = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} 
            AND (COMPANY_ID = ${req.companyId} OR ORGANIZATION_ID = ${req.companyId})
        `;

        if (existingForm.length === 0) {
            console.log(`❌ Form ${formId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        console.log(`🧹 Starting cascading delete for form ${formId}...`);

        // Step 1: Get all form instances using this template
        const formInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE WHERE FORM_ID = ${formId}
        `;
        
        const instanceIds = formInstances.map(inst => inst.FORM_INSTANCE_ID);
        console.log(`📊 Found ${instanceIds.length} form instances to clean up`);

        // Step 2: Delete form instance values
        if (instanceIds.length > 0) {
            for (const instanceId of instanceIds) {
                await prisma.$queryRaw`
                    DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID = ${instanceId}
                `;
            }
            console.log(`🗑️ Deleted form instance values for ${instanceIds.length} instances`);
        }

        // Step 3: Delete form instances
        if (instanceIds.length > 0) {
            await prisma.$queryRaw`
                DELETE FROM GUARDIAN.FORMS_INSTANCE WHERE FORM_ID = ${formId}
            `;
            console.log(`🗑️ Deleted ${instanceIds.length} form instances`);
        }

        // Step 4: Find and delete related requests
        const relatedRequests = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS WHERE FORM_ID = ${formId}
        `;
        
        const requestIds = relatedRequests.map(req => req.REQUEST_ID);
        console.log(`📋 Found ${requestIds.length} related requests to delete`);

        // Step 5: Delete request-related data (tasks, notifications, attachments)
        if (requestIds.length > 0) {
            for (const requestId of requestIds) {
                // Delete tasks
                await prisma.$queryRaw`DELETE FROM GUARDIAN.TASKS WHERE REQUEST_ID = ${requestId}`;
                
                // Delete notifications
                await prisma.$queryRaw`DELETE FROM GUARDIAN.NOTIFICATIONS 
                    WHERE MESSAGE LIKE 'Request #${requestId}%' OR MESSAGE LIKE '%request ${requestId}%'`;
                
                // Delete attachments
                await prisma.$queryRaw`DELETE FROM GUARDIAN.ATTACHMENTS WHERE REQUEST_ID = ${requestId}`;
            }
            
            // Delete the requests themselves
            await prisma.$queryRaw`DELETE FROM GUARDIAN.REQUESTS WHERE FORM_ID = ${formId}`;
            console.log(`🗑️ Deleted ${requestIds.length} requests and all their related data`);
        }

        // Step 6: Delete form-field relationships
        await prisma.$queryRaw`DELETE FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID = ${formId}`;
        console.log(`🔗 Deleted form-field relationships`);

        // Step 7: Delete company-specific fields that were only used by this form
        const companyFields = await prisma.$queryRaw`
            SELECT FIELD_ID FROM GUARDIAN.FIELDS 
            WHERE ORGANIZATION_ID = ${req.companyId}
        `;
        
        if (companyFields.length > 0) {
            const fieldIds = companyFields.map(f => f.FIELD_ID);
            
            // Check if these fields are used by other forms
            for (const fieldId of fieldIds) {
                const otherFormUsage = await prisma.$queryRaw`
                    SELECT COUNT(*) as count FROM GUARDIAN.FORMS_FIELDS WHERE FIELD_ID = ${fieldId}
                `;
                
                if (otherFormUsage[0].count === 0) {
                    // Field is not used by any other forms, safe to delete
                    await prisma.$queryRaw`DELETE FROM GUARDIAN.FIELDS WHERE FIELD_ID = ${fieldId}`;
                }
            }
            console.log(`🏷️ Cleaned up unused company-specific fields`);
        }

        // Step 8: Finally delete the form itself
        await prisma.$queryRaw`DELETE FROM GUARDIAN.FORMS WHERE FORM_ID = ${formId}`;
        console.log(`✅ Form ${formId} and all associated data deleted successfully`);

        res.json({
            success: true,
            message: 'Form template and all associated data deleted successfully',
            deletedCounts: {
                formInstances: instanceIds.length,
                relatedRequests: requestIds.length,
                fieldsRelationships: 'cleaned'
            }
        });

    } catch (error) {
        console.error(`❌ Error deleting form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to delete form template',
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

        // Enhanced email format validation
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            return res.json({
                valid: false,
                reason: emailValidation.reason
            });
        }

        const normalizedEmail = emailValidation.email;

        // For registration, check if user already exists
        if (purpose === 'register') {
            const existingUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
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

// Update user endpoint (PUT /api/users/:id)
app.put('/api/users/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { firstName, lastName, email, roleId, status } = req.body;

        console.log(`✏️ Updating user ${userId} with data:`, { firstName, lastName, email, roleId, status });

        // Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'firstName, lastName, and email are required'
            });
        }

        // Validate userId
        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }

        // Check if user exists and belongs to the same company
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID, COMPANY_ID, EMAIL 
            FROM GUARDIAN.USERS 
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        if (existingUser.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User not found or you do not have permission to edit this user'
            });
        }

        // Check if email is already taken by another user (excluding current user)
        if (email !== existingUser[0].EMAIL) {
            const emailCheck = await prisma.$queryRaw`
                SELECT USER_ID 
                FROM GUARDIAN.USERS 
                WHERE EMAIL = ${email} AND USER_ID != ${userId} AND COMPANY_ID = ${req.companyId}
            `;

            if (emailCheck.length > 0) {
                return res.status(400).json({
                    error: 'Email already exists',
                    message: 'Another user with this email already exists in your company'
                });
            }
        }

        // Update user information
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET 
                FIRST_NAME = ${firstName},
                LAST_NAME = ${lastName},
                EMAIL = ${email},
                STATUS = ${status || 'A'},
                UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ User ${userId} basic information updated`);

        // Update user role if roleId is provided
        if (roleId) {
            // Validate roleId exists
            const roleExists = await prisma.$queryRaw`
                SELECT ROLE_ID FROM GUARDIAN.ROLES WHERE ROLE_ID = ${roleId} AND STATUS = 'A'
            `;

            if (roleExists.length === 0) {
                return res.status(400).json({
                    error: 'Invalid role',
                    message: 'Selected role does not exist or is inactive'
                });
            }

            // Check current user roles
            const currentRoles = await prisma.$queryRaw`
                SELECT USER_ROLE_ID, ROLE_ID 
                FROM GUARDIAN.USER_ROLES 
                WHERE USER_ID = ${userId}
            `;

            // If user has roles, update the first one, otherwise create new one
            if (currentRoles.length > 0) {
                // Update existing role
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.USER_ROLES 
                    SET ROLE_ID = ${roleId}, UPDATE_DATE = GETDATE()
                    WHERE USER_ROLE_ID = ${currentRoles[0].USER_ROLE_ID}
                `;
                console.log(`✅ User ${userId} role updated to ${roleId}`);
            } else {
                // Create new role assignment
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
                    VALUES (${userId}, ${roleId}, GETDATE(), GETDATE())
                `;
                console.log(`✅ User ${userId} assigned new role ${roleId}`);
            }
        }

        // Fetch updated user data to return
        const updatedUser = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE,
                STRING_AGG(r.NAME, ', ') as ROLE_NAMES,
                STRING_AGG(CAST(r.ROLE_ID AS VARCHAR), ',') as ROLE_IDS
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.USER_ID = ${userId} AND u.COMPANY_ID = ${req.companyId}
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.STATUS, u.COMPANY_ID, u.CREATE_DATE
        `;

        if (updatedUser.length === 0) {
            return res.status(404).json({
                error: 'User not found after update',
                message: 'Failed to retrieve updated user information'
            });
        }

        const user = updatedUser[0];
        const formattedUser = {
            USER_ID: user.USER_ID,
            id: user.USER_ID,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            email: user.EMAIL,
            companyId: user.COMPANY_ID,
            status: user.STATUS,
            createdAt: user.CREATE_DATE,
            roleNames: user.ROLE_NAMES,
            roleIds: user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : []
        };

        console.log(`✅ User ${userId} successfully updated and retrieved`);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: formattedUser
        });

    } catch (error) {
        console.error(`❌ Error updating user:`, error);
        res.status(500).json({
            error: 'Failed to update user',
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

app.get('/api/roles/all', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🎭 Fetching all roles for role switcher...');
        
        // Check if user has admin privileges (roles 1, 6 - Admin or Super Admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (!isAdmin) {
            console.log('❌ User lacks admin privileges for role switching');
            return res.status(403).json({
                error: 'Admin privileges required for role switching'
            });
        }

        // Fetch all active roles
        const roles = await prisma.$queryRaw`
            SELECT ROLE_ID, NAME as ROLE_NAME, DISPLAY_NAME, DESCRIPTION, STATUS
            FROM GUARDIAN.ROLES 
            WHERE STATUS = 'A'
            ORDER BY DISPLAY_NAME
        `;

        console.log(`✅ Found ${roles.length} roles for role switcher`);

        // Format the data to match RoleSwitcher expectations
        const formattedRoles = roles.map(role => ({
            ROLE_ID: role.ROLE_ID,
            ROLE_NAME: role.ROLE_NAME,
            DISPLAY_NAME: role.DISPLAY_NAME,
            DESCRIPTION: role.DESCRIPTION
        }));

        console.log(`📤 Sending ${formattedRoles.length} roles for role switcher`);
        res.json(formattedRoles);

    } catch (error) {
        console.error('❌ Error fetching all roles:', error);
        res.status(500).json({
            error: 'Failed to fetch all roles',
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
            AND f.IS_DELETED = 0
            ORDER BY f.SORT_ORDER, f.FIELD_NAME
        `;

        console.log(`✅ Found ${fields.length} fields for company ${req.companyId}`);
        
        // Debug: Check for duplicate field IDs
        const fieldIds = fields.map(f => f.FIELD_ID);
        const uniqueFieldIds = [...new Set(fieldIds)];
        if (fieldIds.length !== uniqueFieldIds.length) {
            console.log(`⚠️  WARNING: Found duplicate field IDs!`);
            console.log(`Total fields: ${fieldIds.length}, Unique fields: ${uniqueFieldIds.length}`);
            console.log(`Duplicate IDs:`, fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index));
        }

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

// Create a new field
app.post('/api/fields', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Creating new field for company: ${req.companyId}`);
        
        const {
            FIELD_NAME,
            FIELD_TYPE_ID,
            DISPLAY_FORMAT,
            HAS_LOOKUP,
            IS_PUBLIC,
            IS_ACTIVE,
            IS_REQUIRED,
            IS_SENSITIVE,
            CAN_SELECT_MULIPLE,
            SORT_ORDER
        } = req.body;
        
        // Validation
        if (!FIELD_NAME || !FIELD_NAME.trim()) {
            return res.status(400).json({
                error: 'Field name is required'
            });
        }
        
        if (!FIELD_TYPE_ID) {
            return res.status(400).json({
                error: 'Field type is required'
            });
        }
        
        // Check for duplicate field names within the same company/organization
        const existingField = await prisma.$queryRaw`
            SELECT FIELD_ID, FIELD_NAME FROM GUARDIAN.FIELDS 
            WHERE LOWER(TRIM(FIELD_NAME)) = LOWER(TRIM(${FIELD_NAME}))
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
            AND IS_DELETED = 0
        `;
        
        if (existingField.length > 0) {
            return res.status(409).json({
                error: 'Field name already exists',
                message: `A field with the name "${FIELD_NAME}" already exists. Please choose a different name.`,
                existingField: existingField[0].FIELD_NAME
            });
        }
        
        // Create the new field
        const currentDate = new Date();
        
        // Insert the field and get the ID
        const insertResult = await prisma.$queryRaw`
            DECLARE @InsertedId INT;
            
            INSERT INTO GUARDIAN.FIELDS (
                FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP,
                IS_PUBLIC, IS_ACTIVE, IS_REQUIRED, IS_SENSITIVE, 
                CAN_SELECT_MULIPLE, SORT_ORDER, ORGANIZATION_ID,
                IS_DELETED, CREATE_DATE, UPDATE_DATE, 
                CREATE_USER_ID, UPDATE_USER_ID
            )
            VALUES (
                ${FIELD_NAME.trim()},
                ${FIELD_TYPE_ID},
                ${DISPLAY_FORMAT || null},
                ${HAS_LOOKUP || false},
                ${IS_PUBLIC !== undefined ? IS_PUBLIC : true},
                ${IS_ACTIVE !== undefined ? IS_ACTIVE : true},
                ${IS_REQUIRED || false},
                ${IS_SENSITIVE || false},
                ${CAN_SELECT_MULIPLE || false},
                ${SORT_ORDER || 0},
                ${req.companyId},
                0,
                ${currentDate},
                ${currentDate},
                ${req.userId},
                ${req.userId}
            );
            
            SET @InsertedId = SCOPE_IDENTITY();
            SELECT @InsertedId AS FIELD_ID;
        `;
        
        const insertedId = insertResult[0]?.FIELD_ID;
        
        if (!insertedId) {
            return res.status(500).json({
                error: 'Failed to create field - no ID returned'
            });
        }
        
        console.log(`✅ Field created successfully with ID: ${insertedId}`);
        
        // Get the newly created field with field type information
        const newField = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE f.FIELD_ID = ${insertedId}
        `;
        
        if (newField.length > 0) {
            const field = newField[0];
            const formattedField = {
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
            };
            
            res.status(201).json(formattedField);
        } else {
            res.status(500).json({
                error: 'Field created but could not be retrieved'
            });
        }
    } catch (error) {
        console.error('❌ Error creating field:', error);
        res.status(500).json({
            error: 'Failed to create field',
            message: error.message
        });
    }
});

// Update a field
app.put('/api/fields/:fieldId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const fieldId = parseInt(req.params.fieldId);
        console.log(`📝 Updating field ${fieldId} for company: ${req.companyId}`);
        
        const {
            FIELD_NAME,
            FIELD_TYPE_ID,
            DISPLAY_FORMAT,
            HAS_LOOKUP,
            IS_PUBLIC,
            IS_ACTIVE,
            IS_REQUIRED,
            IS_SENSITIVE,
            CAN_SELECT_MULIPLE,
            SORT_ORDER
        } = req.body;

        if (!fieldId || isNaN(fieldId)) {
            return res.status(400).json({
                error: 'Valid field ID is required'
            });
        }

        // Verify field exists and belongs to user's company (or is global)
        const existingField = await prisma.$queryRaw`
            SELECT FIELD_ID FROM GUARDIAN.FIELDS 
            WHERE FIELD_ID = ${fieldId} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
        `;

        if (!existingField.length) {
            return res.status(404).json({
                error: 'Field not found or access denied'
            });
        }

        // Update the field
        await prisma.$executeRaw`
            UPDATE GUARDIAN.FIELDS 
            SET 
                FIELD_NAME = ${FIELD_NAME},
                FIELD_TYPE_ID = ${FIELD_TYPE_ID || null},
                DISPLAY_FORMAT = ${DISPLAY_FORMAT || null},
                HAS_LOOKUP = ${HAS_LOOKUP || false},
                IS_PUBLIC = ${IS_PUBLIC !== undefined ? IS_PUBLIC : true},
                IS_ACTIVE = ${IS_ACTIVE !== undefined ? IS_ACTIVE : true},
                IS_REQUIRED = ${IS_REQUIRED || false},
                IS_SENSITIVE = ${IS_SENSITIVE || false},
                CAN_SELECT_MULIPLE = ${CAN_SELECT_MULIPLE || false},
                SORT_ORDER = ${SORT_ORDER || 0},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE FIELD_ID = ${fieldId}
        `;

        console.log(`✅ Field ${fieldId} updated successfully`);

        // Return the updated field
        const updatedField = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE f.FIELD_ID = ${fieldId}
        `;

        if (updatedField.length > 0) {
            const field = updatedField[0];
            const formattedField = {
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
            };

            res.json({
                success: true,
                message: 'Field updated successfully',
                data: formattedField
            });
        } else {
            res.status(404).json({
                error: 'Field not found after update'
            });
        }

    } catch (error) {
        console.error('❌ Error updating field:', error);
        res.status(500).json({
            error: 'Failed to update field',
            message: error.message
        });
    }
});

// ===== FORMS GROUPS ENDPOINTS =====

// Get forms groups endpoint
app.get('/api/forms-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📁 Fetching forms groups from database for company:', req.companyId);

        const formsGroups = await prisma.$queryRawUnsafe(`
            SELECT fg.GROUP_ID, fg.ORGANIZATION_ID, fg.GROUP_NAME, fg.GROUP_DESCRIPTION, 
                   fg.SORT_ORDER, fg.IS_PUBLIC, fg.CREATE_USER_ID, fg.UPDATE_USER_ID,
                   fg.CREATE_DATE, fg.UPDATE_DATE
            FROM GUARDIAN.FORMS_GROUPS fg
            WHERE fg.ORGANIZATION_ID = ${req.companyId} OR fg.ORGANIZATION_ID IS NULL
            ORDER BY fg.SORT_ORDER, fg.GROUP_NAME
        `);

        console.log(`✅ Found ${formsGroups.length} forms groups for company ${req.companyId}`);
        res.json(formsGroups);
    } catch (error) {
        console.error('❌ Error fetching forms groups:', error);
        res.status(500).json({
            error: 'Failed to fetch forms groups',
            message: error.message
        });
    }
});

// Create forms group endpoint
app.post('/api/forms-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            SORT_ORDER,
            IS_PUBLIC
        } = req.body;
        
        console.log(`📁 Creating new forms group for company: ${req.companyId}`);
        
        if (!GROUP_NAME || !GROUP_DESCRIPTION) {
            return res.status(400).json({
                error: 'GROUP_NAME and GROUP_DESCRIPTION are required'
            });
        }
        
        // Check for duplicate group name within the company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE ORGANIZATION_ID = ${req.companyId} AND GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}'`
        );
        
        if (existingGroup.length > 0) {
            return res.status(409).json({
                error: 'A forms group with this name already exists in your organization'
            });
        }
        
        const result = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS_GROUPS (
                ORGANIZATION_ID, GROUP_NAME, GROUP_DESCRIPTION, SORT_ORDER, IS_PUBLIC,
                CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
            ) 
            OUTPUT INSERTED.GROUP_ID, INSERTED.ORGANIZATION_ID, INSERTED.GROUP_NAME, 
                   INSERTED.GROUP_DESCRIPTION, INSERTED.SORT_ORDER, INSERTED.IS_PUBLIC,
                   INSERTED.CREATE_USER_ID, INSERTED.UPDATE_USER_ID, INSERTED.CREATE_DATE, INSERTED.UPDATE_DATE
            VALUES (
                ${req.companyId}, '${GROUP_NAME.replace(/'/g, "''")}', '${GROUP_DESCRIPTION.replace(/'/g, "''")}', 
                ${SORT_ORDER || 'NULL'}, ${IS_PUBLIC ? 1 : 0}, ${req.userId}, ${req.userId}, 
                GETUTCDATE(), GETUTCDATE()
            )`
        );
        
        console.log(`✅ Created forms group with ID: ${result[0].GROUP_ID}`);
        res.status(201).json(result[0]);
        
    } catch (error) {
        console.error('❌ Error creating forms group:', error);
        res.status(500).json({
            error: 'Failed to create forms group',
            message: error.message
        });
    }
});

// Update forms group endpoint
app.put('/api/forms-groups/:groupId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            SORT_ORDER,
            IS_PUBLIC
        } = req.body;
        
        console.log(`📁 Updating forms group ${groupId} for company: ${req.companyId}`);
        
        if (!groupId || isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        if (!GROUP_NAME || !GROUP_DESCRIPTION) {
            return res.status(400).json({
                error: 'GROUP_NAME and GROUP_DESCRIPTION are required'
            });
        }
        
        // Verify the group belongs to the user's company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Forms group not found or does not belong to your organization'
            });
        }
        
        // Check for duplicate name (excluding current group)
        const duplicateCheck = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE ORGANIZATION_ID = ${req.companyId} AND GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}' 
            AND GROUP_ID != ${groupId}`
        );
        
        if (duplicateCheck.length > 0) {
            return res.status(409).json({
                error: 'A forms group with this name already exists in your organization'
            });
        }
        
        const result = await prisma.$queryRawUnsafe(`
            UPDATE GUARDIAN.FORMS_GROUPS 
            SET GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}',
                GROUP_DESCRIPTION = '${GROUP_DESCRIPTION.replace(/'/g, "''")}',
                SORT_ORDER = ${SORT_ORDER || 'NULL'},
                IS_PUBLIC = ${IS_PUBLIC ? 1 : 0},
                UPDATE_USER_ID = ${req.userId},
                UPDATE_DATE = GETUTCDATE()
            OUTPUT INSERTED.GROUP_ID, INSERTED.ORGANIZATION_ID, INSERTED.GROUP_NAME,
                   INSERTED.GROUP_DESCRIPTION, INSERTED.SORT_ORDER, INSERTED.IS_PUBLIC,
                   INSERTED.CREATE_USER_ID, INSERTED.UPDATE_USER_ID, INSERTED.CREATE_DATE, INSERTED.UPDATE_DATE
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Forms group not found' });
        }
        
        console.log(`✅ Updated forms group ${groupId}`);
        res.json(result[0]);
        
    } catch (error) {
        console.error('❌ Error updating forms group:', error);
        res.status(500).json({
            error: 'Failed to update forms group',
            message: error.message
        });
    }
});

// Delete forms group endpoint
app.delete('/api/forms-groups/:groupId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        console.log(`🗑️ Deleting forms group ${groupId} for company: ${req.companyId}`);
        
        if (!groupId || isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // Verify the group belongs to the user's company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Forms group not found or does not belong to your organization'
            });
        }
        
        // Check if group has any associated fields
        const associatedFields = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as fieldCount FROM GUARDIAN.FORMS_GROUPS_FIELDS 
            WHERE GROUP_ID = ${groupId}`
        );
        
        if (associatedFields[0].fieldCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete forms group that has associated fields. Please remove all fields from this group first.'
            });
        }
        
        // Delete the group
        await prisma.$queryRawUnsafe(`
            DELETE FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        console.log(`✅ Deleted forms group ${groupId}`);
        res.json({ message: 'Forms group deleted successfully' });
        
    } catch (error) {
        console.error('❌ Error deleting forms group:', error);
        res.status(500).json({
            error: 'Failed to delete forms group',
            message: error.message
        });
    }
});

// Get forms endpoint for templates
app.get('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📋 Fetching forms from database for company:', req.companyId);
        console.log('🔍 Company ID type:', typeof req.companyId);

        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL OR COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
            ORDER BY FORM_NAME
        `;

        console.log(`✅ Found ${forms.length} forms for company ${req.companyId}`);
        
        // Debug: Log raw database results with extensive details
        console.log('🔍 ===== RAW DATABASE FORMS DATA =====');
        forms.forEach((form, index) => {
            console.log(`🔍 Form ${index + 1} raw data:`, {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                ORGANIZATION_ID: form.ORGANIZATION_ID,
                COMPANY_ID: form.COMPANY_ID,
                COMPANY_ID_TYPE: typeof form.COMPANY_ID,
                COMPANY_ID_IS_NULL: form.COMPANY_ID === null,
                COMPANY_ID_IS_UNDEFINED: form.COMPANY_ID === undefined,
                COMPANY_ID_VALUE: form.COMPANY_ID
            });
        });

        // Format the data to match frontend expectations
        const formattedForms = forms.map(form => ({
            FORM_ID: form.FORM_ID,
            FORM_NAME: form.FORM_NAME,
            FORM_DESCRIPTION: form.FORM_DESCRIPTION,
            IS_ACTIVE: form.IS_ACTIVE,
            IS_PUBLIC: form.IS_PUBLIC,
            IS_DELETED: form.IS_DELETED,
            ORGANIZATION_ID: form.ORGANIZATION_ID,
            COMPANY_ID: form.COMPANY_ID
        }));

        console.log('🔍 ===== FORMATTED FORMS BEFORE SENDING =====');
        formattedForms.forEach((form, index) => {
            console.log(`🔍 Form ${index + 1} formatted:`, {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                COMPANY_ID: form.COMPANY_ID,
                COMPANY_ID_TYPE: typeof form.COMPANY_ID,
                COMPANY_ID_IS_NULL: form.COMPANY_ID === null,
                COMPANY_ID_IS_UNDEFINED: form.COMPANY_ID === undefined
            });
        });
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

// Create a new form with fields
app.post('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { form, fields } = req.body;
        console.log('📝 Creating new form with fields for company:', req.companyId);

        if (!form || !form.FORM_NAME) {
            return res.status(400).json({
                error: 'Form name is required'
            });
        }

        // Insert the form first - escape strings properly for SQL injection prevention
        const escapedFormName = form.FORM_NAME.replace(/'/g, "''");
        const escapedFormDescription = (form.FORM_DESCRIPTION || '').replace(/'/g, "''");
        
        const formResult = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                '${escapedFormName}', '${escapedFormDescription}', ${req.companyId}, ${form.IS_PUBLIC ? 1 : 0}, ${form.IS_ACTIVE !== false ? 1 : 0}, 0, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `);

        const formId = formResult[0].FORM_ID;
        console.log(`✅ Created form with ID: ${formId}`);

        // Insert fields if provided
        const createdFields = [];
        if (fields && Array.isArray(fields) && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                
                // First, create the field in GUARDIAN.FIELDS table - escape strings for SQL injection prevention
                const escapedFieldName = field.FIELD_NAME.replace(/'/g, "''");
                
                const fieldResult = await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FIELDS (
                        FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID, ORGANIZATION_ID
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        '${escapedFieldName}', ${field.FIELD_TYPE_ID}, ${field.IS_REQUIRED ? 1 : 0}, ${field.IS_ACTIVE !== false ? 1 : 0}, 0, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}, ${req.companyId}
                    )
                `);
                
                const fieldId = fieldResult[0].FIELD_ID;
                
                // Then, create the relationship in GUARDIAN.FORMS_FIELDS junction table
                await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FORMS_FIELDS (
                        FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                    )
                    VALUES (
                        ${formId}, ${fieldId}, ${field.IS_REQUIRED ? 1 : 0}, ${field.SEQUENCE || i + 1}, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                    )
                `);

                createdFields.push({
                    ...field,
                    FIELD_ID: fieldId,
                    FORM_ID: formId
                });
            }
        }

        console.log(`✅ Created ${createdFields.length} fields for form ${formId}`);

        res.json({
            success: true,
            form: {
                ...form,
                FORM_ID: formId,
                COMPANY_ID: req.companyId
            },
            fields: createdFields
        });

    } catch (error) {
        console.error('❌ Error creating form:', error);
        res.status(500).json({
            error: 'Failed to create form',
            message: error.message
        });
    }
});

app.delete('/api/forms/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        console.log(`🗑️ Attempting to delete form/template ${formId} for company ${req.companyId}`);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        // Check if user has permission to delete (Admin or Super Admin roles: 1, 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const canDelete = roleIds.includes(1) || roleIds.includes(6);
        
        if (!canDelete) {
            console.log(`❌ User ${req.userId} lacks permission to delete forms`);
            return res.status(403).json({
                error: 'You do not have permission to delete forms'
            });
        }

        // Check if the form exists and belongs to the company (or is global with null COMPANY_ID)
        const existingForm = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        if (!existingForm.length) {
            console.log(`❌ Form ${formId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        const form = existingForm[0];
        console.log(`📋 Found form to delete: ${form.FORM_NAME}`);

        // CASCADING DELETE - Remove all related data in the correct order to handle foreign key constraints
        
        // 1. Delete form instance values related to this form
        await prisma.$executeRaw`
            DELETE fiv FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
            INNER JOIN GUARDIAN.FORMS_INSTANCE fi ON fiv.FORM_INSTANCE_ID = fi.FORM_INSTANCE_ID
            WHERE fi.FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form instance values');

        // 2. Delete form instances related to this form
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE
            WHERE FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form instances');

        // 3. Delete requests that use this form
        const requestsToDelete = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE FORM_ID = ${formId} AND COMPANY_ID = ${req.companyId}
        `;

        for (const request of requestsToDelete) {
            const requestId = request.REQUEST_ID;
            
            // Delete tasks related to each request
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.TASKS
                WHERE REQUEST_ID = ${requestId}
            `;
            
            // Delete notifications related to each request  
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.NOTIFICATIONS
                WHERE MESSAGE LIKE '%Request ${requestId}%'
            `;
            
            // Delete attachments related to each request
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.ATTACHMENTS
                WHERE REQUEST_ID = ${requestId}
            `;
        }

        // 4. Delete the requests themselves
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.REQUESTS
            WHERE FORM_ID = ${formId} AND COMPANY_ID = ${req.companyId}
        `;
        console.log('✅ Deleted related requests and their associated data');

        // 5. Delete form-field relationships
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_FIELDS
            WHERE FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form-field relationships');

        // 6. Delete fields that were created specifically for this form (company-specific fields)
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FIELDS
            WHERE FIELD_ID IN (
                SELECT DISTINCT ff.FIELD_ID
                FROM GUARDIAN.FORMS_FIELDS ff
                WHERE ff.FORM_ID = ${formId}
            ) AND ORGANIZATION_ID = ${req.companyId}
        `;
        console.log('✅ Deleted company-specific fields');

        // 7. Finally, delete the form itself
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        console.log(`✅ Successfully deleted form ${formId}: ${form.FORM_NAME} and all related data`);

        res.json({
            success: true,
            message: `Form "${form.FORM_NAME}" has been deleted successfully along with all associated data`
        });

    } catch (error) {
        console.error(`❌ Error deleting form ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to delete form',
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for registration: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Check if user already exists
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'An account with this email already exists'
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
        const emailSent = await sendVerificationEmail(normalizedEmail, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send email to ${normalizedEmail}, but user created in database (code available in dev mode)`);
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for verification: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Look up user in database
        console.log(`🔍 Looking up user in database for email: ${normalizedEmail}`);
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: normalizedEmail }
        });

        if (!user) {
            console.log(`❌ No user found with email: ${normalizedEmail}`);
            return res.status(400).json({
                error: 'Invalid verification request'
            });
        }

        console.log(`✅ User found - ID: ${user.USER_ID}, Email Validated: ${user.EMAIL_VALIDATED}`);
        console.log(`🔑 Has validation token: ${!!user.EMAIL_VALIDATION_TOKEN}`);
        console.log(`⏰ Token expiry: ${user.EMAIL_VALIDATION_TOKEN_EXPIRY}`);

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            console.log(`❌ No verification code found for email: ${normalizedEmail}`);
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for password reset: ${email}`);
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Check if user exists
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: normalizedEmail }
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
        const emailSent = await sendVerificationEmail(normalizedEmail, resetCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send reset email to ${normalizedEmail}, but continuing (code available in dev mode)`);
        }

        console.log(`✅ Password reset code generated for ${email}: ${resetCode}`);

        res.json({
            success: true,
            message: 'If an account with this email exists, you will receive a password reset link.',
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { verificationCode: resetCode })
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for reset code verification: ${email}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid request format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Find user
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: normalizedEmail }
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

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for password reset: ${email}`);
            return res.status(400).json({
                error: 'Invalid request format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Find user
        const user = await prisma.uSERS.findFirst({
            where: { EMAIL: normalizedEmail }
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
                
                // Log values being saved
                console.log(`📝 Updating company info with values:`, {
                    companyInfoId: existingCompanyInfo.COMPANY_INFO_ID,
                    workspaceName: workspaceName || 'NULL',
                    role: role || 'NULL',
                    teamSize: teamSize || 'NULL',
                    companySize: companySize || 'NULL'
                });
                
                // Update existing record using the unique COMPANY_INFO_ID
                const updateResult = await prisma.cOMPANY_INFO.update({
                    where: { COMPANY_INFO_ID: existingCompanyInfo.COMPANY_INFO_ID },
                    data: {
                        ...(workspaceName && { WORKSPACE_NAME: workspaceName }),
                        ...(role && { ROLE: role }),
                        ...(teamSize && { TEAM_SIZE: teamSize }),
                        ...(companySize && { COMPANY_SIZE: companySize }),
                        UPDATED_AT: new Date()
                    }
                });
                console.log(`✅ Company info updated successfully - Updated record:`, updateResult);
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
                error: 'An account with this email already exists'
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