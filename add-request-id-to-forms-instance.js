// Add REQUEST_ID column to FORMS_INSTANCE table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addRequestIdColumn() {
    try {
        console.log('🔧 Adding REQUEST_ID column to FORMS_INSTANCE table...');
        
        // First check if column already exists
        const columnExists = await prisma.$queryRaw`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN' 
            AND TABLE_NAME = 'FORMS_INSTANCE'
            AND COLUMN_NAME = 'REQUEST_ID'
        `;
        
        if (columnExists.length > 0) {
            console.log('✅ REQUEST_ID column already exists in FORMS_INSTANCE table');
            return;
        }
        
        // Add the REQUEST_ID column
        await prisma.$executeRaw`
            ALTER TABLE GUARDIAN.FORMS_INSTANCE 
            ADD REQUEST_ID int NULL
        `;
        
        console.log('✅ Successfully added REQUEST_ID column to FORMS_INSTANCE');
        
        // Add foreign key constraint
        await prisma.$executeRaw`
            ALTER TABLE GUARDIAN.FORMS_INSTANCE
            ADD CONSTRAINT FK_FORMS_INSTANCE_REQUEST
            FOREIGN KEY (REQUEST_ID) REFERENCES GUARDIAN.REQUESTS(REQUEST_ID)
        `;
        
        console.log('✅ Successfully added foreign key constraint');
        
        // Update existing instances to link them to requests where possible
        // This will match based on FORM_ID and ASSIGNED_ID
        const updateResult = await prisma.$executeRaw`
            UPDATE fi 
            SET fi.REQUEST_ID = r.REQUEST_ID
            FROM GUARDIAN.FORMS_INSTANCE fi
            INNER JOIN GUARDIAN.REQUESTS r ON fi.FORM_ID = r.FORM_ID 
                AND fi.ASSIGNED_ID = r.ASSIGNED_ID 
                AND fi.COMPANY_ID = r.COMPANY_ID
            WHERE fi.REQUEST_ID IS NULL
        `;
        
        console.log(`✅ Updated existing form instances with request relationships`);
        
        // Check results
        const updatedInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID, REQUEST_ID, FORM_ID 
            FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID IS NOT NULL
        `;
        
        console.log(`📊 Found ${updatedInstances.length} form instances now linked to requests`);
        updatedInstances.forEach(instance => {
            console.log(`  Instance ${instance.FORM_INSTANCE_ID} -> Request ${instance.REQUEST_ID} (Form ${instance.FORM_ID})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

addRequestIdColumn();