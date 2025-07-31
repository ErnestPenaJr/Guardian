// Test the exact server form submission logic
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testServerFormLogic() {
    try {
        console.log('🧪 Testing server form submission logic...');
        
        // Simulate the exact server logic from server-production.js
        const requestId = 116;
        const companyId = 26;
        const userId = 1111;
        const fieldValues = {
            "1009": "Wells Fargo",
            "1010": "987654321", 
            "1039": "Jane Smith"
        };
        const isComplete = false;
        const isDraft = true;
        
        console.log(`📝 Simulating form submission for request ${requestId}`);
        console.log('📋 Field values:', JSON.stringify(fieldValues, null, 2));
        console.log(`📊 Submission type: ${isComplete ? 'Complete' : isDraft ? 'Draft' : 'Auto-save'}`);
        
        // Step 1: Get request details (from server logic)
        const requests = await prisma.$queryRaw`
            SELECT r.REQUEST_ID, r.FORM_ID, r.ASSIGNED_ID, r.COMPANY_ID
            FROM GUARDIAN.REQUESTS r
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${companyId}
        `;
        
        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found for company ${companyId}`);
            return;
        }
        
        const request = requests[0];
        console.log('📋 Request details:', request);
        
        // Step 2: Look for existing form instance
        const existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${companyId}
            ORDER BY CREATE_DATE DESC
        `;
        
        let formInstanceId;
        
        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            console.log(`📋 Using existing form instance: ${formInstanceId}`);
            
            // Update existing instance
            if (isComplete) {
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET SUBMITTED_DATE = GETDATE(), UPDATE_USER_ID = ${userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`✅ Marked form instance as completed`);
            } else {
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET UPDATE_USER_ID = ${userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`📝 Updated form instance as in-progress`);
            }
        } else {
            console.log('📋 No existing form instance found, creating new one...');
            
            // Create new form instance  
            if (isComplete) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || userId}, ${companyId}, GETDATE(), ${userId}, ${userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new completed form instance`);
            } else {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || userId}, ${companyId}, NULL, ${userId}, ${userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new draft form instance`);
            }
            
            // Get the new instance ID
            const newInstances = await prisma.$queryRaw`
                SELECT TOP 1 FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId} ORDER BY CREATE_DATE DESC
            `;
            formInstanceId = newInstances[0].FORM_INSTANCE_ID;
        }
        
        console.log(`📋 Final form instance ID: ${formInstanceId}`);
        
        // Step 3: Clear existing field values
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
            WHERE FORM_INSTANCE_ID = ${formInstanceId}
        `;
        console.log('🗑️ Cleared existing field values');
        
        // Step 4: Insert new field values
        let savedCount = 0;
        for (const [fieldId, value] of Object.entries(fieldValues)) {
            if (value !== null && value !== undefined && value !== '') {
                console.log(`💾 Inserting field ${fieldId}: "${value}"`);
                
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES (
                        FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${formInstanceId}, ${parseInt(fieldId)}, ${String(value)}, ${userId}, ${userId}, GETDATE(), GETDATE()
                    )
                `;
                savedCount++;
                console.log(`✅ Successfully inserted field ${fieldId}`);
            }
        }
        
        // Step 5: Determine final status
        const finalStatus = isComplete ? 'completed' : (savedCount > 0 ? 'in_progress' : 'new');
        const statusMessage = isComplete ? 'Form completed successfully' : 
                            isDraft ? 'Draft saved successfully' : 
                            'Form data saved successfully';
        
        console.log(`✅ Form submitted successfully for request ${requestId}: ${savedCount} field values saved (Status: ${finalStatus})`);
        console.log(`📋 Status message: ${statusMessage}`);
        
        // Step 6: Verify the results
        const finalValues = await prisma.$queryRaw`
            SELECT fiv.FIELD_ID, fiv.VALUE, f.FIELD_NAME
            FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
            INNER JOIN GUARDIAN.FIELDS f ON fiv.FIELD_ID = f.FIELD_ID
            WHERE fiv.FORM_INSTANCE_ID = ${formInstanceId}
        `;
        
        console.log('📊 Final verification - Saved values:');
        finalValues.forEach(value => {
            console.log(`  ✅ Field ${value.FIELD_ID} (${value.FIELD_NAME}): "${value.VALUE}"`);
        });
        
    } catch (error) {
        console.error('❌ Server logic test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testServerFormLogic();