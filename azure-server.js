// azure-server.js

console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const fs = require('fs');
const path = require('path');

// Import required modules
let express, cors, bcrypt, jwt, passport;
let PrismaClient;

try {
    express = require('express');
    cors = require('cors');
    bcrypt = require('bcryptjs');
    jwt = require('jsonwebtoken');
    passport = require('passport');
    const { PrismaClient: PC } = require('@prisma/client');
    PrismaClient = PC;
    
    console.log('✅ Successfully imported all required modules');
} catch (err) {
    console.error('❌ ERROR IMPORTING MODULES:', err.message);
    console.error('Make sure all dependencies are installed');
    process.exit(1);
}

// Initialize Prisma client
let prisma;
let prismaInitLog = [];

const initializePrisma = async () => {
    try {
        if (process.env.DATABASE_URL) {
            prismaInitLog.push('✅ DATABASE_URL found, initializing Prisma...');
            console.log('✅ DATABASE_URL found, initializing Prisma...');
            
            // Check if Prisma client exists
            const prismaClientPath = path.join(__dirname, 'node_modules', '@prisma', 'client');
            const prismaSchemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
            
            prismaInitLog.push(`🔍 Prisma client exists: ${fs.existsSync(prismaClientPath)}`);
            prismaInitLog.push(`🔍 Prisma schema exists: ${fs.existsSync(prismaSchemaPath)}`);
            
            // List prisma directory contents if it exists
            const prismaDir = path.join(__dirname, 'prisma');
            if (fs.existsSync(prismaDir)) {
                const contents = fs.readdirSync(prismaDir);
                prismaInitLog.push(`📋 Prisma directory contents: ${contents.join(', ')}`);
            }
            
            // Try to generate Prisma client first
            prismaInitLog.push('🔧 Attempting to generate Prisma client...');
            console.log('🔧 Attempting to generate Prisma client...');
            
            try {
                const { execSync } = require('child_process');
                const generateOutput = execSync('npx prisma generate', { 
                    cwd: __dirname,
                    encoding: 'utf8',
                    timeout: 30000
                });
                prismaInitLog.push(`✅ Prisma generate successful: ${generateOutput.trim()}`);
                console.log('✅ Prisma generate successful:', generateOutput);
            } catch (generateError) {
                prismaInitLog.push(`⚠️ Prisma generate failed: ${generateError.message}`);
                console.log('⚠️ Prisma generate failed:', generateError.message);
                // Continue anyway, maybe it was already generated
            }
            
            // Try to initialize Prisma client
            prisma = new PrismaClient({
                log: ['query', 'info', 'warn', 'error'],
            });
            prismaInitLog.push('✅ Prisma client initialized successfully');
            console.log('✅ Prisma client initialized successfully');
            
            // Test the connection
            prismaInitLog.push('🔍 Testing database connection...');
            console.log('🔍 Testing database connection...');
            await prisma.$connect();
            prismaInitLog.push('✅ Database connection successful');
            console.log('✅ Database connection successful');
        } else {
            prismaInitLog.push('⚠️  DATABASE_URL not found, running in test mode only');
            console.warn('⚠️  DATABASE_URL not found, running in test mode only');
            prisma = null;
        }
    } catch (error) {
        prismaInitLog.push(`❌ Failed to initialize Prisma: ${error.message}`);
        prismaInitLog.push(`❌ Stack trace: ${error.stack}`);
        console.error('❌ Failed to initialize Prisma:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        console.error('Will fall back to test users only');
        prisma = null;
    }
};

// Initialize Prisma asynchronously
initializePrisma();

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
const JWT_EXPIRES_IN = '24h';

// Test users for development
const TEST_USERS = [
    {
        id: 1,
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        roles: [1] // Admin role
    },
    {
        id: 2,
        email: 'user@example.com',
        password: 'password123',
        firstName: 'Regular',
        lastName: 'User',
        roles: [2] // Regular user role
    }
];

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles,
            COMPANY_ID: user.COMPANY_ID || 0,
            username: user.email,
            role: user.roles.includes(1) ? 'admin' : 'user'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Authentication function
const authenticateUser = async (email, password) => {
    try {
        // Try database authentication first if Prisma is available
        if (prisma) {
            try {
                const user = await prisma.uSERS.findFirst({
                    where: { EMAIL: email }
                });

                if (!user) {
                    return { success: false, message: 'User not found with this email address' };
                }

                if (!user.EMAIL_VALIDATED) {
                    return { success: false, message: 'Email not verified. Please verify your email before logging in' };
                }

                if (user.STATUS !== 'A') {
                    return { success: false, message: 'Account is not active. Please contact support' };
                }

                if (!user.PASSWORD_HASH) {
                    return { success: false, message: 'Password not set for this account. Please use password reset' };
                }

                const isPasswordValid = await bcrypt.compare(password, user.PASSWORD_HASH);
                if (!isPasswordValid) {
                    return { success: false, message: 'Invalid password. Please try again' };
                }

                // Get user roles
                const userRoles = await prisma.uSER_ROLES.findMany({
                    where: { USER_ID: user.USER_ID }
                });
                const roleIds = userRoles.map(ur => ur.ROLE_ID);

                return {
                    success: true,
                    user: {
                        id: user.USER_ID,
                        email: user.EMAIL,
                        firstName: user.FIRST_NAME,
                        lastName: user.LAST_NAME,
                        roles: roleIds,
                        COMPANY_ID: user.COMPANY_ID,
                        username: user.EMAIL,
                        role: roleIds.includes(1) ? 'admin' : 'user'
                    }
                };
            } catch (dbError) {
                console.error('Database authentication error:', dbError);
                // Fall back to test users if database fails
                console.log('Falling back to test users...');
            }
        }

        // Fall back to test users if database is not available or authentication failed
        const testUser = TEST_USERS.find(user => user.email === email);
        if (testUser && testUser.password === password) {
            return {
                success: true,
                user: {
                    id: testUser.id,
                    email: testUser.email,
                    firstName: testUser.firstName,
                    lastName: testUser.lastName,
                    roles: testUser.roles,
                    COMPANY_ID: 0,
                    username: testUser.email,
                    role: testUser.roles.includes(1) ? 'admin' : 'user'
                }
            };
        }

        return { success: false, message: 'Authentication service unavailable' };
    } catch (error) {
        console.error('Authentication error:', error);
        return { success: false, message: 'Authentication failed' };
    }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: prisma ? 'connected' : 'test-mode'
    });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Authenticate user
        const authResult = await authenticateUser(email, password);

        if (!authResult.success) {
            return res.status(401).json({
                success: false,
                message: authResult.message || 'Authentication failed'
            });
        }

        // Generate JWT token
        const token = generateToken(authResult.user);

        console.log('✅ Login successful for:', email);

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: authResult.user.id,
                email: authResult.user.email,
                firstName: authResult.user.firstName,
                lastName: authResult.user.lastName,
                roles: authResult.user.roles,
                role: authResult.user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

// Email validation endpoint
app.post('/api/validate-email', async (req, res) => {
    try {
        console.log('Email validation request:', req.body);
        
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                valid: false,
                message: 'Invalid email format'
            });
        }

        // Check if email exists in database
        if (prisma) {
            try {
                const existingUser = await prisma.uSERS.findFirst({
                    where: { EMAIL: email }
                });

                if (existingUser) {
                    return res.json({
                        success: true,
                        valid: false,
                        exists: true,
                        message: 'Email already exists'
                    });
                }
            } catch (dbError) {
                console.error('Database error checking email:', dbError);
                // Continue with validation even if DB check fails
            }
        }

        res.json({
            success: true,
            valid: true,
            exists: false,
            message: 'Email is available'
        });

    } catch (error) {
        console.error('Email validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating email'
        });
    }
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        console.log('Registration attempt:', { email: req.body.email });
        
        const { email, password, firstName, lastName, companyId } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        if (prisma) {
            try {
                // Check if user already exists
                const existingUser = await prisma.uSERS.findFirst({
                    where: { EMAIL: email }
                });

                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'User with this email already exists'
                    });
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Create user
                const newUser = await prisma.uSERS.create({
                    data: {
                        EMAIL: email,
                        PASSWORD_HASH: hashedPassword,
                        FIRST_NAME: firstName,
                        LAST_NAME: lastName,
                        COMPANY_ID: companyId || null,
                        STATUS: 'A', // Active
                        EMAIL_VALIDATED: false // Require email validation
                    }
                });

                console.log('✅ User created successfully:', email);

                // Generate token for new user
                const userData = {
                    id: newUser.USER_ID,
                    email: newUser.EMAIL,
                    firstName: newUser.FIRST_NAME,
                    lastName: newUser.LAST_NAME,
                    roles: [2], // Default user role
                    COMPANY_ID: newUser.COMPANY_ID,
                    username: newUser.EMAIL,
                    role: 'user'
                };

                const token = generateToken(userData);

                res.status(201).json({
                    success: true,
                    message: 'User created successfully',
                    token: token,
                    user: {
                        id: userData.id,
                        email: userData.email,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        roles: userData.roles,
                        role: userData.role
                    }
                });

            } catch (dbError) {
                console.error('Database error during registration:', dbError);
                res.status(500).json({
                    success: false,
                    message: 'Database error during registration'
                });
            }
        } else {
            // Mock registration for test mode
            console.log('📝 Mock registration (no database)');
            res.status(201).json({
                success: true,
                message: 'User registered successfully (test mode)',
                user: {
                    id: Date.now(),
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                    roles: [2],
                    role: 'user'
                }
            });
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration'
        });
    }
});

// Password reset request endpoint
app.post('/api/request-password-reset', async (req, res) => {
    try {
        console.log('Password reset request:', req.body);
        
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        if (prisma) {
            try {
                const user = await prisma.uSERS.findFirst({
                    where: { EMAIL: email }
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        error: 'No account found with that email address'
                    });
                }

                if (!user.EMAIL_VALIDATED) {
                    return res.status(403).json({
                        success: false,
                        error: 'Email not verified. Please verify your email first.'
                    });
                }

                // Generate a simple verification code (6 digits)
                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Set expiry time (15 minutes from now)
                const expiryTime = new Date();
                expiryTime.setMinutes(expiryTime.getMinutes() + 15);

                // Try to update user with reset token
                try {
                    await prisma.uSERS.update({
                        where: { USER_ID: user.USER_ID },
                        data: {
                            PASSWORD_RESET_TOKEN: verificationCode,
                            PASSWORD_RESET_TOKEN_EXPIRY: expiryTime
                        }
                    });
                    console.log(`✅ Password reset token stored in database for ${email}`);
                } catch (updateError) {
                    console.error('Database update error:', updateError);
                    // Continue anyway - we'll still return the code
                    console.log('⚠️ Could not store reset token in database, but continuing...');
                }

                console.log(`✅ Password reset code generated for ${email}: ${verificationCode}`);

                // Return success response
                res.json({
                    success: true,
                    message: 'Password reset code sent to your email',
                    verificationCode: verificationCode, // Remove this in production
                    expiryTime: expiryTime.toISOString()
                });

            } catch (dbError) {
                console.error('Database error during password reset request:', dbError);
                
                // Fallback to mock mode if database fails
                const mockCode = '123456';
                console.log('📧 Fallback to mock password reset code:', mockCode);
                
                res.json({
                    success: true,
                    message: 'Password reset code sent (fallback mode)',
                    verificationCode: mockCode,
                    expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                });
            }
        } else {
            // Mock password reset for test mode
            const mockCode = '123456';
            console.log('📧 Mock password reset code:', mockCode);
            
            res.json({
                success: true,
                message: 'Password reset code sent (test mode)',
                verificationCode: mockCode,
                expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            });
        }

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            error: `Internal server error: ${error.message}`
        });
    }
});

// Get current user (protected route)
app.get('/api/user', (req, res) => {
    // Simple JWT verification for now
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.json({
            success: true,
            user: {
                id: decoded.id,
                email: decoded.email,
                firstName: decoded.firstName,
                lastName: decoded.lastName,
                roles: decoded.roles,
                role: decoded.role
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Get requests (protected route)
app.get('/api/requests', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log(`📋 Fetching requests for user: ${decoded.email}`);

        if (prisma) {
            try {
                // Get requests from database
                const requests = await prisma.rEQUESTS.findMany({
                    take: 50, // Limit to 50 requests
                    orderBy: {
                        CREATE_DATE: 'desc'
                    },
                    include: {
                        REQUESTOR: {
                            select: {
                                FIRST_NAME: true,
                                LAST_NAME: true,
                                EMAIL: true
                            }
                        },
                        ASSIGNED_USER: {
                            select: {
                                FIRST_NAME: true,
                                LAST_NAME: true,
                                EMAIL: true
                            }
                        }
                    }
                });

                console.log(`✅ Found ${requests.length} requests in database`);

                res.json({
                    success: true,
                    requests: requests.map(req => ({
                        id: req.REQUEST_ID,
                        name: req.REQUEST_NAME,
                        description: req.REQUEST_DESCRIPTION,
                        status: req.STATUS,
                        submittedDate: req.SUBMITTED_DATE,
                        createDate: req.CREATE_DATE,
                        requestor: req.REQUESTOR ? {
                            name: `${req.REQUESTOR.FIRST_NAME} ${req.REQUESTOR.LAST_NAME}`,
                            email: req.REQUESTOR.EMAIL
                        } : null,
                        assignedUser: req.ASSIGNED_USER ? {
                            name: `${req.ASSIGNED_USER.FIRST_NAME} ${req.ASSIGNED_USER.LAST_NAME}`,
                            email: req.ASSIGNED_USER.EMAIL
                        } : null,
                        trackingId: req.TRACKINGID,
                        companyId: req.COMPANY_ID
                    })),
                    count: requests.length
                });

            } catch (dbError) {
                console.error('Database error fetching requests:', dbError);
                res.status(500).json({
                    success: false,
                    message: 'Database error fetching requests',
                    error: dbError.message
                });
            }
        } else {
            // Fallback to mock data if no database
            res.json({
                success: true,
                requests: [
                    { 
                        id: 1, 
                        name: 'Sample Request 1', 
                        description: 'This is a sample request',
                        status: 'A', 
                        submittedDate: new Date().toISOString(),
                        requestor: { name: 'Test User', email: 'test@example.com' }
                    },
                    { 
                        id: 2, 
                        name: 'Sample Request 2', 
                        description: 'Another sample request',
                        status: 'P', 
                        submittedDate: new Date().toISOString(),
                        requestor: { name: 'Test User 2', email: 'test2@example.com' }
                    }
                ],
                count: 2,
                note: 'Using mock data - database not available'
            });
        }
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Get users (protected route)
app.get('/api/users', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log(`👥 Fetching users for: ${decoded.email}`);

        if (prisma) {
            try {
                const users = await prisma.uSERS.findMany({
                    where: {
                        STATUS: 'A' // Only active users
                    },
                    select: {
                        USER_ID: true,
                        FIRST_NAME: true,
                        LAST_NAME: true,
                        EMAIL: true,
                        CREATE_DATE: true,
                        EMAIL_VALIDATED: true,
                        COMPANY_ID: true
                    },
                    take: 100,
                    orderBy: {
                        LAST_NAME: 'asc'
                    }
                });

                console.log(`✅ Found ${users.length} users in database`);

                res.json({
                    success: true,
                    users: users.map(user => ({
                        id: user.USER_ID,
                        firstName: user.FIRST_NAME,
                        lastName: user.LAST_NAME,
                        email: user.EMAIL,
                        emailValidated: user.EMAIL_VALIDATED,
                        companyId: user.COMPANY_ID,
                        createDate: user.CREATE_DATE
                    })),
                    count: users.length
                });

            } catch (dbError) {
                console.error('Database error fetching users:', dbError);
                res.status(500).json({
                    success: false,
                    message: 'Database error fetching users',
                    error: dbError.message
                });
            }
        } else {
            res.json({
                success: true,
                users: TEST_USERS.map(user => ({
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    roles: user.roles
                })),
                count: TEST_USERS.length,
                note: 'Using test data - database not available'
            });
        }
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

// Environment debug endpoint
app.get('/api/debug-env', (req, res) => {
    res.json({
        success: true,
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden for security)' : 'NOT SET',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET (hidden for security)' : 'NOT SET',
            PORT: process.env.PORT || 'not set'
        },
        prismaStatus: prisma ? 'initialized' : 'not initialized',
        timestamp: new Date().toISOString()
    });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        console.log('🔍 Testing database connection...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        console.log('Prisma client status:', prisma ? 'initialized' : 'not initialized');
        
        if (!prisma) {
            return res.json({
                success: false,
                message: 'Prisma client not initialized - using test mode only',
                testMode: true,
                databaseUrlSet: !!process.env.DATABASE_URL,
                timestamp: new Date().toISOString()
            });
        }

        // Test basic connection
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Try to query a simple table (adjust table name as needed)
        let tableTest = null;
        let tableError = null;

        try {
            // Try to get count of users (adjust table name to match your schema)
            const userCount = await prisma.uSERS.count();
            tableTest = { table: 'USERS', count: userCount, status: 'success' };
            console.log(`✅ Users table accessible, count: ${userCount}`);
        } catch (tableErr) {
            console.log('⚠️ Could not access USERS table:', tableErr.message);
            tableError = tableErr.message;
            
            // Try a raw query as fallback
            try {
                const rawResult = await prisma.$queryRaw`SELECT 1 as test`;
                tableTest = { rawQuery: true, result: rawResult, status: 'success' };
                console.log('✅ Raw query successful');
            } catch (rawErr) {
                console.log('❌ Raw query failed:', rawErr.message);
                tableError = rawErr.message;
            }
        }

        res.json({
            success: true,
            message: 'Database connection successful',
            connection: 'active',
            tableTest: tableTest,
            tableError: tableError,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });

    } catch (error) {
        console.error('❌ Database test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoints
app.get('/api/test-users', (req, res) => {
    res.json({
        message: 'Available test users for development',
        users: TEST_USERS.map(user => ({
            email: user.email,
            password: user.password,
            role: user.roles.includes(1) ? 'admin' : 'user'
        }))
    });
});

// Simple API test (no auth required)
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        server: 'Guardian MVP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Manual Prisma regeneration endpoint
app.post('/api/regenerate-prisma', async (req, res) => {
    try {
        const { execSync } = require('child_process');
        
        console.log('🔧 Manual Prisma regeneration requested...');
        
        // Run prisma generate
        const generateOutput = execSync('npx prisma generate', { 
            cwd: __dirname,
            encoding: 'utf8',
            timeout: 60000
        });
        
        console.log('✅ Prisma regeneration successful:', generateOutput);
        
        // Try to reinitialize Prisma
        if (prisma) {
            await prisma.$disconnect();
        }
        
        // Reload the Prisma client
        delete require.cache[require.resolve('@prisma/client')];
        const { PrismaClient } = require('@prisma/client');
        
        prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
        
        // Test connection
        await prisma.$connect();
        
        res.json({
            success: true,
            message: 'Prisma client regenerated and reconnected successfully',
            output: generateOutput.trim(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Prisma regeneration failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Prisma client debug endpoint
app.get('/api/debug-prisma', (req, res) => {
    try {
        const prismaClientPath = path.join(__dirname, 'node_modules', '@prisma', 'client');
        const prismaSchemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
        const prismaDir = path.join(__dirname, 'prisma');
        
        let prismaFiles = [];
        if (fs.existsSync(prismaDir)) {
            prismaFiles = fs.readdirSync(prismaDir);
        }
        
        let nodeModulesInfo = [];
        const nodeModulesPath = path.join(__dirname, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            nodeModulesInfo = fs.readdirSync(nodeModulesPath).filter(dir => dir.includes('prisma'));
        }
        
        res.json({
            success: true,
            prismaStatus: prisma ? 'initialized' : 'not initialized',
            initializationLog: prismaInitLog,
            paths: {
                __dirname: __dirname,
                prismaClientPath: prismaClientPath,
                prismaSchemaPath: prismaSchemaPath,
                prismaDir: prismaDir
            },
            fileChecks: {
                prismaClientExists: fs.existsSync(prismaClientPath),
                prismaSchemaExists: fs.existsSync(prismaSchemaPath),
                prismaDirExists: fs.existsSync(prismaDir)
            },
            prismaFiles: prismaFiles,
            nodeModulesPrisma: nodeModulesInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Define static files path
const distPath = path.join(__dirname, 'dist');

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Static files directory: ${distPath}`);
    console.log(`🔐 Available test accounts:`);
    TEST_USERS.forEach(user => {
        console.log(`   📧 ${user.email} / ${user.password} (${user.roles.includes(1) ? 'admin' : 'user'})`);
    });
    
    // Log directory contents for debugging
    try {
        if (fs.existsSync(distPath)) {
            console.log(`📋 Dist directory contents:`, fs.readdirSync(distPath));
        }
    } catch (e) {
        console.error('Error reading directories:', e);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Serve static files from dist directory (must be after all API routes)
if (fs.existsSync(distPath)) {
    console.log(`✅ Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    // Handle SPA routing - return the main index.html for all other requests
    app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            console.error(`index.html not found at: ${indexPath}`);
            res.status(404).send(`
                <h1>Application files not found</h1>
                <p>Please check deployment. Looking for: ${indexPath}</p>
                <p>Current directory: ${process.cwd()}</p>
            `);
        }
    });
} else {
    console.warn(`⚠️  Warning: Static files directory (${distPath}) not found`);
}

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});