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

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma
const prisma = new PrismaClient();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';

// Test database connection
prisma.$connect()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection failed:', err.message));

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set proper MIME types for ES modules
app.use(express.static('dist', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({status: 'ok', timestamp: new Date().toISOString(), server: 'Guardian MVP Simple Server', port: PORT});
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
                roles: roles, // Full role objects with id, name, description
                roleIds: roleIds, // Just the IDs for backward compatibility
                roleNames: roleNames, // Just the names
                role: roleNames.length > 0 ? roleNames[0] : 'user', // Primary role name
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

// Get test users endpoint
app.get('/api/test-users', (req, res) => {
    res.json({
        message: 'Available test users',
        users: [
            {
                email: 'admin@example.com',
                password: 'password123',
                role: 'admin'
            },
            {
                email: 'user@example.com', 
                password: 'password123',
                role: 'user'
            }
        ]
    });
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
        
        // Debug: Log first request to see raw data structure
        if (requests.length > 0) {
            console.log('🔍 Sample raw request data:', JSON.stringify(requests[0], null, 2));
        }

        // Status mapping
        const getStatusName = (statusCode) => {
            switch(statusCode) {
                case 'A': return 'Active';
                case 'P': return 'Pending';
                case 'C': return 'Completed';
                case 'D': return 'Draft';
                case 'R': return 'Rejected';
                default: return statusCode || 'Unknown';
            }
        };

        // Format the data to match frontend expectations exactly
        const formattedRequests = requests.map(req => ({
            // Exact field names that frontend expects
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
            
            // User objects as expected by frontend
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
            
            // Computed fields for frontend
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown',
            assignedName: req.ASSIGNED_FIRST_NAME ? 
                `${req.ASSIGNED_FIRST_NAME} ${req.ASSIGNED_LAST_NAME}` : 
                null
        }));

        // Debug: Log formatted data structure
        if (formattedRequests.length > 0) {
            console.log('🔍 Sample formatted request data:', JSON.stringify(formattedRequests[0], null, 2));
        }

        console.log(`📤 Sending ${formattedRequests.length} formatted requests to frontend`);

        // Return just the array (frontend expects array directly)
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

        // Get all active users
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

        // Format users for compatibility
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
            // Legacy format for compatibility
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

        // Get users from the same company
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

        // Format users for dropdown
        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            EMAIL: user.EMAIL,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            COMPANY_ID: user.COMPANY_ID,
            ROLE_NAMES: user.ROLE_NAMES || 'No roles assigned',
            // For dropdown display
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

        // Update the request assignment
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

// Serve React app for all other routes (excluding API and static assets)
app.get('*', (req, res) => {
    // Don't serve HTML for API routes or static assets
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/assets/') || 
        req.path.includes('.js') || 
        req.path.includes('.css') || 
        req.path.includes('.png') || 
        req.path.includes('.jpg') || 
        req.path.includes('.svg') || 
        req.path.includes('.ico')) {
        return res.status(404).send('Not found');
    }
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
      <h1>Guardian MVP Server</h1>
      <p>Server is running but frontend files not found.</p>
      <p>Available endpoints:</p>
      <ul>
        <li><a href="/api/health">/api/health</a></li>
        <li><a href="/api/test">/api/test</a></li>
      </ul>
      <p>Looking for: ${indexPath}</p>
    `);
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Static files: ${path.join(__dirname, 'dist')}`);
    console.log(`🌐 Health check: /api/health`);
    console.log(`🧪 Test login: admin@example.com / password123`);
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
