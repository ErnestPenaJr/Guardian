// CommonJS version of server-production.js to work with "type": "module" in package.json
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

console.log('=== GUARDIAN PRODUCTION SERVER STARTING (CommonJS) ===');
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
// Check if running in development mode with Vite
const isDevelopmentWithVite = process.env.NODE_ENV !== 'production' && 
                              process.argv.includes('--dev-mode');

if (isDevelopmentWithVite) {
  // In development mode with Vite, static files are served by Vite dev server (port 5175)
  // This backend server only handles API endpoints
  console.log('🔧 Development mode detected: Static files served by Vite on port 5175');
} else {
  // In production mode, serve static files from current directory (where dist contents are deployed)
  app.use(express.static('.', {
    index: 'index.html',
    setHeaders: (res, path) => {
      // Set proper MIME types for JavaScript modules
      if (path.endsWith('.js') || path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));
  console.log('📁 Production mode: Serving static files from current directory');
}

// === API ROUTES ===

// Basic health check (no database required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        server: 'Guardian MVP Production Server (CommonJS)', 
        port: PORT,
        nodeVersion: process.version,
        uptime: process.uptime()
    });
});

// Simple login endpoint for testing
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔍 Login attempt received');
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Enhanced email validation
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for login: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Test database connection for login
        try {
            const users = await prisma.$queryRaw`
                SELECT u.USER_ID, u.EMAIL, u.NAME, u.PASSWORD_HASH, u.ACTIVE,
                       ci.COMPANY_ID, ci.COMPANY_NAME,
                       STRING_AGG(CAST(ur.ROLE_ID AS VARCHAR), ',') AS ROLE_IDS
                FROM GUARDIAN.USERS u
                LEFT JOIN GUARDIAN.COMPANY_INFO ci ON u.COMPANY_ID = ci.COMPANY_ID
                LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
                WHERE u.EMAIL = ${emailValidation.email}
                  AND u.ACTIVE = 1
                GROUP BY u.USER_ID, u.EMAIL, u.NAME, u.PASSWORD_HASH, u.ACTIVE, ci.COMPANY_ID, ci.COMPANY_NAME
            `;

            if (!users || users.length === 0) {
                console.log(`❌ User not found: ${emailValidation.email}`);
                return res.status(401).json({
                    error: 'Invalid email or password'
                });
            }

            const user = users[0];
            
            if (!user.ACTIVE) {
                console.log(`❌ User not active: ${emailValidation.email}`);
                return res.status(401).json({
                    error: 'Account is not active. Please contact support.'
                });
            }

            // Check password
            if (!user.PASSWORD_HASH) {
                console.log(`❌ No password hash for user: ${emailValidation.email}`);
                return res.status(401).json({
                    error: 'Password not set for this account. Please use password reset.'
                });
            }

            const validPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
            if (!validPassword) {
                console.log(`❌ Invalid password for user: ${emailValidation.email}`);
                return res.status(401).json({
                    error: 'Invalid email or password'
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.USER_ID,
                    email: user.EMAIL,
                    companyId: user.COMPANY_ID,
                    roles: user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : []
                }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );

            console.log(`✅ Login successful for user: ${user.EMAIL}`);

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.USER_ID,
                    email: user.EMAIL,
                    name: user.NAME,
                    companyId: user.COMPANY_ID,
                    companyName: user.COMPANY_NAME,
                    roles: user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : []
                },
                token
            });

        } catch (dbError) {
            console.error('❌ Database error during login:', dbError);
            return res.status(500).json({
                error: 'Database connection error',
                message: 'Unable to verify credentials. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: 'Server error during login',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Fallback route for SPA (serve index.html for non-API routes)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).json({
            error: 'Application not found',
            message: 'index.html not found in deployment',
            timestamp: new Date().toISOString()
        });
    }
});

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} (CommonJS Production Mode)`);
});

server.on('error', (error) => {
    console.error('❌ Server startup error:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});