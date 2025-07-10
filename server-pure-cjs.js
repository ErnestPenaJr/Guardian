// Pure CommonJS server for Azure - no ES modules
const express = require('express');
const path = require('path');
const cors = require('cors');

console.log('=== GUARDIAN SERVER STARTING (Pure CommonJS) ===');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Serve static files from the frontend dist directory
const frontendDistPath = path.resolve(process.cwd(), 'dist');
console.log(`[STATIC FILES] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

// API response middleware - ensures all API responses are JSON
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    message: 'Pure CommonJS server running'
  });
});

// Try to initialize CommonJS dependencies
let prisma, bcrypt, jwt, z, rateLimit;
let dependenciesLoaded = false;

try {
  // Load CommonJS versions of dependencies
  const { PrismaClient } = require('@prisma/client');
  bcrypt = require('bcryptjs');
  jwt = require('jsonwebtoken');
  z = require('zod');
  rateLimit = require('express-rate-limit');
  
  prisma = new PrismaClient();
  dependenciesLoaded = true;
  console.log('✅ Successfully loaded CommonJS dependencies');
  
} catch (err) {
  console.error('❌ Failed to load dependencies:', err.message);
  dependenciesLoaded = false;
}

if (dependenciesLoaded) {
  // JWT Configuration
  const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
  const JWT_EXPIRES_IN = '24h';
  
  // Generate JWT token
  const generateToken = (user) => {
    return jwt.sign({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      COMPANY_ID: user.COMPANY_ID,
      username: user.username,
      role: user.role,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  };

  // Zod schema for login validation
  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  });

  // Create a rate limiter for login attempts
  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { 
      success: false, 
      message: 'Too many login attempts. Please try again later.' 
    }
  });

  // LOGIN ENDPOINT
  app.post('/api/login', loginRateLimiter, async (req, res) => {
    console.log('[LOGIN] Login attempt:', { email: req.body.email });
    
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.log('[LOGIN] Validation error:', parseResult.error.errors);
        return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
      }

      const { email, password } = parseResult.data;

      try {
        console.log('[LOGIN] Looking up user in database...');
        const user = await prisma.uSERS.findFirst({
          where: { EMAIL: email }
        });

        console.log('[LOGIN] User found:', user ? {
          id: user.USER_ID,
          email: user.EMAIL,
          hasPassword: !!user.PASSWORD_HASH,
          status: user.STATUS,
          emailValidated: user.EMAIL_VALIDATED
        } : 'No user found');

        if (!user || !user.PASSWORD_HASH) {
          console.log('[LOGIN] Invalid user or password hash');
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('[LOGIN] Comparing password...');
        const valid = await bcrypt.compare(password, user.PASSWORD_HASH);
        
        if (!valid) {
          console.log('[LOGIN] Invalid password');
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('[LOGIN] Authentication successful, fetching user roles...');
        
        // Fetch user roles
        const userRoles = await prisma.uSER_ROLES.findMany({
          where: { USER_ID: user.USER_ID }
        });

        const roleIds = userRoles.map((ur) => ur.ROLE_ID);
        console.log('[LOGIN] User role IDs:', roleIds);

        let roles = [];
        if (roleIds.length > 0) {
          roles = await prisma.rOLES.findMany({
            where: {
              ROLE_ID: { in: roleIds }
            }
          });
          console.log('[LOGIN] Found roles:', roles.map(r => r.NAME || 'unnamed'));
        } else {
          console.log('[LOGIN] No roles found for user');
        }

        // Format roles for response
        const formattedRoles = roles.map(role => ({
          id: role.ROLE_ID,
          name: role.NAME,
          displayName: role.DISPLAY_NAME
        }));

        let company = null;
        if (user.COMPANY_ID) {
          try {
            console.log(`[LOGIN] Fetching company info for ID: ${user.COMPANY_ID}`);
            const companyData = await prisma.cOMPANY.findUnique({
              where: { COMPANY_ID: user.COMPANY_ID }
            });
            
            if (companyData) {
              company = {
                id: companyData.COMPANY_ID,
                name: companyData.NAME || ''
              };
              console.log(`[LOGIN] Found company: ${company.name}`);
            } else {
              console.log(`[LOGIN] No company found with ID: ${user.COMPANY_ID}`);
            }
          } catch (companyErr) {
            console.error('[LOGIN] Error fetching company:', companyErr);
          }
        } else {
          console.log('[LOGIN] No company ID associated with user');
        }

        // Create AuthUser object for generateToken
        const role = roleIds.includes(1) ? 'admin' :
                    roleIds.includes(6) ? 'jafar' :
                    roleIds.includes(5) ? 'sorcerer' : 'user';

        const authUser = {
          id: user.USER_ID,
          email: user.EMAIL,
          firstName: user.FIRST_NAME,
          lastName: user.LAST_NAME,
          roles: roleIds,
          COMPANY_ID: user.COMPANY_ID,
          username: user.EMAIL,
          role: role
        };

        console.log('[LOGIN] Generating token for user:', {
          id: authUser.id,
          email: authUser.email,
          role: authUser.role,
          companyId: authUser.COMPANY_ID
        });

        try {
          const token = generateToken(authUser);
          console.log('[LOGIN] Token generated successfully');
          
          const response = {
            token,
            user: {
              id: user.USER_ID,
              email: user.EMAIL,
              firstName: user.FIRST_NAME,
              lastName: user.LAST_NAME,
              roles: formattedRoles,
              company,
              companyId: user.COMPANY_ID,
              companyName: company?.name
            }
          };
          
          console.log('[LOGIN] Login successful, sending response');
          res.json(response);
          
        } catch (tokenErr) {
          console.error('[LOGIN] Error generating token:', tokenErr);
          throw new Error('Failed to generate authentication token');
        }

      } catch (err) {
        console.error('[LOGIN] Error during login:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });

        if (err.name === 'PrismaClientInitializationError' ||
            err.message.includes('prisma') ||
            err.message.includes('database')) {
          console.error('[LOGIN] Database connection error - check database configuration');
          return res.status(503).json({
            error: 'Database connection error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
          });
        }

        res.status(500).json({
          error: 'Server error during login',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
    } catch (outerErr) {
      console.error('[LOGIN] Unhandled error in login endpoint:', {
        message: outerErr.message,
        stack: outerErr.stack,
        name: outerErr.name
      });
      
      res.status(500).json({
        error: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? outerErr.message : undefined
      });
    }
  });

  console.log('✅ Login endpoint configured');

} else {
  // Fallback endpoints when dependencies fail to load
  app.use('/api/login', (req, res) => {
    res.status(503).json({ 
      error: 'Dependencies not loaded',
      message: 'Server dependencies failed to initialize'
    });
  });
  
  app.use('/api/*', (req, res) => {
    res.status(503).json({ 
      error: 'Dependencies not loaded',
      message: 'Server dependencies failed to initialize'
    });
  });
}

// For all non-API routes, serve the index.html file (for SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // If it's an API route that wasn't handled, return 404
    return res.status(404).json({ error: 'Not Found' });
  }
  // Otherwise serve the SPA
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Dependencies loaded: ${dependenciesLoaded}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});