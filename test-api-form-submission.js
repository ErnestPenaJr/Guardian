// Test the actual API form submission endpoint
const axios = require('axios');

async function testApiFormSubmission() {
    try {
        console.log('🧪 Testing API form submission endpoint...');
        
        // Use hardcoded JWT token from the logs (from user 1111)
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExMTEsImNvbXBhbnlJZCI6MjYsInVzZXJSb2xlSWRzIjpbNiw2XSwiaWF0IjoxNzIyNDQ4MDMzLCJleHAiOjE3MjI1MzQ0MzN9.9SZGXxo2K2RP5qV36P8UWQhJEGC8-klzrNXUKHTy_Qg';
        
        // Test with the most recent request (116) and actual field IDs from the test above
        const requestId = 116;
        const fieldValues = {
            "1009": "Chase Bank",
            "1010": "123456789", 
            "1039": "John Doe"
        };
        
        console.log(`📝 Testing form submission for request ${requestId}...`);
        console.log('Field values to submit:', fieldValues);
        
        const response = await axios.post(
            `http://localhost:3001/api/requests/${requestId}/form/submit`,
            {
                fieldValues: fieldValues,
                isComplete: false,
                isDraft: true
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ API Response:', response.data);
        
        // Verify the values were saved by checking the database
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const savedValues = await prisma.$queryRaw`
            SELECT fiv.FIELD_ID, fiv.VALUE, f.FIELD_NAME, fi.REQUEST_ID
            FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
            INNER JOIN GUARDIAN.FORMS_INSTANCE fi ON fiv.FORM_INSTANCE_ID = fi.FORM_INSTANCE_ID
            INNER JOIN GUARDIAN.FIELDS f ON fiv.FIELD_ID = f.FIELD_ID
            WHERE fi.REQUEST_ID = ${requestId}
            ORDER BY fiv.FIELD_ID
        `;
        
        console.log('📊 Verification - Values saved via API:');
        if (savedValues.length === 0) {
            console.log('  ❌ No values found in database');
        } else {
            savedValues.forEach(value => {
                console.log(`  ✅ Field ${value.FIELD_ID} (${value.FIELD_NAME}): "${value.VALUE}"`);
            });
        }
        
        await prisma.$disconnect();
        
    } catch (error) {
        console.error('❌ API Test failed:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.log('💡 Token may have expired. Try logging in through the frontend first.');
        }
    }
}

testApiFormSubmission();