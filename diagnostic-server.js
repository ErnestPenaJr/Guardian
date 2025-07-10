// Simple diagnostic server to test Azure deployment
console.log('=== DIAGNOSTIC SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT from env:', process.env.PORT);
console.log('Available env vars:', Object.keys(process.env).sort());

const PORT = process.env.PORT || 8080;

// Use require instead of import for maximum compatibility
const express = require('express');
const path = require('path');

const app = express();

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Catch all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Diagnostic server running on port ${PORT}`);
  console.log('Server started successfully!');
});