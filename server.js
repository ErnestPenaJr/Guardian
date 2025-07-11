const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

console.log('=== GUARDIAN SIMPLE SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || 3000}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('dist'));

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({status: 'ok', timestamp: new Date().toISOString(), server: 'Guardian MVP Simple Server', port: PORT});
});

// Basic test endpoint
app.get('/api/test', (req, res) => {
    res.json({success: true, message: 'API is working!', timestamp: new Date().toISOString()});
});

// Test users for login
app.post('/api/login', (req, res) => {
    const {email, password} = req.body;

    // Simple test credentials
    if (email === 'admin@example.com' && password === 'password123') {
        res.json({
            success: true,
            token: 'test-token-12345',
            user: {
                id: 1,
                email: 'admin@example.com',
                firstName: 'Admin',
                lastName: 'User'
            }
        });
    } else {
        res.status(401).json({error: 'Invalid credentials'});
    }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
      <h1>Guardian MVP Server</h1>
      <p>Server is running but frontend files not found.</p>
      <p>Available endpoints:</p>
      <ul>
        <li><a href="/api/health">/api/health</a></li>
        <li><a href="/api/test">/api/test</a></li>
      </ul>
      <p>Looking for: ${indexPath}</p>
    `);
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Static files: ${path.join(__dirname, 'dist')}`);
    console.log(`🌐 Health check: /api/health`);
    console.log(`🧪 Test login: admin@example.com / password123`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');  
    server.close(() => process.exit(0));
});

module.exports = app;
