// Test production database connection
import { PrismaClient } from '@prisma/client';

// Production database connection string
const DATABASE_URL = process.env.DATABASE_URL || "sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false;schema=GUARDIAN";

console.log('Testing production database connection...');
console.log('Database URL:', DATABASE_URL.replace(/password=[^;]+/i, 'password=***'));

const prisma = new PrismaClient({
    log: ['error', 'warn', 'info'],
});

async function testConnection() {
    try {
        console.log('🔌 Testing basic connection...');
        await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Basic connection successful');
        
        console.log('🔍 Testing USERS table access...');
        const userCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM GUARDIAN.USERS`;
        console.log(`✅ USERS table accessible, count: ${userCount[0]?.count || 0}`);
        
        console.log('👤 Testing user lookup for ernest@shieldlytics.com...');
        const users = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL, FIRST_NAME, LAST_NAME, STATUS, COMPANY_ID, EMAIL_VALIDATED
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${'ernest@shieldlytics.com'}))
        `;
        
        if (users.length > 0) {
            console.log('✅ User found:', {
                USER_ID: users[0].USER_ID,
                EMAIL: users[0].EMAIL,
                FIRST_NAME: users[0].FIRST_NAME,
                LAST_NAME: users[0].LAST_NAME,
                STATUS: users[0].STATUS,
                COMPANY_ID: users[0].COMPANY_ID,
                EMAIL_VALIDATED: users[0].EMAIL_VALIDATED
            });
        } else {
            console.log('❌ User not found for ernest@shieldlytics.com');
        }
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Disconnected from database');
    }
}

testConnection();