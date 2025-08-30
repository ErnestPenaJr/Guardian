const { PrismaClient } = require('@prisma/client');

async function investigateToolingIssue() {
    console.log('🔍 INVESTIGATING DATABASE TOOLING ISSUE');
    console.log('=========================================');
    
    const prisma = new PrismaClient();
    
    try {
        // 1. Check what tables actually exist and their types
        console.log('\n1. Examining Table Structure:');
        const tableInfo = await prisma.$queryRaw`
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME, 
                TABLE_TYPE,
                TABLE_CATALOG
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'GUARDIAN'
            ORDER BY TABLE_NAME
        `;
        
        console.log('Tables in GUARDIAN schema:');
        tableInfo.forEach(table => {
            console.log(`  ${table.TABLE_NAME} (${table.TABLE_TYPE}) in ${table.TABLE_SCHEMA}`);
        });
        
        // 2. Check if USERS table has any special features
        console.log('\n2. USERS Table Details:');
        const userTableCols = await prisma.$queryRaw`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'GUARDIAN' 
            AND TABLE_NAME = 'USERS'
            ORDER BY ORDINAL_POSITION
        `;
        
        console.log('USERS table columns:');
        userTableCols.forEach(col => {
            console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
        });
        
        // 3. Check for temporal table features (SQL Server system versioning)
        console.log('\n3. Checking for System Versioning:');
        try {
            const temporalInfo = await prisma.$queryRaw`
                SELECT 
                    t.name as table_name,
                    t.temporal_type_desc,
                    t.history_table_id,
                    ht.name as history_table_name
                FROM sys.tables t
                LEFT JOIN sys.tables ht ON t.history_table_id = ht.object_id
                WHERE t.name = 'USERS'
                AND SCHEMA_NAME(t.schema_id) = 'GUARDIAN'
            `;
            
            if (temporalInfo.length > 0) {
                console.log('Temporal table info:', temporalInfo[0]);
                if (temporalInfo[0].temporal_type_desc === 'SYSTEM_VERSIONED_TEMPORAL_TABLE') {
                    console.log('⚠️  USERS table is SYSTEM VERSIONED - this might explain the discrepancy!');
                }
            } else {
                console.log('No temporal table features detected');
            }
        } catch (error) {
            console.log('Could not check temporal features:', error.message);
        }
        
        // 4. Direct comparison - get exact same data with both methods
        console.log('\n4. Direct Data Comparison:');
        
        console.log('\n4a. Via Prisma ORM:');
        const prismaUsers = await prisma.USERS.findMany({
            select: {
                USER_ID: true,
                EMAIL: true,
                STATUS: true,
                CREATE_DATE: true
            },
            orderBy: { USER_ID: 'asc' }
        });
        console.log(`Found ${prismaUsers.length} users via Prisma:`);
        prismaUsers.forEach(user => {
            console.log(`  ID${user.USER_ID}: ${user.EMAIL} (${user.STATUS})`);
        });
        
        console.log('\n4b. Via Raw SQL with explicit schema:');
        try {
            const rawUsers = await prisma.$queryRaw`
                SELECT USER_ID, EMAIL, STATUS, CREATE_DATE
                FROM GUARDIAN.USERS
                ORDER BY USER_ID ASC
            `;
            console.log(`Found ${rawUsers.length} users via raw SQL:`);
            rawUsers.forEach(user => {
                console.log(`  ID${user.USER_ID}: ${user.EMAIL} (${user.STATUS})`);
            });
        } catch (error) {
            console.log('❌ Raw SQL failed:', error.message);
        }
        
        // 5. Try alternative raw SQL approaches
        console.log('\n4c. Via Raw SQL without schema prefix:');
        try {
            const rawUsers2 = await prisma.$queryRaw`
                SELECT USER_ID, EMAIL, STATUS, CREATE_DATE
                FROM USERS
                ORDER BY USER_ID ASC
            `;
            console.log(`Found ${rawUsers2.length} users via raw SQL (no schema):`);
            rawUsers2.forEach(user => {
                console.log(`  ID${user.USER_ID}: ${user.EMAIL} (${user.STATUS})`);
            });
        } catch (error) {
            console.log('❌ Raw SQL without schema failed:', error.message);
        }
        
        // 6. Check current schema context
        console.log('\n5. Current Database Context:');
        const contextInfo = await prisma.$queryRaw`
            SELECT 
                DB_NAME() as current_database,
                SCHEMA_NAME() as current_schema,
                USER_NAME() as current_user,
                @@SERVERNAME as server_name
        `;
        console.log('Database context:', contextInfo[0]);
        
        // 7. Show exactly what your development tools should query
        console.log('\n6. RECOMMENDED QUERIES FOR YOUR DATABASE TOOLS:');
        console.log('===============================================');
        console.log('Connection Details:');
        console.log('  Server: guardian-dev-db.database.windows.net');
        console.log('  Database: GUARDIAN-DEV');
        console.log('  Schema: GUARDIAN');
        console.log('');
        console.log('Queries to try in your database tool:');
        console.log('1. SELECT * FROM GUARDIAN.USERS ORDER BY USER_ID DESC;');
        console.log('2. SELECT * FROM GUARDIAN.COMPANY_INFO WHERE WORKSPACE_NAME IS NOT NULL;');
        console.log('3. SELECT * FROM GUARDIAN.COMPANY ORDER BY CREATED_AT DESC;');
        console.log('');
        console.log('If those fail, try:');
        console.log('1. USE GUARDIAN-DEV; SELECT * FROM GUARDIAN.USERS;');
        console.log('2. Check if your tool is connecting to the right database');
        console.log('3. Verify schema permissions in your database tool');
        
    } catch (error) {
        console.error('❌ Investigation error:', error.message);
        console.error('Full error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateToolingIssue();