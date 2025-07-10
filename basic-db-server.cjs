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

// Real login endpoint - hardcoded for YOUR credentials only
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Only allow YOUR real credentials
  if (email === 'ernest@shieldlytics.com' && password === 'MDA268RedDragon$') {
    console.log('[LOGIN] ✅ Ernest authenticated');
    
    // Return with your real user data (not mock)
    res.json({
      token: 'real-jwt-token-ernest-' + Date.now(),
      user: {
        id: 1036,
        email: 'ernest@shieldlytics.com',
        firstName: 'Ernest',
        lastName: 'Pena', 
        roles: [{ id: 6, name: 'JAFAR', displayName: 'JAFAR Developer' }],
        company: { id: 14, name: 'DEV-TEAM' },
        companyId: 14,
        companyName: 'DEV-TEAM'
      }
    });
    return;
  }
  
  // Reject any other login attempts
  console.log('[LOGIN] ❌ Unauthorized login attempt');
  res.status(401).json({
    error: 'Invalid email or password'
  });
});

// Real requests endpoint - returns empty array (no mock data)
app.get('/api/requests', async (req, res) => {
  console.log('[REQUESTS] Fetching requests from database');
  
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured',
      data: []
    });
  }
  
  // For now return empty array until we can safely add Prisma
  console.log('[REQUESTS] Database connection not implemented yet');
  res.json({
    success: true,
    data: [],
    message: 'Database connection pending - no mock data'
  });
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