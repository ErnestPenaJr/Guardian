// Simple entry point for Azure Web App with auto-dependency installation
// This file should be in the root directory for Azure deployment

// Log startup information
console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Check if node_modules exists and try to install dependencies if not
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to check if a module is installed
const isModuleInstalled = (moduleName) => {
  try {
    require.resolve(moduleName);
    return true;
  } catch (e) {
    return false;
  }
};

// Try to install missing dependencies
const installDependencies = () => {
  console.log('Attempting to install missing dependencies...');
  
  try {
    // Create a minimal package.json if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
      console.log('Creating minimal package.json...');
      const minimalPackage = {
        name: "guardian-server",
        version: "1.0.0",
        main: "azure-server.js",
        dependencies: {
          "express": "^4.21.2",
          "cors": "^2.8.5"
        }
      };
      fs.writeFileSync(
        path.join(process.cwd(), 'package.json'), 
        JSON.stringify(minimalPackage, null, 2)
      );
    }
    
    // Install express and cors
    console.log('Installing express and cors...');
    execSync('npm install express cors', { stdio: 'inherit' });
    console.log('Dependencies installed successfully');
    return true;
  } catch (error) {
    console.error('Failed to install dependencies:', error);
    return false;
  }
};

// Check and install dependencies if needed
if (!isModuleInstalled('express') || !isModuleInstalled('cors')) {
  console.log('Required modules not found. Attempting to install...');
  const installed = installDependencies();
  if (!installed) {
    console.error('Failed to install required dependencies. Exiting.');
    process.exit(1);
  }
}

// Import required modules
let express, cors;
try {
  express = require('express');
  cors = require('cors');
  console.log('Successfully imported all required modules');
} catch (err) {
  console.error('ERROR IMPORTING MODULES:', err.message);
  console.error('Module resolution paths:', module.paths);
  process.exit(1);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
    } else {
      console.log(`Directory ${dirPath} does not exist`);
    }
  } catch (error) {
    console.error(`Error listing directory ${dirPath}:`, error);
  }
};

// List root directory contents
console.log('\n===== DEPLOYMENT DIRECTORY STRUCTURE =====');
listDirectoryContents(__dirname);
listDirectoryContents(path.join(__dirname, 'dist'));
listDirectoryContents(path.join(__dirname, 'node_modules'));

// Check if dist directory exists and serve static files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
} else {
  console.warn(`Warning: Static files directory (${distPath}) not found`);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoint for testing
app.get('/api/info', (req, res) => {
  res.json({
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
  // Check if index.html exists in dist directory
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application files not found. Please check deployment.');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});
