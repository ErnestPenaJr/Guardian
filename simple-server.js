// Simple production server for Azure App Service
console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Import required modules
let express, path, fs, cors;
try {
  console.log('Importing required modules...');
  express = require('express');
  path = require('path');
  fs = require('fs');
  cors = require('cors');
  console.log('Successfully imported all required modules');
} catch (err) {
  console.error('ERROR IMPORTING MODULES:', err.message);
  console.error('Module resolution paths:', module.paths);
  process.exit(1);
}

// Create Express app
console.log('Creating Express application...');
const app = express();
const PORT = process.env.PORT || 8080;
console.log(`Server will listen on port: ${PORT}`);

// Enable CORS
app.use(cors());
console.log('CORS middleware enabled');

// Parse JSON requests
app.use(express.json());
console.log('JSON parsing middleware enabled');

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
console.log('Request logging middleware enabled');

// List directory contents to help with debugging
const listDirectoryContents = (dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      console.log(`Contents of ${dirPath}:`);
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        console.log(`  - ${item} (${stats.isDirectory() ? 'directory' : 'file'})`);
      });
      return items.length;
    } else {
      console.warn(`Directory not found: ${dirPath}`);
      return 0;
    }
  } catch (err) {
    console.error(`Error listing directory ${dirPath}:`, err.message);
    return -1;
  }
};

// List root directory contents
console.log('\n===== DEPLOYMENT DIRECTORY STRUCTURE =====');
listDirectoryContents(process.cwd());

// Serve static files from the dist directory
const distPath = path.join(__dirname, 'dist');
console.log(`\n===== STATIC FILES =====`);
console.log(`Serving static files from: ${distPath}`);
if (fs.existsSync(distPath)) {
  const fileCount = listDirectoryContents(distPath);
  console.log(`Found ${fileCount} items in the dist directory`);
  app.use(express.static(distPath));
} else {
  console.error(`ERROR: dist directory not found at ${distPath}`);
}

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint called');
  const healthInfo = { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    directories: {
      root: fs.existsSync(__dirname),
      dist: fs.existsSync(distPath),
      indexHtml: fs.existsSync(path.join(distPath, 'index.html')),
      testHtml: fs.existsSync(path.join(distPath, 'test.html'))
    },
    port: PORT,
    memoryUsage: process.memoryUsage()
  };
  console.log('Health check response:', healthInfo);
  res.json(healthInfo);
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test endpoint working!' });
});

// For all other routes, serve index.html if it exists
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`Request for ${req.url} - serving index.html from ${indexPath}`);
  
  if (fs.existsSync(indexPath)) {
    console.log(`index.html found, serving file`);
    res.sendFile(indexPath);
  } else {
    console.error(`index.html not found at ${indexPath}`);
    // Try to serve test.html as a fallback
    const testPath = path.join(distPath, 'test.html');
    if (fs.existsSync(testPath)) {
      console.log(`Falling back to test.html`);
      res.sendFile(testPath);
    } else {
      console.error(`No fallback HTML files found`);
      res.status(404).send('Application not properly deployed. Missing index.html and test.html');
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
try {
  const server = app.listen(PORT, () => {
    console.log('\n===== SERVER STARTED SUCCESSFULLY =====');
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('SERVER ERROR:', err.message);
  });
} catch (err) {
  console.error('FATAL ERROR STARTING SERVER:', err.message);
  process.exit(1);
}
