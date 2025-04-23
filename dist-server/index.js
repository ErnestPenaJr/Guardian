import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
const SENDGRID_API_KEY = process.env.VITE_SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}
else {
    console.error('SendGrid API key is not set. Email functionality will not work.');
}
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
// Zod schema for registration
const registerSchema = z.object({
    email: z.string().email(),
});
// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const parseResult = registerSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
        }
        const { email } = parseResult.data;
        // Check if user already exists
        const existingUser = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        // Generate a 6-digit numeric verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Hash the verification code for secure storage
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
        // Save user and hashed token
        const user = await prisma.uSERS.create({
            data: {
                EMAIL: email,
                EMAIL_VALIDATION_TOKEN: hashedCode,
                EMAIL_VALIDATED: false,
                STATUS: 'P',
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date(),
                FIRST_NAME: '',
                LAST_NAME: '',
            },
        });
        // Send verification email with the plain code
        await sendVerificationEmail(email, verificationCode);
        return res.status(201).json({ message: 'Registration successful. Please check your email for verification.', userId: user.USER_ID });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/send-verification-email
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
          <h2 style="color: #2EBCBC;">Guardian Email Verification</h2>
          <p>Thank you for registering. Please use the following code to verify your email address:</p>
          <div style="background: #f4f4f4; padding: 10px 20px; margin: 20px 0; border-radius: 4px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; letter-spacing: 5px;">${verificationCode}</h3>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this verification code, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777;">&copy; ${new Date().getFullYear()} Guardian. All rights reserved.</p>
        </div>
      `
        };
        await sgMail.send(msg);
        return res.json({ success: true });
    }
    catch (error) {
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
// POST /api/validate-email
app.post('/api/validate-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ valid: false, reason: 'Invalid email format' });
        }
        // Optionally: check if email already exists in DB
        const existingUser = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        if (existingUser) {
            return res.status(409).json({ valid: false, reason: 'Email already registered' });
        }
        // If you want to integrate SendGrid validation, add here
        return res.json({ valid: true });
    }
    catch (error) {
        console.error('Email validation error:', error);
        return res.status(500).json({ error: 'Server error during email validation' });
    }
});
// POST /api/verify-email
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        if (!email || !verificationCode) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }
        // Ensure verification code is exactly 6 digits
        if (!/^\d{6}$/.test(verificationCode)) {
            return res.status(400).json({ error: 'Verification code must be a 6-digit number' });
        }
        // Hash the provided code
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        // Find the user and check code match
        const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.EMAIL_VALIDATION_TOKEN !== hashedCode) {
            return res.status(401).json({ error: 'Invalid verification code' });
        }
        // Mark email as validated
        await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                EMAIL_VALIDATED: true,
                STATUS: 'A', // Activate user
                UPDATE_DATE: new Date(),
            },
        });
        return res.json({ success: true, message: 'Email verified successfully.' });
    }
    catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({ error: 'Server error during email verification' });
    }
});
async function sendVerificationEmail(email, verificationToken) {
    try {
        console.log('[SendGrid] Attempting to send verification email...');
        console.log(`[SendGrid] To: ${email}`);
        console.log(`[SendGrid] Using API Key: ${!!SENDGRID_API_KEY}`);
        const msg = {
            to: email,
            from: 'support@shieldlytics.com', // Use your verified sender
            subject: 'Verify Your Guardian Account',
            text: `Your verification code is: ${verificationToken}. This code will expire in 15 minutes.`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #2EBCBC;">Guardian Email Verification</h2>
          <p>Thank you for registering. Please use the following code to verify your email address:</p>
          <div style="background: #f4f4f4; padding: 10px 20px; margin: 20px 0; border-radius: 4px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; letter-spacing: 5px;">${verificationToken}</h3>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this verification code, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777;">&copy; ${new Date().getFullYear()} Guardian. All rights reserved.</p>
        </div>
      `
        };
        await sgMail.send(msg);
        console.log('[SendGrid] Email sent successfully.');
    }
    catch (error) {
        console.error('[SendGrid] Error sending verification email:', error);
        if (error.response) {
            console.error('[SendGrid] API Error Details:', error.response.body);
        }
    }
}
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
