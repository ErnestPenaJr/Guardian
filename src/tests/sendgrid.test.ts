/**
 * SendGrid Integration Test
 * 
 * This test verifies that the SendGrid integration is working correctly
 * for both email validation and sending verification codes.
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import sendgrid from '../utils/sendgrid';

const TEST_EMAIL = 'ernest@shieldlytics.com';

/**
 * Test email validation with SendGrid
 */
async function testEmailValidation() {
  console.log('🧪 Testing SendGrid Email Validation API...');
  console.log(`Testing with email: ${TEST_EMAIL}`);
  
  try {
    const result = await sendgrid.validateEmail(TEST_EMAIL, 'register');
    
    console.log('✅ Email validation test completed');
    console.log('Result:', result);
    
    if (result.valid) {
      console.log('✅ Email is valid');
    } else {
      console.log('❌ Email is invalid');
      console.log('Reason:', result.reason);
    }
    
    return result.valid;
  } catch (error) {
    console.error('❌ Email validation test failed');
    console.error('Error:', error);
    return false;
  }
}

/**
 * Test sending verification code with SendGrid
 */
async function testSendVerificationCode() {
  console.log('\n🧪 Testing SendGrid Email Sending...');
  console.log(`Sending verification code to: ${TEST_EMAIL}`);
  
  try {
    // Generate a verification code
    const verificationCode = sendgrid.generateVerificationCode();
    console.log(`Generated verification code: ${verificationCode}`);
    
    // Send the verification code
    const emailSent = await sendgrid.sendVerificationEmail(TEST_EMAIL, verificationCode);
    
    if (emailSent) {
      console.log('✅ Verification code sent successfully');
    } else {
      console.log('❌ Failed to send verification code');
    }
    
    return emailSent;
  } catch (error) {
    console.error('❌ Verification code test failed');
    console.error('Error:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=== SendGrid Integration Tests ===');
  console.log('Testing with API key:', process.env.VITE_SENDGRID_API_KEY ? '✅ API key is set' : '❌ API key is not set');
  
  // Test email validation
  const validationResult = await testEmailValidation();
  
  // Test sending verification code if validation passed
  if (validationResult) {
    await testSendVerificationCode();
  }
  
  console.log('\n=== Tests Completed ===');
}

// Run the tests
runAllTests();

export {};
