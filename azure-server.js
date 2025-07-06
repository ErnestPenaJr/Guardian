// azure-server.js
// Enhanced Azure Web App entry point for Guardian MVP

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${process.version}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || 8080}`);
console.log(`Azure Web App: ${process.env.WEBSITE_SITE_NAME || 'local'}`);

const isModuleInstalled = async (moduleName) => {
    try {
        await import(moduleName);
        return true;
    } catch (e) {
        return false;
    }
};

const installDependencies = () => {
    console.log('Checking and installing missing dependencies...');
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('Creating minimal package.json...');
            const minimalPackage = {
                name: "guardian-server",
                version: "1.0.0",
                main: "azure-server.js",
                type: "commonjs",
                engines: {
                    node: ">=20.0.0"
                },
                dependencies: {
                    "express": "^4.21.2",
                    "cors": "^2.8.5",
                    "body-parser": "^2.2.0"
                }
            };
            fs.writeFileSync(packageJsonPath, JSON.stringify(minimalPackage, null, 2));
        }
        
        // Install only if node_modules doesn't exist
        if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
            console.log('Installing dependencies...');
            execSync('npm install --production', {stdio: 'inherit', timeout: 300000});
        }
        
        console.log('Dependencies ready');
        return true;
    } catch (error) {
        console.error('Failed to install dependencies:', error.message);
        return false;
    }
};

// Check for required modules
const expressInstalled = await isModuleInstalled('express');
const corsInstalled = await isModuleInstalled('cors');

if (!expressInstalled || !corsInstalled) {
    console.log('Required modules not found. Attempting to install...');
    const installed = installDependencies();
    if (!installed) {
        console.error('Failed to install required dependencies. Exiting.');
        process.exit(1);
    }
}

let express, cors;
try {
    express = (await import('express')).default;
    cors = (await import('cors')).default;
    console.log('Successfully imported all required modules');
} catch (err) {
    console.error('ERROR IMPORTING MODULES:', err.message);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${
        new Date().toISOString()
    }] ${
        req.method
    } ${
        req.url
    }`);
    next();
});

const distPath = path.join(__dirname, 'dist');
console.log(`Checking for static files at: ${distPath}`);
if (fs.existsSync(distPath)) {
    console.log(`✅ Serving static files from: ${distPath}`);
    try {
        const history = (await import('connect-history-api-fallback')).default;
        app.use(history({
            rewrites: [
                { from: /^\/api\/.*$/, to: function(context) {
                    return context.parsedUrl.pathname;
                }}
            ]
        }));
    } catch (err) {
        console.log('History API fallback not available, using basic routing');
    }
    app.use(express.static(distPath));
} else {
    console.warn(`⚠️  Warning: Static files directory (${distPath}) not found`);
    console.log('Available directories:', fs.readdirSync(__dirname));
} app.get('/api/health', (req, res) => {
    res.json({status: 'ok', timestamp: new Date().toISOString()});
});

app.get('/api/info', (req, res) => {
    res.json({
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Application files not found. Please check deployment.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});

}

// Start the server
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
