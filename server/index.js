import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Setup dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const app = express();
const port = process.env.PORT || 3001;

// Configure SendGrid with API key
const SENDGRID_API_KEY = process.env.VITE_SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  sgClient.setApiKey(SENDGRID_API_KEY);
} else {
  console.error('SendGrid API key is not set. Email functionality will not work.');
}

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Endpoint to validate email
app.post('/api/validate-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        valid: false, 
        reason: 'Invalid email format' 
      });
    }
    
    // SendGrid validation
    try {
      const request = {
        url: '/v3/validations/email',
        method: 'POST',
        body: {
          email,
          source: 'Guardian MVP'
        }
      };
      
      const [response] = await sgClient.request(request);
      const responseBody = response.body;
      
      return res.json({
        valid: responseBody.result.verdict === 'Valid',
        reason: responseBody.result.verdict !== 'Valid' ? responseBody.result.reason : undefined
      });
    } catch (error) {
      console.error('SendGrid validation error:', error);
      
      // Fall back to basic validation if API fails
      return res.json({
        valid: true,
        reason: 'API error, but format is valid'
      });
    }
  } catch (error) {
    console.error('Email validation error:', error);
    return res.status(500).json({ error: 'Server error during email validation' });
  }
});

// Endpoint to send verification email
app.post('/api/send-verification-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    if (!email || !verificationCode) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    
    const msg = {
      to: email,
      from: 'support@shieldlytics.com', // Use your verified sender
      subject: 'Verify Your Guardian Account',
      text: `Your verification code is: ${verificationCode}. This code will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Verify Your Guardian Account</h2>
          <p>Thank you for signing up with Guardian. To complete your registration, please use the verification code below:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h3 style="margin: 0; font-size: 24px; letter-spacing: 5px;">${verificationCode}</h3>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this verification code, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777;">
            &copy; ${new Date().getFullYear()} Guardian. All rights reserved.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error sending verification email:', error);
    
    if (error.response) {
      console.error('SendGrid API Error Details:', error.response.body);
    }
    
    return res.status(500).json({ 
      error: 'Failed to send verification email',
      details: error.message 
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
