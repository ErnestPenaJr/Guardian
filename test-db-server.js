// Test database connection server
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== TEST DB SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

// Check if .env file exists and manually load it (Azure compatibility)
const envPath = path.join(__dirname, '.env');
console.log(`Looking for .env file at: ${envPath}`);
console.log(`Env file exists: ${fs.existsSync(envPath)}`);

if (fs.existsSync(envPath)) {
    console.log(`Env file size: ${fs.statSync(envPath).size} bytes`);
    
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('Env file content preview (first 100 chars):');
        console.log(envContent.substring(0, 100));
        
        // Parse and set environment variables manually
        const lines = envContent.split('\n');
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^"/, '').replace(/"$/, '');
                    process.env[key.trim()] = value;
                    console.log(`Set environment variable: ${key.trim()} = ${value.substring(0, 50)}...`);
                }
            }
        }
        console.log(`DATABASE_URL after manual load: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    } catch (envError) {
        console.error('Error reading .env file:', envError);
    }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let dbStatus = 'Not tested';
let dbError = null;

// Test database connection
async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('Prisma client created, testing connection...');
    
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database test query result:', result);
    
    dbStatus = 'Connected';
    console.log('✅ Database connection successful');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    dbStatus = 'Failed';
    dbError = error.message;
  }
}

// Health check with database status
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
      hasUrl: !!process.env.DATABASE_URL
    }
  });
});

// Test login endpoint - very basic
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Test login attempt:', { email: req.body.email });
  
  if (dbStatus !== 'Connected') {
    return res.status(503).json({
      error: 'Database not connected',
      details: dbError
    });
  }
  
  // For now, just return success for any login to test the flow
  res.json({
    token: 'test-token',
    user: {
      id: 1,
      email: req.body.email,
      firstName: 'Test',
      lastName: 'User',
      roles: [],
      company: null,
      companyId: null,
      companyName: null
    }
  });
});

// For all non-API routes, serve the index.html file
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Test database connection after server starts
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  testDatabase();
});