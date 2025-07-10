// Simple server with working login endpoint
const express = require('express');
const path = require('path');

console.log('=== SIMPLE LOGIN SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

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

// Mock requests endpoint
app.get('/api/requests', (req, res) => {
  console.log('[REQUESTS] Fetching requests');
  
  // Return mock requests data
  res.json({
    success: true,
    data: [
      {
        id: 1,
        REQUEST_NAME: 'Security Assessment Request',
        EXTERNAL_USER: 'test@example.com',
        SUBMITTED_DATE: '2025-07-10T00:00:00.000Z',
        STATUS: 'New',
        CREATE_DATE: '2025-07-10T00:00:00.000Z',
        requestor_first_name: 'Test',
        requestor_last_name: 'User',
        assigned_first_name: 'Ernest',
        assigned_last_name: 'Pena'
      },
      {
        id: 2,
        REQUEST_NAME: 'Compliance Review',
        EXTERNAL_USER: 'user@company.com',
        SUBMITTED_DATE: '2025-07-09T00:00:00.000Z',
        STATUS: 'In Progress',
        CREATE_DATE: '2025-07-09T00:00:00.000Z',
        requestor_first_name: 'Another',
        requestor_last_name: 'User',
        assigned_first_name: 'Ernest',
        assigned_last_name: 'Pena'
      }
    ]
  });
});

// Simple login endpoint - test with hardcoded credentials first
app.post('/api/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Test with your credentials first
  if (email === 'ernest@shieldlytics.com' && password === 'MDA268RedDragon$') {
    console.log('[LOGIN] ✅ Test credentials matched');
    
    // Return successful login response in the format the frontend expects
    res.json({
      token: 'test-jwt-token-12345',
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
  
  // For any other credentials, return error
  console.log('[LOGIN] ❌ Invalid credentials');
  res.status(401).json({
    error: 'Invalid email or password'
  });
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