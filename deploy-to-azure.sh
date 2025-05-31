#!/bin/bash
# Script to prepare a deployment package for Azure App Service

echo "===== Guardian MVP Azure Deployment Script ====="
echo "Creating deployment package..."

# Create deployment directory
mkdir -p deployment
echo "Created deployment directory"

# Build the frontend
echo "Building frontend..."
npm run build
echo "Frontend build completed"

# Copy frontend build to deployment
echo "Copying frontend build to deployment/dist..."
cp -r dist deployment/
echo "Frontend files copied"

# Copy azure-server.js to deployment as server.js
echo "Copying azure-server.js to deployment/server.js..."
cp azure-server.js deployment/server.js
echo "Server file copied"

# Create package.json for deployment
echo "Creating package.json for deployment..."
cat > deployment/package.json << EOL
{
  "name": "guardian-server",
  "version": "1.0.0",
  "description": "Guardian MVP Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "body-parser": "^2.2.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOL
echo "Package.json created"

# Install dependencies in deployment directory
echo "Installing dependencies in deployment directory..."
cd deployment
npm install
cd ..
echo "Dependencies installed"

# Create web.config for Azure
echo "Creating web.config for Azure..."
cat > deployment/web.config << EOL
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="DynamicContent">
          <match url="/*" />
          <action type="Rewrite" url="server.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode watchedFiles="web.config;*.js" />
  </system.webServer>
</configuration>
EOL
echo "Web.config created"

# Create deployment zip file
echo "Creating deployment zip file..."
cd deployment
zip -r ../guardian-deployment.zip .
cd ..
echo "Deployment zip file created: guardian-deployment.zip"

echo "===== Deployment package created successfully ====="
echo "You can now upload guardian-deployment.zip to Azure App Service"
echo "Instructions:"
echo "1. Go to Azure Portal"
echo "2. Navigate to your App Service"
echo "3. Go to 'Deployment Center'"
echo "4. Choose 'Manual Deployment'"
echo "5. Upload guardian-deployment.zip"
echo "===== End of deployment script ====="
