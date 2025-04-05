/**
 * SendGrid Integration Test
 * 
 * This test verifies that the SendGrid integration is working correctly
 * for sending verification codes.
 */

import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import sgMail from '@sendgrid/mail';

// Setup environment
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

// Get email from command line arguments or use default
const TEST_EMAIL = process.argv[2] || 'support@shieldlytics.com';
const SENDER_EMAIL = 'support@shieldlytics.com'; // Use the verified sender email
const API_KEY = process.env.VITE_SENDGRID_API_KEY;

if (!API_KEY) {
  console.error('❌ SendGrid API key is not set in .env file');
  process.exit(1);
}

// Initialize SendGrid
sgMail.setApiKey(API_KEY);

/**
 * Generates a random 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends a verification code email to the user
 */
async function sendVerificationEmail(email, verificationCode) {
  try {
    const msg = {
      to: email,
      from: SENDER_EMAIL, // Use the verified sender email
      subject: 'Verify Your Guardian Account',
      text: `Your verification code is: ${verificationCode}. This code will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Guardian Account</h2>
          <p>Thank you for registering with Guardian. Please use the following verification code to complete your registration:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            ${verificationCode}
          </div>
          <p style="margin-top: 20px;">This code will expire in 15 minutes.</p>
          <p>If you did not request this verification, please ignore this email.</p>
        </div>
      `
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
    return false;
  }
}

/**
 * Test sending verification code with SendGrid
 */
async function testSendVerificationCode() {
  console.log('🧪 Testing SendGrid Email Sending...');
  console.log(`Sending verification code to: ${TEST_EMAIL}`);
  console.log(`Using sender email: ${SENDER_EMAIL}`);
  
  try {
    // Generate a verification code
    const verificationCode = generateVerificationCode();
    console.log(`Generated verification code: ${verificationCode}`);
    
    // Send the verification code
    const emailSent = await sendVerificationEmail(TEST_EMAIL, verificationCode);
    
    if (emailSent) {
      console.log('✅ Verification code sent successfully');
      return true;
    } else {
      console.log('❌ Failed to send verification code');
      return false;
    }
  } catch (error) {
    console.error('❌ Verification code test failed');
    console.error('Error:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTest() {
  console.log('=== SendGrid Email Test ===');
  console.log('Testing with API key:', API_KEY ? '✅ API key is set' : '❌ API key is not set');
  
  // Test sending verification code
  const result = await testSendVerificationCode();
  
  console.log('\n=== Test Completed ===');
  console.log(result ? '✅ Test passed successfully' : '❌ Test failed');
}

// Run the test
runTest();
