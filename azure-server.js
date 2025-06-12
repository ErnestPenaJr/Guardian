// azure-server.js

// Simple entry point for Azure Web App with auto-dependency installation
console.log('===== GUARDIAN SERVER STARTING =====');
console.log(`Node version: ${
    process.version
}`);
console.log(`Current directory: ${
    process.cwd()
}`);
console.log(`Environment: ${
    process.env.NODE_ENV || 'development'
}`);

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const isModuleInstalled = (moduleName) => {
    try {
        require.resolve(moduleName);
        return true;
    } catch (e) {
        return false;
    }
};

const installDependencies = () => {
    console.log('Attempting to install missing dependencies...');
    try {
        if (! fs.existsSync(path.join(process.cwd(), 'package.json'))) {
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
            fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify(minimalPackage, null, 2));
        }
        execSync('npm install express cors', {stdio: 'inherit'});
        console.log('Dependencies installed successfully');
        return true;
    } catch (error) {
        console.error('Failed to install dependencies:', error);
        return false;
    }
};

if (! isModuleInstalled('express') || ! isModuleInstalled('cors')) {
    console.log('Required modules not found. Attempting to install...');
    const installed = installDependencies();
    if (! installed) {
        console.error('Failed to install required dependencies. Exiting.');
        process.exit(1);
    }
}

let express,
    cors;
try {
    express = require('express');
    cors = require('cors');
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
if (fs.existsSync(distPath)) {
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
} else {
    console.warn(`Warning: Static files directory (${distPath}) not found`);
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
