import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRequestStatuses() {
    try {
        console.log("🔍 Checking request statuses...");
        
        // First check database connection and table existence
        console.log("🔌 Testing database connection...");
        const testQuery = await prisma.$queryRaw`SELECT GETDATE() as current_datetime`;
        console.log(`✅ Database connected, current time: ${testQuery[0].current_datetime}`);
        
        // Check if REQUESTS table exists
        console.log("🔍 Checking REQUESTS table...");
        const tableCheck = await prisma.$queryRaw`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'REQUESTS'
        `;
        console.log(`📊 REQUESTS table exists: ${tableCheck.length > 0}`);
        
        if (tableCheck.length === 0) {
            console.log("❌ REQUESTS table not found in GUARDIAN schema");
            // Check all Guardian tables
            const allTables = await prisma.$queryRaw`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'GUARDIAN'
                ORDER BY TABLE_NAME
            `;
            console.log("📋 Available GUARDIAN tables:");
            allTables.forEach(table => console.log(`  - ${table.TABLE_NAME}`));
            return;
        }
        
        // Check if there are any requests at all
        const totalRequests = await prisma.$queryRaw`SELECT COUNT(*) as count FROM GUARDIAN.REQUESTS`;
        console.log(`📊 Total requests in database: ${totalRequests[0].count}`);
        
        if (totalRequests[0].count === 0) {
            console.log("⚠️ No requests found in database");
            
            // Check if table has proper structure
            const tableStructure = await prisma.$queryRaw`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'REQUESTS'
                ORDER BY ORDINAL_POSITION
            `;
            console.log("📋 REQUESTS table structure:");
            tableStructure.forEach(col => {
                console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ''} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
            });
            
            return;
        }
        
        // Get recent requests with raw SQL to avoid any potential Prisma issues
        const recentRequests = await prisma.$queryRaw`
            SELECT TOP 10 
                REQUEST_ID, REQUEST_NAME, STATUS, CREATE_DATE, ASSIGNED_ID, REQUESTOR_ID
            FROM GUARDIAN.REQUESTS 
            ORDER BY CREATE_DATE DESC
        `;
        
        console.log(`📊 Found ${recentRequests.length} recent requests:`);
        
        recentRequests.forEach((req, index) => {
            console.log(`${index + 1}. ID: ${req.REQUEST_ID}, Name: "${req.REQUEST_NAME?.substring(0, 30)}...", Status: "${req.STATUS}", Created: ${req.CREATE_DATE}`);
        });
        
        // Get status distribution using raw SQL
        const statusDistribution = await prisma.$queryRaw`
            SELECT STATUS, COUNT(*) as count 
            FROM GUARDIAN.REQUESTS 
            GROUP BY STATUS
            ORDER BY count DESC
        `;
        
        console.log("\n📈 Overall status distribution:");
        statusDistribution.forEach(row => {
            console.log(`  ${row.STATUS}: ${row.count} requests`);
        });
        
        // Check for recent status A requests (which should be P)
        const activeRequests = await prisma.$queryRaw`
            SELECT TOP 5
                REQUEST_ID, REQUEST_NAME, STATUS, CREATE_DATE, ASSIGNED_ID
            FROM GUARDIAN.REQUESTS 
            WHERE STATUS = 'A'
            ORDER BY CREATE_DATE DESC
        `;
        
        console.log("\n🔍 Recent requests with 'A' (Active) status:");
        activeRequests.forEach((req, index) => {
            console.log(`${index + 1}. ID: ${req.REQUEST_ID}, Name: "${req.REQUEST_NAME}", Assigned: ${req.ASSIGNED_ID}, Created: ${req.CREATE_DATE}`);
        });
        
    } catch (error) {
        console.error("❌ Error checking request statuses:", error);
        console.error("Stack:", error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

checkRequestStatuses();
