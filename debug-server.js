const express = require('express');
const cors = require('cors');

console.log('=== GUARDIAN DEBUG SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Process PID: ${process.pid}`);
console.log(`Current working directory: ${process.cwd()}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple health check with no dependencies
app.get('/api/health', (req, res) => {
    console.log('📊 Health check requested');
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        server: 'Guardian MVP Debug Server', 
        port: PORT,
        nodeVersion: process.version,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
    });
});

// Test database connection separately
app.get('/api/debug/database', async (req, res) => {
    try {
        console.log('🔍 Database connection test requested');
        
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient({
            log: ['error', 'warn'],
        });

        // Test connection with timeout
        const connectWithTimeout = () => {
            return Promise.race([
                prisma.$connect(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database connection timeout after 10 seconds')), 10000)
                )
            ]);
        };

        await connectWithTimeout();
        console.log('✅ Database connection successful in debug mode');
        
        // Test a simple query
        const testQuery = await prisma.$queryRaw`SELECT 1 as test_value`;
        console.log('✅ Database query successful:', testQuery);
        
        await prisma.$disconnect();
        
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
            test_query: testQuery
        });
        
    } catch (error) {
        console.error('❌ Database connection failed in debug mode:', error);
        res.status(500).json({
            status: 'error',
            database: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test environment variables
app.get('/api/debug/env', (req, res) => {
    console.log('🔍 Environment variables check requested');
    res.json({
        status: 'ok',
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'not_set',
            PORT: process.env.PORT || 'not_set',
            DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not_set',
            JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'not_set',
            SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'set' : 'not_set'
        },
        timestamp: new Date().toISOString()
    });
});

// Simple test login endpoint (no database)
app.post('/api/debug/login-test', (req, res) => {
    console.log('🔍 Login test requested');
    const { email, password } = req.body;
    
    res.json({
        status: 'ok',
        message: 'Login endpoint accessible',
        received: { 
            email: email ? 'received' : 'not_received',
            password: password ? 'received' : 'not_received'
        },
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('❌ Unhandled server error:', error);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log('📍 404 for:', req.method, req.originalUrl);
    res.status(404).json({
        status: 'not_found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

const server = app.listen(PORT, () => {
    console.log(`✅ Debug server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Database test: http://localhost:${PORT}/api/debug/database`);
    console.log(`🔗 Environment test: http://localhost:${PORT}/api/debug/env`);
});

server.on('error', (error) => {
    console.error('❌ Server startup error:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});