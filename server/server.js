// Entry point for Azure Web App
// This file handles compiling TypeScript and starting the server

// Check if we're running in production
const isProduction = process.env.NODE_ENV === 'production';

// Log startup information
console.log(`Starting server in ${isProduction ? 'production' : 'development'} mode`);
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);

// In production, we assume TypeScript is already compiled to JavaScript
if (isProduction) {
  console.log('Loading compiled JavaScript bundle');
  import('./dist/index.js').catch(err => {
    console.error('Failed to load compiled JavaScript:', err);
    process.exit(1);
  });
} else {
  // In development, compile TypeScript on the fly
  console.log('Compiling TypeScript on the fly');
  import('ts-node/register/esm.js').then(() => {
    import('./index.ts').catch(err => {
      console.error('Failed to load TypeScript source:', err);
      process.exit(1);
    });
  }).catch(err => {
    console.error('Failed to load ts-node:', err);
    process.exit(1);
  });
}
