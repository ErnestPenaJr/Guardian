// Simplified production server for debugging
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting simplified production server...');
console.log('📦 Port:', PORT);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('📧 EMAIL_FROM:', process.env.EMAIL_FROM ? 'Set' : 'Not set');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('💾 DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
    console.log('🏥 Health check requested');
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'Guardian MVP Simple Production Server',
        port: PORT,
        nodeVersion: process.version,
        uptime: process.uptime(),
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            hasDatabase: !!process.env.DATABASE_URL,
            hasJWT: !!process.env.JWT_SECRET,
            hasEmail: !!process.env.SMTP_PASSWORD
        }
    });
});

// Simple login test endpoint
app.post('/api/login', async (req, res) => {
    console.log('🔐 Login test requested');
    try {
        const { email, password } = req.body;
        
        res.json({
            status: 'test_mode',
            message: 'Login endpoint is working',
            email: email,
            hasPassword: !!password,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Login test error:', error.message);
        res.status(500).json({
            error: 'Login test failed',
            message: error.message
        });
    }
});

// Catch-all for other API routes
app.all('/api/*', (req, res) => {
    console.log(`🔗 API request: ${req.method} ${req.path}`);
    res.json({
        message: `API endpoint ${req.method} ${req.path} reached`,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Simple production server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});