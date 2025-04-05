/**
 * SendGrid Test Runner
 * 
 * This script compiles and runs the SendGrid integration tests.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../../');

// Load environment variables from .env file
dotenv.config({ path: path.join(projectRoot, '.env') });

console.log('Starting SendGrid integration tests...');

try {
  // Compile the TypeScript test file
  console.log('Compiling test file...');
  
  // Create a temporary JavaScript file
  const tempJsFile = path.join(__dirname, 'sendgrid-test-compiled.js');
  
  // Replace import.meta.env with process.env for Node.js compatibility
  const testFileContent = fs.readFileSync(path.join(__dirname, 'sendgrid.test.ts'), 'utf8')
    .replace(/import\.meta\.env\.VITE_SENDGRID_API_KEY/g, 'process.env.VITE_SENDGRID_API_KEY');
  
  // Replace ES module imports with compatible imports
  const modifiedContent = testFileContent
    .replace(/import sendgrid from '..\/utils\/sendgrid';/, `
import client from '@sendgrid/client';
import * as mailModule from '@sendgrid/mail';

// Initialize SendGrid client with API key from environment variables
const SENDGRID_API_KEY = process.env.VITE_SENDGRID_API_KEY || '';
client.setApiKey(SENDGRID_API_KEY);

// Verification code expiration time in milliseconds (15 minutes)
const VERIFICATION_CODE_EXPIRY = 15 * 60 * 1000;

/**
 * Validates an email address using SendGrid's Email Validation API
 */
const validateEmail = async (email) => {
  try {
    // SendGrid Email Validation API endpoint
    const request = {
      url: '/v3/validations/email',
      method: 'POST',
      body: {
        email,
        source: 'Guardian MVP'
      }
    };

    const [response] = await client.request(request);
    const data = response.body;

    // Check if the email is valid based on SendGrid's response
    if (response.statusCode === 200) {
      // Determine if the email is valid based on SendGrid's verdict
      const isValid = data.result.verdict === 'Valid';
      let reason = '';

      if (!isValid) {
        // Provide a reason why the email is invalid
        if (data.result.verdict === 'Risky') {
          reason = 'This email address appears to be risky or suspicious.';
        } else if (data.result.verdict === 'Invalid') {
          reason = 'This email address is invalid.';
        } else {
          reason = 'This email address cannot be validated.';
        }
      }

      return {
        isValid,
        reason
      };
    } else {
      console.error('SendGrid validation error:', response.body);
      return {
        isValid: false,
        reason: 'Unable to validate email at this time.'
      };
    }
  } catch (error) {
    console.error('Error validating email with SendGrid:', error);
    return {
      isValid: false,
      reason: 'An error occurred during email validation.'
    };
  }
};

/**
 * Sends a verification code email to the user
 */
const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const mail = mailModule.default;
    mail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: 'noreply@guardian-mvp.com', // Change to your verified sender
      subject: 'Verify Your Guardian Account',
      text: \`Your verification code is: \${verificationCode}. This code will expire in 15 minutes.\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Guardian Account</h2>
          <p>Thank you for registering with Guardian. Please use the following verification code to complete your registration:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            \${verificationCode}
          </div>
          <p style="margin-top: 20px;">This code will expire in 15 minutes.</p>
          <p>If you did not request this verification, please ignore this email.</p>
        </div>
      \`
    };

    await mail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

/**
 * Generates a random 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendgrid = {
  validateEmail,
  sendVerificationEmail,
  generateVerificationCode,
  VERIFICATION_CODE_EXPIRY
};
    `)
    .replace(/export \{\};/, '');
  
  fs.writeFileSync(tempJsFile, modifiedContent);
  
  // Run the test
  console.log('Running tests...');
  execSync(`node ${tempJsFile}`, { stdio: 'inherit' });
  
  // Clean up
  fs.unlinkSync(tempJsFile);
  
  console.log('Tests completed successfully');
} catch (error) {
  console.error('Error running tests:', error.message);
  process.exit(1);
}
