// Check if FORMS_FIELDS table exists and has FORM_ID column
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFormsFields() {
    try {
        console.log('🔍 Checking FORMS_FIELDS table...');
        
        // Check if FORMS_FIELDS table exists
        const tables = await prisma.$queryRaw`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'GUARDIAN' 
            AND TABLE_NAME = 'FORMS_FIELDS'
        `;
        
        console.log('📋 FORMS_FIELDS table exists:', tables.length > 0);
        
        if (tables.length > 0) {
            // Check columns in FORMS_FIELDS table
            const columns = await prisma.$queryRaw`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'GUARDIAN' 
                AND TABLE_NAME = 'FORMS_FIELDS'
                ORDER BY ORDINAL_POSITION
            `;
            
            console.log('📋 FORMS_FIELDS columns:');
            columns.forEach(col => {
                console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
            });
            
            // Test a simple query
            console.log('🧪 Testing FORMS_FIELDS query...');
            const testQuery = await prisma.$queryRaw`
                SELECT TOP 3 * FROM GUARDIAN.FORMS_FIELDS
            `;
            console.log('✅ Test query result:', testQuery);
            
        } else {
            console.log('❌ FORMS_FIELDS table does not exist!');
            
            // Check what form-related tables exist
            const formTables = await prisma.$queryRaw`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'GUARDIAN' 
                AND TABLE_NAME LIKE '%FORM%'
            `;
            
            console.log('📋 Available form-related tables:');
            formTables.forEach(table => {
                console.log(`  - ${table.TABLE_NAME}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkFormsFields();