// Check FORMS_INSTANCE_VALUES data
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkInstanceValues() {
    try {
        console.log('🔍 Checking FORMS_INSTANCE_VALUES data...');
        
        // Check recent form instances
        const instances = await prisma.$queryRaw`
            SELECT TOP 5 * FROM GUARDIAN.FORMS_INSTANCE 
            ORDER BY CREATE_DATE DESC
        `;
        
        console.log('📋 Recent form instances:');
        instances.forEach(instance => {
            console.log(`  Instance ID: ${instance.FORM_INSTANCE_ID}, Request: ${instance.REQUEST_ID}, Form: ${instance.FORM_ID}, Status: ${instance.STATUS}`);
        });
        
        // Check values for these instances
        if (instances.length > 0) {
            const instanceId = instances[0].FORM_INSTANCE_ID;
            const values = await prisma.$queryRaw`
                SELECT * FROM GUARDIAN.FORMS_INSTANCE_VALUES 
                WHERE FORM_INSTANCE_ID = ${instanceId}
            `;
            
            console.log(`📊 Values for instance ${instanceId}:`);
            if (values.length === 0) {
                console.log('  ❌ No values found for this instance');
            } else {
                values.forEach(value => {
                    console.log(`  Field ${value.FIELD_ID}: "${value.VALUE}"`);
                });
            }
        }
        
        // Check total count of all values
        const totalValues = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM GUARDIAN.FORMS_INSTANCE_VALUES
        `;
        
        console.log(`📈 Total values in database: ${totalValues[0].count}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkInstanceValues();