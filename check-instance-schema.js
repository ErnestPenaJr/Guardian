// Check FORMS_INSTANCE table schema
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkInstanceSchema() {
    try {
        console.log('🔍 Checking FORMS_INSTANCE table schema...');
        
        // Check table columns
        const instanceColumns = await prisma.$queryRaw`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN' 
            AND TABLE_NAME = 'FORMS_INSTANCE'
            ORDER BY ORDINAL_POSITION
        `;
        
        console.log('📋 FORMS_INSTANCE columns:');
        instanceColumns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check values table columns
        const valuesColumns = await prisma.$queryRaw`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN' 
            AND TABLE_NAME = 'FORMS_INSTANCE_VALUES'
            ORDER BY ORDINAL_POSITION
        `;
        
        console.log('📋 FORMS_INSTANCE_VALUES columns:');
        valuesColumns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check recent instance with all columns
        const fullInstance = await prisma.$queryRaw`
            SELECT * FROM GUARDIAN.FORMS_INSTANCE 
            WHERE FORM_INSTANCE_ID = 1047
        `;
        
        console.log('📊 Full instance 1047 data:');
        console.log(fullInstance[0]);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkInstanceSchema();