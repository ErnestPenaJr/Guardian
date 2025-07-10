// Basic database server without heavy dependencies
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== BASIC DB SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Manually load .env file for Azure compatibility
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^"/, '').replace(/"$/, '');
          process.env[key.trim()] = value;
        }
      }
    }
    console.log(`✅ DATABASE_URL loaded: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
  } catch (error) {
    console.error('❌ Error loading .env:', error.message);
  }
} else {
  console.log('❌ .env file not found');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: {
      hasUrl: !!process.env.DATABASE_URL,
      urlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET'
    },
    server: 'basic-db-server'
  });
});

// Real login endpoint - authenticate against REAL database
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] REAL database authentication for:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const prisma = new PrismaClient();
    
    console.log('[LOGIN] Looking up user in REAL database...');
    
    // Look up user in REAL database
    const user = await prisma.uSERS.findFirst({
      where: { EMAIL: email }
    });
    
    if (!user) {
      console.log('[LOGIN] ❌ User not found in database');
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    console.log('[LOGIN] ✅ User found, checking password...');
    
    // Check REAL password hash
    const validPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!validPassword) {
      console.log('[LOGIN] ❌ Invalid password');
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    console.log('[LOGIN] ✅ Password valid, getting user roles...');
    
    // Get REAL user roles from database
    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: user.USER_ID },
      include: {
        ROLES: true
      }
    });
    
    // Get REAL company info
    let company = null;
    if (user.COMPANY_ID) {
      const companyData = await prisma.cOMPANY.findUnique({
        where: { COMPANY_ID: user.COMPANY_ID }
      });
      if (companyData) {
        company = {
          id: companyData.COMPANY_ID,
          name: companyData.NAME || ''
        };
      }
    }
    
    // Generate REAL JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
    const token = jwt.sign({
      id: user.USER_ID,
      email: user.EMAIL,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      companyId: user.COMPANY_ID
    }, JWT_SECRET, { expiresIn: '24h' });
    
    console.log('[LOGIN] ✅ REAL database authentication successful!');
    
    res.json({
      token: token,
      user: {
        id: user.USER_ID,
        email: user.EMAIL,
        firstName: user.FIRST_NAME,
        lastName: user.LAST_NAME,
        roles: userRoles.map(ur => ({
          id: ur.ROLES.ROLE_ID,
          name: ur.ROLES.NAME,
          displayName: ur.ROLES.DISPLAY_NAME || ur.ROLES.NAME
        })),
        company: company,
        companyId: user.COMPANY_ID,
        companyName: company?.name || null
      }
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('[LOGIN] ❌ REAL database error:', error.message);
    res.status(500).json({
      error: 'Database authentication error',
      details: error.message
    });
  }
});

// Real requests endpoint - fetch REAL data from database
app.get('/api/requests', async (req, res) => {
  console.log('[REQUESTS] Fetching REAL requests from database');
  
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured',
      data: []
    });
  }
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('[REQUESTS] Connecting to database...');
    const requests = await prisma.rEQUESTS.findMany({
      orderBy: { CREATE_DATE: 'desc' }
    });
    
    console.log(`[REQUESTS] ✅ Found ${requests.length} REAL requests from database`);
    
    res.json({
      success: true,
      data: requests
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('[REQUESTS] ❌ Database error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests from database',
      details: error.message,
      data: []
    });
  }
});

// For all non-API routes, serve the index.html file (for SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Basic DB server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/login (Ernest only)');
  console.log('  GET  /api/requests (empty until DB connected)');
});