// Debug environment server to diagnose .env loading
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== DEBUG ENV SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// List all files in current directory
console.log('=== FILES IN CURRENT DIRECTORY ===');
try {
  const files = fs.readdirSync('./');
  files.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`${file} - ${stats.isDirectory() ? 'DIR' : 'FILE'} - ${stats.size} bytes`);
  });
} catch (err) {
  console.error('Error listing files:', err);
}

// Check specifically for .env file
console.log('=== ENV FILE CHECK ===');
const envFiles = ['.env', '.env.production', 'env'];
envFiles.forEach(filename => {
  const fullPath = path.join(__dirname, filename);
  const exists = fs.existsSync(fullPath);
  console.log(`${filename}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  if (exists) {
    try {
      const stats = fs.statSync(fullPath);
      console.log(`  Size: ${stats.size} bytes`);
      const content = fs.readFileSync(fullPath, 'utf8');
      console.log(`  Content preview: ${content.substring(0, 100)}...`);
    } catch (err) {
      console.error(`  Error reading ${filename}:`, err);
    }
  }
});

// Check environment variables
console.log('=== ENVIRONMENT VARIABLES ===');
const envVars = Object.keys(process.env).sort();
console.log(`Total env vars: ${envVars.length}`);
envVars.forEach(key => {
  if (key.includes('DATABASE') || key.includes('JWT') || key.includes('NODE')) {
    const value = process.env[key];
    console.log(`${key}: ${value ? value.substring(0, 50) + '...' : 'NOT SET'}`);
  }
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Debug endpoint
app.get('/api/debug', (req, res) => {
  const files = fs.readdirSync('./');
  const envVars = {};
  Object.keys(process.env).forEach(key => {
    if (key.includes('DATABASE') || key.includes('JWT') || key.includes('NODE') || key.includes('PORT')) {
      envVars[key] = process.env[key] ? 'SET' : 'NOT SET';
    }
  });
  
  res.json({
    directory: process.cwd(),
    files: files,
    envVars: envVars,
    envFileExists: fs.existsSync('.env'),
    envProductionExists: fs.existsSync('.env.production')
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    debug: 'env-debug-server'
  });
});

// Basic login test
app.post('/api/login', (req, res) => {
  res.json({
    message: 'Debug server - no real login',
    hasDatabase: !!process.env.DATABASE_URL,
    envVars: Object.keys(process.env).length
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
  console.log('=== SERVER STARTED ===');
});