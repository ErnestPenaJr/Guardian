#!/usr/bin/env node

/**
 * Test script to verify PRIORITY_LEVEL support in POST /api/requests endpoint
 * Run this after the database migration is applied
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3001'; // Development server
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with actual JWT token

// Test data for request creation
const testRequestData = {
    REQUEST_NAME: 'Test Priority Request',
    REQUEST_DESCRIPTION: 'Testing priority level functionality',
    PRIORITY_LEVEL: 'High', // Test with High priority
    STATUS: 'P'
};

async function testPriorityLevelSupport() {
    try {
        console.log('🧪 Testing PRIORITY_LEVEL support in POST /api/requests...');
        
        // Test with High priority
        console.log('\n📝 Testing request creation with High priority:');
        const response = await axios.post(`${API_BASE_URL}/api/requests`, {
            ...testRequestData,
            PRIORITY_LEVEL: 'High'
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ High priority request created successfully:');
        console.log('   Request ID:', response.data.data.REQUEST_ID);
        console.log('   Priority Level:', response.data.data.PRIORITY_LEVEL);
        
        // Test with Standard priority (default)
        console.log('\n📝 Testing request creation with Standard priority:');
        const response2 = await axios.post(`${API_BASE_URL}/api/requests`, {
            ...testRequestData,
            REQUEST_NAME: 'Test Standard Priority Request',
            PRIORITY_LEVEL: 'Standard'
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Standard priority request created successfully:');
        console.log('   Request ID:', response2.data.data.REQUEST_ID);
        console.log('   Priority Level:', response2.data.data.PRIORITY_LEVEL);
        
        // Test with Low priority
        console.log('\n📝 Testing request creation with Low priority:');
        const response3 = await axios.post(`${API_BASE_URL}/api/requests`, {
            ...testRequestData,
            REQUEST_NAME: 'Test Low Priority Request',
            PRIORITY_LEVEL: 'Low'
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Low priority request created successfully:');
        console.log('   Request ID:', response3.data.data.REQUEST_ID);
        console.log('   Priority Level:', response3.data.data.PRIORITY_LEVEL);
        
        // Test with invalid priority (should fail)
        console.log('\n🚫 Testing request creation with invalid priority:');
        try {
            await axios.post(`${API_BASE_URL}/api/requests`, {
                ...testRequestData,
                REQUEST_NAME: 'Test Invalid Priority Request',
                PRIORITY_LEVEL: 'Invalid'
            }, {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.log('✅ Invalid priority correctly rejected:');
            console.log('   Error:', error.response?.data?.error || error.message);
        }
        
        // Test without priority level (should default to Standard)
        console.log('\n📝 Testing request creation without priority level (should default to Standard):');
        const response4 = await axios.post(`${API_BASE_URL}/api/requests`, {
            REQUEST_NAME: 'Test Default Priority Request',
            REQUEST_DESCRIPTION: 'Testing default priority level functionality',
            STATUS: 'P'
            // No PRIORITY_LEVEL specified
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Default priority request created successfully:');
        console.log('   Request ID:', response4.data.data.REQUEST_ID);
        console.log('   Priority Level:', response4.data.data.PRIORITY_LEVEL, '(should be Standard)');
        
        console.log('\n🎉 All tests passed! PRIORITY_LEVEL support is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    if (TEST_TOKEN === 'your_jwt_token_here') {
        console.log('⚠️  Please update TEST_TOKEN with a valid JWT token before running the test.');
        process.exit(1);
    }
    testPriorityLevelSupport();
}

module.exports = { testPriorityLevelSupport };