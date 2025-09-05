import axios from 'axios';

async function testWorkspaceRegistration() {
    try {
        console.log('🧪 Testing workspace registration...');
        
        // Step 1: Register with email
        const testEmail = `test-workspace-${Date.now()}@example.com`;
        console.log(`📧 Step 1: Register email: ${testEmail}`);
        
        const registerResponse = await axios.post('http://localhost:3001/api/register', {
            email: testEmail
        });
        console.log('✅ Registration response:', registerResponse.data);
        
        // Step 2: Verify email (use the verification code from the response)
        const verificationCode = registerResponse.data.verificationCode;
        console.log(`🔑 Step 2: Verify with code: ${verificationCode}`);
        
        const verifyResponse = await axios.post('http://localhost:3001/api/verify-email', {
            email: testEmail,
            verificationCode: verificationCode
        });
        console.log('✅ Verification response:', verifyResponse.data);
        
        // Step 3: Complete registration with custom workspace name
        const customWorkspace = 'MY-CUSTOM-WORKSPACE-TEST';
        console.log(`🏢 Step 3: Complete registration with workspace: ${customWorkspace}`);
        
        const completeResponse = await axios.post('http://localhost:3001/api/complete-registration', {
            email: testEmail,
            password: 'TestPassword123!',
            fullName: 'Test User',
            workspaceName: customWorkspace,
            role: 'Analyst',
            teamSize: '2-5',
            companySize: '50-99'
        });
        console.log('✅ Complete registration response:', completeResponse.data);
        
        // Step 4: Check what was actually saved to database
        console.log('\n🔍 What was saved to database:');
        console.log('Expected workspace name:', customWorkspace);
        console.log('Response shows call sign:', completeResponse.data.callSign);
        
        if (completeResponse.data.callSign === customWorkspace) {
            console.log('✅ SUCCESS: Custom workspace name was saved correctly!');
        } else {
            console.log('❌ ISSUE: Custom workspace name was NOT saved correctly!');
            console.log('Expected:', customWorkspace);
            console.log('Got:', completeResponse.data.callSign);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.response ? error.response.data : error.message);
    }
}

testWorkspaceRegistration();