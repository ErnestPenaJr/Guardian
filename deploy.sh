#!/bin/bash

# Print node and npm versions
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Navigate to project root
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create a package.json for the server
echo "Creating server package.json..."
cat > server-package.json << EOL
{
  "name": "guardian-server",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "body-parser": "^2.2.0",
    "bcryptjs": "^3.0.2",
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "@prisma/client": "^6.6.0",
    "@sendgrid/mail": "^8.1.4",
    "multer": "^1.4.5-lts.2",
    "zod": "^3.24.3"
  }
}
EOL

# Install server dependencies
echo "Installing server dependencies..."
npm install --production --prefix ./server-temp --package-lock=false

# Move node_modules to the right place
echo "Setting up server dependencies..."
mkdir -p node_modules
cp -r server-temp/node_modules/* node_modules/
rm -rf server-temp

# Build the frontend
echo "Building frontend..."
npm run build

# Verify the deployment
echo "Deployment complete. Directory structure:"
ls -la
echo "Node modules:"
ls -la node_modules | head -n 10
echo "Dist directory:"
ls -la dist | head -n 10

echo "This script is only for direct Azure App Service deployments"
echo "For Azure Pipelines, the pipeline YAML file is used instead"

exit 0
