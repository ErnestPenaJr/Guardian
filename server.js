// Simple entry point for Azure Web App - ES Module format
// This file should be in the root directory for Azure deployment

// Log startup information
console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Import required modules
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import cors from 'cors';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Successfully imported all required modules');

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
        const itemPath = join(dirPath, item);
        const stats = fs.statSync(itemPath);
        console.log(`  - ${item} (${stats.isDirectory() ? 'directory' : 'file'})`);
      });
    } else {
      console.warn(`Directory not found: ${dirPath}`);
    }
  } catch (err) {
    console.error(`Error listing directory ${dirPath}:`, err.message);
  }
};

// List root directory contents
console.log('\n===== DEPLOYMENT DIRECTORY STRUCTURE =====');
listDirectoryContents(__dirname);

// Check if node_modules exists
const nodeModulesPath = join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log(`node_modules found at ${nodeModulesPath}`);
  // List some key packages to verify installation
  try {
    // In ESM, we can't use require.resolve, so we'll check differently
    const expressPackagePath = join(nodeModulesPath, 'express', 'package.json');
    if (fs.existsSync(expressPackagePath)) {
      const expressPackageJson = JSON.parse(fs.readFileSync(expressPackagePath, 'utf8'));
      console.log(`Express version: ${expressPackageJson.version}`);
    } else {
      console.error('Express package.json not found');
    }
  } catch (err) {
    console.error('Error checking express version:', err.message);
  }
} else {
  console.error(`ERROR: node_modules directory not found at ${nodeModulesPath}`);
  console.error('Dependencies are not installed correctly');
}

// Serve static files from the dist directory
const distPath = join(__dirname, 'dist');
console.log('\n===== STATIC FILES =====');
if (fs.existsSync(distPath)) {
  console.log(`Serving static files from: ${distPath}`);
  listDirectoryContents(distPath);
  app.use(express.static(distPath));
} else {
  console.error(`ERROR: dist directory not found at ${distPath}`);
  console.error('Frontend build is missing from the deployment');
}

// Check for index.html
const indexPath = join(distPath, 'index.html');
if (fs.existsSync(indexPath)) {
  console.log(`index.html found at ${indexPath}`);
} else {
  console.error(`ERROR: index.html not found at ${indexPath}`);
}

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  const healthInfo = { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    directories: {
      root: fs.existsSync(__dirname),
      nodeModules: fs.existsSync(nodeModulesPath),
      dist: fs.existsSync(distPath),
      indexHtml: fs.existsSync(indexPath)
    }
  };
  console.log('Health check response:', healthInfo);
  res.json(healthInfo);
});

// For all other routes, serve index.html if it exists
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    console.log(`Serving index.html for route: ${req.url}`);
    res.sendFile(indexPath);
  } else {
    console.error(`Cannot serve index.html for ${req.url} - file not found`);
    res.status(404).send('Application not properly deployed. Missing index.html');
  }
});

// Start server
try {
  app.listen(PORT, () => {
    console.log('\n===== SERVER STARTED SUCCESSFULLY =====');
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('ERROR STARTING SERVER:', err.message);
  process.exit(1);
}
