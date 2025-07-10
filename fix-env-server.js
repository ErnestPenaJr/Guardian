// Server that manually loads .env and fixes DATABASE_URL
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== FIX ENV SERVER STARTING ===');

// Manually load .env file
const envPath = path.join(__dirname, '.env');
console.log(`Loading .env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('Raw .env file content:');
        console.log(envContent);
        
        // Parse and set environment variables manually
        const lines = envContent.split('\n');
        let loadedVars = 0;
        
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^"/, '').replace(/"$/, '');
                    process.env[key.trim()] = value;
                    loadedVars++;
                    console.log(`✅ Set ${key.trim()}: ${value.substring(0, 30)}...`);
                }
            }
        }
        
        console.log(`Loaded ${loadedVars} environment variables from .env file`);
        
    } catch (envError) {
        console.error('❌ Error reading .env file:', envError);
    }
} else {
    console.log('❌ .env file not found');
}

console.log(`DATABASE_URL after manual load: ${process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌'}`);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let dbStatus = 'Not tested';
let dbError = null;

// Test database connection
async function testDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    
    console.log('Testing Prisma connection...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database test successful:', result);
    
    dbStatus = 'Connected';
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    dbStatus = 'Failed';
    dbError = error.message;
  }
}

// Health check with complete info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: {
      status: dbStatus,
      error: dbError,
      hasUrl: !!process.env.DATABASE_URL,
      urlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET'
    },
    envFileExists: fs.existsSync('.env'),
    server: 'fix-env-server'
  });
});

// Login endpoint with proper authentication
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (dbStatus !== 'Connected') {
    return res.status(503).json({ 
      error: 'Database not connected',
      details: dbError
    });
  }
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    
    // Look up user
    const user = await prisma.uSERS.findFirst({
      where: { EMAIL: email }
    });
    
    if (!user || !user.PASSWORD_HASH) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const valid = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Get user roles
    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: user.USER_ID }
    });
    const roleIds = userRoles.map(ur => ur.ROLE_ID);
    
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
      roles: roleIds,
      COMPANY_ID: user.COMPANY_ID
    }, JWT_SECRET, { expiresIn: '24h' });
    
    console.log('✅ Login successful for:', email);
    
    res.json({
      token: token,
      user: {
        id: user.USER_ID,
        email: user.EMAIL,
        firstName: user.FIRST_NAME,
        lastName: user.LAST_NAME,
        roles: roleIds.map(id => ({ id, name: `Role${id}`, displayName: `Role ${id}` })),
        company: company,
        companyId: user.COMPANY_ID,
        companyName: company?.name || null
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('Testing database connection...');
  testDatabase();
});