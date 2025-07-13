import { sendVerificationEmail } from './src/utils/resend-email.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmail() {
  console.log('🧪 Testing Resend email functionality...');
  console.log('📧 Sender email:', process.env.EMAIL_FROM);
  
  // Get email from command line or use default
  const testEmail = process.argv[2] || 'your-email@example.com';
  
  if (testEmail === 'your-email@example.com') {
    console.log('❌ Please provide your email address as an argument:');
    console.log('   node test-resend-email.js your-email@example.com');
    process.exit(1);
  }
  
  console.log('📨 Sending test verification email to:', testEmail);
  
  // Generate a test verification code
  const testCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log('🔢 Test verification code:', testCode);
  
  try {
    const result = await sendVerificationEmail(testEmail, testCode);
    
    if (result) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Check your email inbox for the verification code.');
    } else {
      console.log('❌ Failed to send test email.');
      console.log('🔍 Check your Resend API key and email configuration.');
    }
  } catch (error) {
    console.error('❌ Error during email test:', error);
  }
}

testEmail();