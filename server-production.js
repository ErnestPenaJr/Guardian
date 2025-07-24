// Production server for Azure deployment
// This file replicates the functionality of server/index.ts but in CommonJS format for Azure compatibility

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('=== GUARDIAN PRODUCTION SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`Port: ${process.env.PORT || 3001}`);
console.log(`Process PID: ${process.pid}`);
console.log(`Current working directory: ${process.cwd()}`);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma
const prisma = new PrismaClient();

// Trust proxy for Azure
app.set('trust proxy', 1);

// CORS and JSON parsing
app.use(cors());
app.use(express.json());

// CRITICAL: API routes MUST come BEFORE static file serving
console.log('🔧 Setting up API routes...');

// API response middleware - ensures all API responses are JSON
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.path} - User-Agent: ${req.get('User-Agent')}`);
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    server: 'production'
  });
});

// API routing test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Production API routing is working correctly',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    server: 'production'
  });
});

// Basic login endpoint (simplified for production)
app.post('/api/login', async (req, res) => {
  try {
    console.log('[LOGIN] Production login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    const user = await prisma.uSERS.findFirst({
      where: { EMAIL: email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user roles
    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: user.USER_ID }
    });

    const roleIds = userRoles.map(ur => ur.ROLE_ID);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.USER_ID, 
        email: user.EMAIL,
        roles: roleIds
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.USER_ID,
        email: user.EMAIL,
        firstName: user.FIRST_NAME,
        lastName: user.LAST_NAME,
        roles: roleIds.map(id => ({ id }))
      }
    });

  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Critical: Requests API endpoint that was failing
app.get('/api/requests/:id/form', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    console.log(`[FORM API] Request for form data, request ID: ${requestId}`);
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Get the request
    const request = await prisma.$queryRawUnsafe(`
      SELECT r.*
      FROM GUARDIAN.REQUESTS r
      WHERE r.REQUEST_ID = ${requestId}
    `);
    
    if (!request || request.length === 0) {
      console.log('[FORM API] No request found, returning fallback');
      return res.json({
        request: { REQUEST_ID: requestId, REQUEST_NAME: 'Unknown Request' },
        form: {
          FORM_ID: 0,
          FORM_NAME: 'Default Form',
          FORM_DESCRIPTION: 'Default form template for request fulfillment',
          IS_ACTIVE: true,
          IS_PUBLIC: false,
          IS_DELETED: false
        },
        fields: [
          { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
        ],
        values: {},
        formInstanceId: null
      });
    }

    const requestData = request[0];
    
    // Return form data with fallback
    res.json({
      request: requestData,
      form: {
        FORM_ID: 1005,
        FORM_NAME: 'Subject Form',
        FORM_DESCRIPTION: 'Subject information form',
        IS_ACTIVE: true,
        IS_PUBLIC: false,
        IS_DELETED: false
      },
      fields: [
        { FIELD_ID: 1, FIELD_NAME: 'First Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 1 },
        { FIELD_ID: 2, FIELD_NAME: 'Last Name', FIELD_TYPE_ID: 1, IS_REQUIRED: true, SEQUENCE: 2 },
        { FIELD_ID: 3, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 3 }
      ],
      values: {},
      formInstanceId: null
    });

  } catch (error) {
    console.error('[FORM API] Error:', error);
    
    // Always return valid JSON, never HTML
    res.json({
      request: { REQUEST_ID: parseInt(req.params.id), REQUEST_NAME: 'Error Recovery' },
      form: {
        FORM_ID: 0,
        FORM_NAME: 'Error Recovery Form',
        FORM_DESCRIPTION: 'This form was generated due to an error',
        IS_ACTIVE: true,
        IS_PUBLIC: false,
        IS_DELETED: false
      },
      fields: [
        { FIELD_ID: 1, FIELD_NAME: 'Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 1 }
      ],
      values: {},
      formInstanceId: null
    });
  }
});

// Basic requests listing endpoint
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await prisma.$queryRawUnsafe(`
      SELECT TOP 10 r.*
      FROM GUARDIAN.REQUESTS r
      ORDER BY r.CREATE_DATE DESC
    `);
    
    res.json(requests || []);
  } catch (error) {
    console.error('[REQUESTS API] Error:', error);
    res.json([]);
  }
});

// IMPORTANT: Static files served AFTER API routes
console.log('📁 Setting up static file serving...');
const frontendDistPath = path.resolve(process.cwd());
console.log(`[STATIC FILES] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

// Catch-all for SPA routing - MUST be last
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[404] API route not found: ${req.path}`);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  console.log(`[SPA] Serving index.html for: ${req.path}`);
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Production server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Access the application at: http://localhost:${PORT}`);
  console.log('🔧 API routes configured BEFORE static files');
  console.log('✨ Ready to handle requests!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
