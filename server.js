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

        // Get user roles for admin permissions
        const users = await prisma.$queryRaw`
            SELECT STRING_AGG(ur.ROLE_ID, ',') as ROLE_IDS
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${decoded.userId} AND ur.STATUS = 'P'
        `;
        
        req.user = decoded;
        req.userId = decoded.userId;
        req.companyId = decoded.companyId;
        req.userRoleIds = users.length > 0 && users[0].ROLE_IDS ? 
            users[0].ROLE_IDS.split(',').map(id => parseInt(id)) : [];
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
            '/api/validate-email', '/api/send-verification-email', 
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

// User logout endpoint
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

// Create new request
app.post('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Creating new request for company: ${req.companyId}`, req.body);
        
        // Extract fields from request body (support multiple formats)
        const {
            REQUEST_NAME,
            name,
            requestName,
            REQUEST_DESCRIPTION,
            description,
            ABBREVIATION,
            abbreviation,
            templateType,
            templateId,
            companyId,
            userId,
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

        // Generate tracking ID
        const year = new Date().getFullYear();
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        const trackingId = `REQ-${year}-${randomNum}`;

        // Create the request with company-based data isolation
        const currentDate = new Date();
        const newRequest = await prisma.rEQUESTS.create({
            data: {
                REQUEST_NAME: finalRequestName.trim(),
                REQUEST_DESCRIPTION: finalDescription.trim() || null,
                ABBREVIATION: finalAbbreviation,
                STATUS: finalStatus,
                SUBMITTED_DATE: currentDate,
                REQUESTOR_ID: req.userId, // From JWT token
                ASSIGNED_ID: finalAssignedId,
                CREATE_DATE: currentDate,
                UPDATE_DATE: currentDate,
                CREATE_USER_ID: req.userId, // From JWT token
                UPDATE_USER_ID: req.userId, // From JWT token
                TRACKINGID: trackingId,
                COMPANY_ID: req.companyId, // Company-based data isolation
                EXTERNAL_USER: null, // Internal user request
                FORM_ID: templateId || null
            }
        });

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
                CREATE_DATE: newRequest.CREATE_DATE,
                UPDATE_DATE: newRequest.UPDATE_DATE,
                CREATE_USER_ID: newRequest.CREATE_USER_ID,
                UPDATE_USER_ID: newRequest.UPDATE_USER_ID,
                TRACKINGID: newRequest.TRACKINGID,
                COMPANY_ID: newRequest.COMPANY_ID,
                EXTERNAL_USER: newRequest.EXTERNAL_USER,
                FORM_ID: newRequest.FORM_ID
            }
        });

    } catch (error) {
        console.error(`❌ Error creating request:`, error);
        
        // Handle specific database errors
        if (error.code === 'P2002') {
            return res.status(409).json({
                error: 'Duplicate request',
                message: 'A request with this information already exists',
                details: error.message
            });
        }
        
        if (error.code === 'P2003') {
            return res.status(400).json({
                error: 'Invalid reference',
                message: 'Referenced user, form, or company does not exist',
                details: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to create request',
            message: 'An internal server error occurred while creating the request',
            details: error.message,
            timestamp: new Date().toISOString()
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

// Get users by specific company ID
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

                console.log(`✅ Invite created for ${email} with role ${roleId}`);
                
                // Send actual invite email using Resend
                const emailSent = await sendInviteEmail(email, token, 'User'); // TODO: Get actual role name from roleId
                const status = emailSent ? 'sent' : 'created'; // Mark as 'created' if email failed but record exists

                results.push({
                    email: email,
                    roleId: roleId,
                    token: token,
                    status: status
                });

                console.log(`✅ Invite ${status} to ${email} for role ${roleId}`);

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

// Accept invitation endpoint
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

// Send invites endpoint (alternative endpoint)
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

        // Insert the form first
        const formResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                ${form.FORM_NAME}, 
                ${form.FORM_DESCRIPTION || ''}, 
                ${req.companyId}, 
                ${form.IS_PUBLIC || false}, 
                ${form.IS_ACTIVE !== false}, 
                ${false},
                GETDATE(), 
                GETDATE(), 
                ${req.user.userId}, 
                ${req.user.userId}
            )
        `;

        const formId = formResult[0].FORM_ID;
        console.log(`✅ Created form with ID: ${formId}`);

        // Insert fields if provided
        const createdFields = [];
        if (fields && Array.isArray(fields) && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                
                const fieldResult = await prisma.$queryRaw`
                    INSERT INTO GUARDIAN.FORM_FIELDS (
                        FORM_ID, FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, OPTIONS, SEQUENCE,
                        IS_ACTIVE, IS_DELETED, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        ${formId},
                        ${field.FIELD_NAME},
                        ${field.FIELD_TYPE_ID},
                        ${field.IS_REQUIRED || false},
                        ${field.OPTIONS || null},
                        ${field.SEQUENCE || i + 1},
                        ${field.IS_ACTIVE !== false},
                        ${false},
                        GETDATE(),
                        GETDATE(),
                        ${req.user.userId},
                        ${req.user.userId}
                    )
                `;

                createdFields.push({
                    ...field,
                    FIELD_ID: fieldResult[0].FIELD_ID,
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
                ORGANIZATION_ID: req.companyId
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

// Update an existing form with fields
app.put('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        const { form, fields } = req.body;
        console.log(`📝 Updating form ${formId} with fields for company:`, req.companyId);

        if (!form || !form.FORM_NAME) {
            return res.status(400).json({
                error: 'Form name is required'
            });
        }

        // Verify form belongs to the user's company
        const existingForm = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} AND ORGANIZATION_ID = ${req.companyId}
        `;

        if (existingForm.length === 0) {
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        // Update the form
        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORMS 
            SET 
                FORM_NAME = ${form.FORM_NAME},
                FORM_DESCRIPTION = ${form.FORM_DESCRIPTION || ''},
                IS_PUBLIC = ${form.IS_PUBLIC || false},
                IS_ACTIVE = ${form.IS_ACTIVE !== false},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.user.userId}
            WHERE FORM_ID = ${formId}
        `;

        console.log(`✅ Updated form ${formId}`);

        // Handle fields if provided
        const updatedFields = [];
        if (fields && Array.isArray(fields)) {
            // First, mark all existing fields as deleted
            await prisma.$queryRaw`
                UPDATE GUARDIAN.FORM_FIELDS 
                SET IS_DELETED = ${true}, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.user.userId}
                WHERE FORM_ID = ${formId}
            `;

            // Then insert/update the new fields
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                
                if (field.FIELD_ID) {
                    // Update existing field
                    await prisma.$queryRaw`
                        UPDATE GUARDIAN.FORM_FIELDS 
                        SET 
                            FIELD_NAME = ${field.FIELD_NAME},
                            FIELD_TYPE_ID = ${field.FIELD_TYPE_ID},
                            IS_REQUIRED = ${field.IS_REQUIRED || false},
                            OPTIONS = ${field.OPTIONS || null},
                            SEQUENCE = ${field.SEQUENCE || i + 1},
                            IS_ACTIVE = ${field.IS_ACTIVE !== false},
                            IS_DELETED = ${false},
                            UPDATE_DATE = GETDATE(),
                            UPDATE_USER_ID = ${req.user.userId}
                        WHERE FIELD_ID = ${field.FIELD_ID} AND FORM_ID = ${formId}
                    `;

                    updatedFields.push({
                        ...field,
                        FORM_ID: formId
                    });
                } else {
                    // Insert new field
                    const fieldResult = await prisma.$queryRaw`
                        INSERT INTO GUARDIAN.FORM_FIELDS (
                            FORM_ID, FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, OPTIONS, SEQUENCE,
                            IS_ACTIVE, IS_DELETED, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                        )
                        OUTPUT INSERTED.FIELD_ID
                        VALUES (
                            ${formId},
                            ${field.FIELD_NAME},
                            ${field.FIELD_TYPE_ID},
                            ${field.IS_REQUIRED || false},
                            ${field.OPTIONS || null},
                            ${field.SEQUENCE || i + 1},
                            ${field.IS_ACTIVE !== false},
                            ${false},
                            GETDATE(),
                            GETDATE(),
                            ${req.user.userId},
                            ${req.user.userId}
                        )
                    `;

                    updatedFields.push({
                        ...field,
                        FIELD_ID: fieldResult[0].FIELD_ID,
                        FORM_ID: formId
                    });
                }
            }
        }

        console.log(`✅ Updated ${updatedFields.length} fields for form ${formId}`);

        res.json({
            success: true,
            form: {
                ...form,
                FORM_ID: formId,
                ORGANIZATION_ID: req.companyId
            },
            fields: updatedFields
        });

    } catch (error) {
        console.error(`❌ Error updating form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to update form',
            message: error.message
        });
    }
});

// Get a specific form by ID with its fields
app.get('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        console.log(`📋 Fetching form ${formId} for company:`, req.companyId);

        // Get the form
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} AND ORGANIZATION_ID = ${req.companyId} AND IS_DELETED = ${false}
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

// Delete a form (soft delete)
app.delete('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        console.log(`🗑️ Deleting form ${formId} for company:`, req.companyId);

        // Verify form belongs to the user's company
        const existingForm = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} AND ORGANIZATION_ID = ${req.companyId}
        `;

        if (existingForm.length === 0) {
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        // Soft delete the form and its fields
        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORMS 
            SET IS_DELETED = ${true}, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.user.userId}
            WHERE FORM_ID = ${formId}
        `;

        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORM_FIELDS 
            SET IS_DELETED = ${true}, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.user.userId}
            WHERE FORM_ID = ${formId}
        `;

        console.log(`✅ Deleted form ${formId} and its fields`);

        res.json({
            success: true,
            message: 'Form deleted successfully'
        });

    } catch (error) {
        console.error(`❌ Error deleting form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to delete form',
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
        
        // Find existing company or create new one
        let companies = await prisma.$queryRaw`
            SELECT COMPANY_ID, NAME FROM GUARDIAN.COMPANY 
            WHERE NAME = ${companyNameToUse}
        `;
        
        let companyId;
        if (companies.length > 0) {
            companyId = companies[0].COMPANY_ID;
            console.log(`✅ Found existing company: ${companyNameToUse} (ID: ${companyId})`);
        } else {
            // Create new company
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.COMPANY (NAME, CREATED_AT, UPDATED_AT)
                VALUES (${companyNameToUse}, GETDATE(), GETDATE())
            `;
            
            // Get the newly created company ID
            const newCompanies = await prisma.$queryRaw`
                SELECT COMPANY_ID FROM GUARDIAN.COMPANY 
                WHERE NAME = ${companyNameToUse}
            `;
            companyId = newCompanies[0].COMPANY_ID;
            console.log(`✅ Created new company: ${companyNameToUse} (ID: ${companyId})`);
        }
        
        // Create user in database
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                FIRST_NAME, LAST_NAME, EMAIL, PASSWORD_HASH, CREATE_DATE, UPDATE_DATE, 
                STATUS, EMAIL_VALIDATED, EMAIL_VALIDATION_TOKEN, EMAIL_VALIDATION_TOKEN_EXPIRY, COMPANY_ID
            ) VALUES (
                ${firstName}, ${lastName}, ${email}, ${passwordHash}, GETDATE(), GETDATE(),
                'P', ${false}, ${hashedCode}, ${tokenExpiry}, ${companyId}
            )
        `;
        
        // Get the newly created user ID
        const users = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;
        const userId = users[0].USER_ID;
        console.log(`✅ User created with ID: ${userId}`);
        
        // Create company_info entry
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.COMPANY_INFO (USER_ID, COMPANY_ID, CREATED_AT, UPDATED_AT)
            VALUES (${userId}, ${companyId}, GETDATE(), GETDATE())
        `;
        
        // Find Admin role or create it
        let adminRoles = await prisma.$queryRaw`
            SELECT ROLE_ID FROM GUARDIAN.ROLES 
            WHERE NAME = 'Admin'
        `;
        
        let adminRoleId;
        if (adminRoles.length > 0) {
            adminRoleId = adminRoles[0].ROLE_ID;
            console.log(`✅ Found existing Admin role (ID: ${adminRoleId})`);
        } else {
            // Create Admin role
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.ROLES (NAME, DISPLAY_NAME, DESCRIPTION, STATUS, CREATE_DATE, UPDATE_DATE)
                VALUES ('Admin', 'Administrator', 'Default admin role', 'A', GETDATE(), GETDATE())
            `;
            
            // Get the newly created role ID
            const newAdminRoles = await prisma.$queryRaw`
                SELECT ROLE_ID FROM GUARDIAN.ROLES 
                WHERE NAME = 'Admin'
            `;
            adminRoleId = newAdminRoles[0].ROLE_ID;
            console.log(`✅ Created new Admin role (ID: ${adminRoleId})`);
        }
        
        // Assign Admin role to user
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${userId}, ${adminRoleId}, GETDATE(), GETDATE())
        `;
        
        console.log(`✅ User created in database with ID: ${userId}, verification code: ${verificationCode}`);
        
        // For production, also store the code in memory temporarily for backward compatibility
        global.verificationCodes = global.verificationCodes || {};
        global.verificationCodes[email] = {
            code: verificationCode,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
            verified: false
        };

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

        // Mark as verified in memory
        storedData.verified = true;
        
        // Update database to mark email as validated
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET EMAIL_VALIDATED = 1 
            WHERE EMAIL = ${email}
        `;
        
        console.log(`✅ Database updated: EMAIL_VALIDATED set to 1 for ${email}`);
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

        // Check if email was verified (memory-based for production)
        global.verificationCodes = global.verificationCodes || {};
        const storedData = global.verificationCodes[email];

        if (!storedData || !storedData.verified) {
            return res.status(400).json({
                error: 'Email must be verified before completing registration'
            });
        }

        // Check if user exists in database
        console.log(`🔍 Looking up user in database for complete-registration: ${email}`);
        let existingUser;
        try {
            const users = await prisma.$queryRaw`
                SELECT USER_ID, EMAIL, PASSWORD_HASH, EMAIL_VALIDATED, COMPANY_ID
                FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
            `;
            existingUser = users.length > 0 ? users[0] : null;
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
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET PASSWORD_HASH = ${hashedPassword}, 
                FIRST_NAME = ${firstName}, 
                LAST_NAME = ${lastName}, 
                STATUS = 'A', 
                UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${existingUser.USER_ID}
        `;
        console.log(`✅ User updated successfully in database`);

        const userId = existingUser.USER_ID;

        // Check if user already has roles, if not assign Admin role
        const existingRoles = await prisma.$queryRaw`
            SELECT USER_ROLE_ID FROM GUARDIAN.USER_ROLES 
            WHERE USER_ID = ${userId}
        `;

        if (existingRoles.length === 0) {
            // Assign Admin role if no roles exist
            const adminRoles = await prisma.$queryRaw`
                SELECT ROLE_ID FROM GUARDIAN.ROLES 
                WHERE NAME = 'Admin'
            `;
            
            if (adminRoles.length > 0) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
                    VALUES (${userId}, ${adminRoles[0].ROLE_ID}, GETDATE(), GETDATE())
                `;
                console.log(`✅ Admin role assigned to user ${userId}`);
            }
        }

        // Update company info if provided
        console.log(`📝 Updating company info for user ${userId}`);
        if (role || teamSize || companySize || workspaceName) {
            const existingCompanyInfo = await prisma.$queryRaw`
                SELECT COMPANY_INFO_ID FROM GUARDIAN.COMPANY_INFO 
                WHERE USER_ID = ${userId}
            `;

            if (existingCompanyInfo.length > 0) {
                console.log(`✅ Found existing company info record with ID: ${existingCompanyInfo[0].COMPANY_INFO_ID}`);
                // Update existing record using the unique COMPANY_INFO_ID - single efficient query
                const companyInfoId = existingCompanyInfo[0].COMPANY_INFO_ID;
                
                // Log values being saved
                console.log(`📝 Updating company info with values:`, {
                    companyInfoId,
                    workspaceName: workspaceName || 'NULL',
                    role: role || 'NULL',
                    teamSize: teamSize || 'NULL',
                    companySize: companySize || 'NULL'
                });
                
                // Single UPDATE query for all fields
                const updateResult = await prisma.$executeRaw`
                    UPDATE GUARDIAN.COMPANY_INFO 
                    SET WORKSPACE_NAME = ${workspaceName || null}, 
                        ROLE = ${role || null}, 
                        TEAM_SIZE = ${teamSize || null}, 
                        COMPANY_SIZE = ${companySize || null}, 
                        UPDATED_AT = GETDATE()
                    WHERE COMPANY_INFO_ID = ${companyInfoId}
                `;
                
                console.log(`✅ Company info updated successfully - Rows affected: ${updateResult}`);
            } else {
                console.log(`❌ No existing company info found for user ${userId}`);
            }
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
        const users = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
        `;

        if (users.length === 0) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset code.'
            });
        }

        const user = users[0];

        // Generate a 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // For production, store the code in memory temporarily
        global.resetCodes = global.resetCodes || {};
        global.resetCodes[email] = {
            code: resetCode,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
            userId: user.USER_ID
        };

        // Send reset email
        const emailSent = await sendVerificationEmail(email, resetCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send reset email to ${email}, but continuing (code available in dev mode)`);
        }

        console.log(`✅ Password reset code generated for ${email}: ${resetCode}`);

        res.json({
            success: true,
            message: 'If an account with this email exists, you will receive a password reset code.',
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
        global.resetCodes = global.resetCodes || {};
        const storedData = global.resetCodes[email];

        if (!storedData) {
            return res.status(400).json({
                success: false,
                error: 'No active password reset request found'
            });
        }

        if (new Date() > storedData.expiresAt) {
            delete global.resetCodes[email];
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
        global.resetCodes = global.resetCodes || {};
        const storedData = global.resetCodes[email];

        if (!storedData) {
            return res.status(400).json({
                error: 'No active password reset request found'
            });
        }

        if (new Date() > storedData.expiresAt) {
            delete global.resetCodes[email];
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

        // Update password in database
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET PASSWORD_HASH = ${hashedPassword}, UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${storedData.userId}
        `;

        // Clear reset code
        delete global.resetCodes[email];

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
        if (isAdmin) {
            // Admin users can see all form instances for this form
            existingInstances = await prisma.$queryRaw`
                SELECT FORM_INSTANCE_ID, SUBMITTED_DATE, CREATE_DATE, UPDATE_DATE, ASSIGNED_ID
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE FORM_ID = ${request.FORM_ID}
                ORDER BY CREATE_DATE DESC
            `;
            console.log(`👑 Admin user - fetching all form instances for form ${request.FORM_ID}`);
        } else {
            // Regular users only see their own assigned instances
            existingInstances = await prisma.$queryRaw`
                SELECT FORM_INSTANCE_ID, SUBMITTED_DATE, CREATE_DATE, UPDATE_DATE, ASSIGNED_ID
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE FORM_ID = ${request.FORM_ID} AND ASSIGNED_ID = ${request.ASSIGNED_ID}
                ORDER BY CREATE_DATE DESC
            `;
            console.log(`👤 Regular user - fetching instances assigned to user ${request.ASSIGNED_ID}`);
        }

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
            
            // Convert to object with field IDs as keys
            existingValues = savedValues.reduce((acc, value) => {
                acc[value.FIELD_ID] = value.VALUE;
                return acc;
            }, {});
            
            console.log(`📊 Found ${savedValues.length} existing field values`);
            
            // Determine form completion status
            const requiredFields = fields.filter(f => f.FORM_IS_REQUIRED || f.IS_REQUIRED);
            const filledRequiredFields = requiredFields.filter(f => 
                existingValues[f.FIELD_ID] && existingValues[f.FIELD_ID].trim() !== ''
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
        if (isAdmin) {
            existingInstances = await prisma.$queryRaw`
                SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                WHERE FORM_ID = ${request.FORM_ID}
                ORDER BY CREATE_DATE DESC
            `;
        } else {
            existingInstances = await prisma.$queryRaw`
                SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                WHERE FORM_ID = ${request.FORM_ID} AND ASSIGNED_ID = ${request.ASSIGNED_ID}
            `;
        }

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
                        FORM_ID, ASSIGNED_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${request.FORM_ID}, ${request.ASSIGNED_ID}, GETDATE(), ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new completed form instance`);
            } else {
                // Draft/in-progress submission (no submitted date)
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        FORM_ID, ASSIGNED_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${request.FORM_ID}, ${request.ASSIGNED_ID}, NULL, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new draft form instance`);
            }

            // Get the new instance ID
            let newInstances;
            if (isAdmin) {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID}
                    ORDER BY CREATE_DATE DESC
                `;
            } else {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID} AND ASSIGNED_ID = ${request.ASSIGNED_ID}
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

// Get specific form by ID (enhanced version)
app.get('/api/forms/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        console.log(`📋 Fetching form ${formId} from database for company:`, req.companyId);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        // Get the form details (check both company-specific and global forms)
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
        `;

        if (!forms.length) {
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        const form = forms[0];

        // Get the form fields - using junction table for proper field assignment
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_SENSITIVE, 
                   f.CREATE_DATE, f.UPDATE_DATE, f.ORGANIZATION_ID,
                   ff.IS_REQUIRED as FORM_IS_REQUIRED, ff.SORT_ORDER
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${formId}
            AND (f.ORGANIZATION_ID = ${req.companyId} OR f.ORGANIZATION_ID IS NULL)
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
                IS_REQUIRED: field.FORM_IS_REQUIRED || field.IS_REQUIRED,
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
        console.error(`❌ Error fetching form ${formId}:`, error);
        res.status(500).json({
            error: 'Failed to fetch form',
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