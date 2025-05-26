// Simple entry point for Azure Web App - CommonJS format
// This file should be in the root directory for Azure deployment

// Log startup information
console.log('Starting server in production mode');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.warn(`Warning: node_modules directory not found at ${nodeModulesPath}`);
  console.warn('Dependencies may not be installed correctly');
}

// Serve static files from the dist directory
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
} else {
  console.warn(`Warning: ${distPath} directory not found`);
}

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// For all other routes, serve index.html if it exists
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not properly deployed. Missing index.html');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});
