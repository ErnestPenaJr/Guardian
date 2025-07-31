// Test form field values insertion into FORMS_INSTANCE_VALUES
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFieldValuesInsertion() {
    try {
        console.log('🧪 Testing form field values insertion...');
        
        // First, let's check what form fields are available for form 1006
        const formFields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, ff.IS_REQUIRED
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = 1006
            ORDER BY ff.SORT_ORDER
        `;
        
        console.log('📋 Available form fields for Form 1006:');
        formFields.forEach(field => {
            console.log(`  - Field ${field.FIELD_ID}: ${field.FIELD_NAME} (Required: ${field.IS_REQUIRED})`);
        });
        
        // Use the most recent request (116)
        const requestId = 116;
        const companyId = 26;
        const userId = 1111;
        
        // Check if form instance exists for this request
        let existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
            ORDER BY CREATE_DATE DESC
        `;
        
        let formInstanceId;
        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            console.log(`📋 Using existing form instance: ${formInstanceId}`);
        } else {
            // Create form instance manually for testing
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.FORMS_INSTANCE (
                    REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                ) VALUES (
                    ${requestId}, 1006, ${userId}, ${companyId}, NULL, ${userId}, ${userId}, GETDATE(), GETDATE()
                )
            `;
            
            const newInstances = await prisma.$queryRaw`
                SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId} ORDER BY CREATE_DATE DESC
            `;
            formInstanceId = newInstances[0].FORM_INSTANCE_ID;
            console.log(`📋 Created new form instance: ${formInstanceId}`);
        }
        
        // Clear existing values for this instance
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
            WHERE FORM_INSTANCE_ID = ${formInstanceId}
        `;
        console.log('🗑️ Cleared existing values');
        
        // Test inserting field values using the actual form fields
        const testFieldValues = {};
        formFields.forEach((field, index) => {
            testFieldValues[field.FIELD_ID] = `Test Value ${index + 1} for ${field.FIELD_NAME}`;
        });
        
        console.log('📝 Test field values to insert:');
        console.log(testFieldValues);
        
        // Insert field values one by one (simulating the server logic)
        let savedCount = 0;
        for (const [fieldId, value] of Object.entries(testFieldValues)) {
            if (value !== null && value !== undefined && value !== '') {
                console.log(`💾 Inserting: Field ${fieldId} = "${value}"`);
                
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES (
                        FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${formInstanceId}, ${parseInt(fieldId)}, ${String(value)}, ${userId}, ${userId}, GETDATE(), GETDATE()
                    )
                `;
                savedCount++;
                console.log(`✅ Inserted field ${fieldId}`);
            }
        }
        
        console.log(`✅ Successfully inserted ${savedCount} field values`);
        
        // Verify the insertion
        const insertedValues = await prisma.$queryRaw`
            SELECT fiv.FIELD_ID, fiv.VALUE, f.FIELD_NAME
            FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
            INNER JOIN GUARDIAN.FIELDS f ON fiv.FIELD_ID = f.FIELD_ID
            WHERE fiv.FORM_INSTANCE_ID = ${formInstanceId}
        `;
        
        console.log('📊 Verification - Values in database:');
        insertedValues.forEach(value => {
            console.log(`  ✅ Field ${value.FIELD_ID} (${value.FIELD_NAME}): "${value.VALUE}"`);
        });
        
        // Check total count in FORMS_INSTANCE_VALUES table
        const totalCount = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM GUARDIAN.FORMS_INSTANCE_VALUES
        `;
        
        console.log(`📈 Total values in FORMS_INSTANCE_VALUES table: ${totalCount[0].count}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testFieldValuesInsertion();