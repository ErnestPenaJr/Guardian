// Simple server with database-connected endpoints
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== GUARDIAN SERVER STARTING ===');
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
    server: 'simple-login-server'
  });
});

// Real requests endpoint - fetch from database
app.get('/api/requests', async (req, res) => {
  console.log('[REQUESTS] Fetching requests from database');
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const requests = await prisma.rEQUESTS.findMany({
      orderBy: { CREATE_DATE: 'desc' }
    });
    
    console.log(`✅ Found ${requests.length} requests`);
    
    res.json({
      success: true,
      data: requests
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Database error fetching requests:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests',
      details: error.message
    });
  }
});

// Real login endpoint - authenticate against database
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const prisma = new PrismaClient();
    
    // Look up user in database
    const user = await prisma.uSERS.findFirst({
      where: { EMAIL: email }
    });
    
    if (!user) {
      console.log('[LOGIN] ❌ User not found');
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!validPassword) {
      console.log('[LOGIN] ❌ Invalid password');
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    // Get user roles
    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: user.USER_ID },
      include: {
        ROLES: true
      }
    });
    
    // Get company info
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
    
    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
    const token = jwt.sign({
      id: user.USER_ID,
      email: user.EMAIL,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      companyId: user.COMPANY_ID
    }, JWT_SECRET, { expiresIn: '24h' });
    
    console.log('[LOGIN] ✅ Login successful');
    
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
    console.error('[LOGIN] ❌ Database error:', error.message);
    res.status(500).json({
      error: 'Server error during login',
      details: error.message
    });
  }
});

// For all non-API routes, serve the index.html file (for SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // If it's an API route that wasn't handled, return 404
    return res.status(404).json({ error: 'Not Found' });
  }
  // Otherwise serve the SPA
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Simple login server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/login');
});