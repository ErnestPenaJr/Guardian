// Simple production server for Azure App Service
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the dist directory
const distPath = path.join(__dirname, 'dist');
console.log(`Serving static files from: ${distPath}`);
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.error(`ERROR: dist directory not found at ${distPath}`);
}

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    directories: {
      root: fs.existsSync(__dirname),
      dist: fs.existsSync(distPath)
    }
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
});
