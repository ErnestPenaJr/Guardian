// Entry point for Azure Web App
// This file handles starting the server

// In Azure, we should always treat it as production
const isProduction = true; // Force production mode in Azure

// Log startup information
console.log(`Starting server in production mode`);
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);

// Try to load the compiled JavaScript
console.log('Loading JavaScript bundle');

// First try to load from ./dist/index.js (if TypeScript was compiled)
import('./dist/index.js').catch(err1 => {
  console.log('Could not load from ./dist/index.js, trying ./index.js');
  
  // If that fails, try to load from ./index.js directly
  import('./index.js').catch(err2 => {
    console.error('Failed to load from ./dist/index.js:', err1.message);
    console.error('Failed to load from ./index.js:', err2.message);
    console.error('Server startup failed - please check deployment package contents');
    process.exit(1);
  });
});
