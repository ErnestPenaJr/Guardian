// Test form submission with actual field values
const axios = require('axios');

async function testFormSubmission() {
    try {
        console.log('🧪 Testing form submission...');
        
        // First, login to get a valid JWT token
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'Ernest@shieldlytics.com',
            password: 'Guardian123!'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        // Test form submission with actual field values
        const requestId = 115; // Use the recently created request
        const fieldValues = {
            "1000": "Test First Name",
            "1001": "Test Last Name", 
            "1002": "test@example.com"
        };
        
        console.log('📝 Submitting test form data...');
        console.log('Field values:', fieldValues);
        
        const formResponse = await axios.post(
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
        
        console.log('✅ Form submission response:', formResponse.data);
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testFormSubmission();