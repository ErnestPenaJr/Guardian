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
import bcrypt from 'bcryptjs';
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
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        // Generate a 6-digit numeric verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Hash the verification code for secure storage
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
        // Hash the password (empty string in this case)
        const passwordHash = crypto.createHash('sha256').update('').digest('hex');
        // get first name from full name
        const firstName = email.split('@')[0].split('.')[0];
        // get last name from full name
        const lastName = email.split('@')[0].split('.')[1];
        // Save user and hashed token
        const user = await prisma.uSERS.create({
            data: {
                EMAIL: email,
                PASSWORD_HASH: '',
                EMAIL_VALIDATION_TOKEN: hashedCode,
                EMAIL_VALIDATED: false,
                STATUS: 'P',
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date(),
                FIRST_NAME: '',
                LAST_NAME: '',
            },
        });
        try {
            const domain = email.split('@')[1];
            const companyName = domain.split('.')[0];
            console.log(`[REGISTER] Company assignment start: domain=${domain}, companyName=${companyName}`);
            let company = await prisma.cOMPANY.findFirst({ where: { NAME: companyName } });
            console.log(`[REGISTER] Existing company found: ${company ? company.COMPANY_ID : 'none'}`);
            if (!company) {
                company = await prisma.cOMPANY.create({ data: { NAME: companyName } });
                console.log(`[REGISTER] Created new company with ID: ${company.COMPANY_ID}`);
            }
            await prisma.cOMPANY_INFO.create({ data: { COMPANY_ID: company.COMPANY_ID, USER_ID: user.USER_ID } });
            console.log(`[REGISTER] Created COMPANY_INFO link for user=${user.USER_ID}, company=${company.COMPANY_ID}`);
        }
        catch (companyError) {
            console.error('[REGISTER] Company creation/linking failed:', companyError);
        }
        // Assign Admin role to new user
        try {
            // Find or create the Admin role
            let adminRole = await prisma.rOLES.findFirst({ where: { NAME: 'Admin' } });
            if (!adminRole) {
                adminRole = await prisma.rOLES.create({ data: { NAME: 'ADMIN', DISPLAY_NAME: 'Administrator', DESCRIPTION: 'Default admin role' } });
                console.log(`[REGISTER] Created Admin role with ID: ${adminRole.ROLE_ID}`);
            }
            // Link user to Admin role
            await prisma.uSER_ROLES.create({ data: { USER_ID: user.USER_ID, ROLE_ID: adminRole.ROLE_ID } });
            console.log(`[REGISTER] Assigned Admin role to user=${user.USER_ID}`);
        }
        catch (roleError) {
            console.error('[REGISTER] Role assignment failed:', roleError);
        }
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
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Generate a 6-digit numeric verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
        // Update the user with the new token and expiry
        await prisma.uSERS.updateMany({
            where: { EMAIL: email },
            data: {
                EMAIL_VALIDATION_TOKEN: hashedCode,
                UPDATE_DATE: new Date(),
                // If you have an expiry column, add: EMAIL_VALIDATION_TOKEN_EXPIRY: tokenExpiry,
            }
        });
        // Send the email
        await sendVerificationEmail(email, verificationCode);
        return res.json({ success: true });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'response' in error) {
            // @ts-expect-error - dynamic property access
            console.error('SendGrid API Error Details:', error.response.body);
        }
        return res.status(500).json({
            error: 'Failed to send verification email',
            details: typeof error === 'object' && error !== null && 'message' in error ? error.message : String(error)
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
// --- Set Password After Verification ---
// Set password endpoint
app.post('/api/set-password', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 8) {
            return res.status(400).json({ error: 'Valid email and password (min 8 chars) required.' });
        }
        // Find user by email to get USER_ID
        const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const hash = await bcrypt.hash(password, 10);
        await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: { PASSWORD_HASH: hash }
        });
        return res.json({ success: true, userId: user.USER_ID });
    }
    catch (err) {
        console.error('[SET PASSWORD]', err);
        return res.status(500).json({ error: 'Server error setting password' });
    }
});
// --- Update Company/Account Info After Verification ---
app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, role, teamSize, companySize, workspaceName } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email required' });
        // Find user and their company info
        const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const companyInfo = await prisma.cOMPANY_INFO.findFirst({ where: { USER_ID: user.USER_ID } });
        if (!companyInfo)
            return res.status(404).json({ error: 'Company info not found' });
        // Update COMPANY_INFO
        await prisma.cOMPANY_INFO.update({
            where: { COMPANY_INFO_ID: companyInfo.COMPANY_INFO_ID },
            data: {
                ROLE: role,
                TEAM_SIZE: teamSize,
                COMPANY_SIZE: companySize,
                WORKSPACE_NAME: workspaceName
            }
        });
        // Optionally update COMPANY with company size
        if (companySize && companyInfo.COMPANY_ID) {
            await prisma.cOMPANY.update({
                where: { COMPANY_ID: companyInfo.COMPANY_ID },
                data: { ADDRESS: companySize } // If you want to store it in a dedicated field, adjust here
            });
        }
        return res.json({ success: true });
    }
    catch (err) {
        console.error('[UPDATE PROFILE]', err);
        return res.status(500).json({ error: 'Server error updating profile' });
    }
});
// --- Complete Registration (Password, Name, Workspace, Company, Role, Team) ---
app.post('/api/complete-registration', async (req, res) => {
    try {
        console.log('[COMPLETE REGISTRATION] Incoming body:', req.body);
        // Zod schema for complete registration
        const completeRegistrationSchema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            fullName: z.string().min(1),
            workspaceName: z.string().min(1),
            role: z.string().min(1),
            teamSize: z.string().min(1),
            companySize: z.string().min(1),
        });
        const validation = completeRegistrationSchema.safeParse(req.body);
        if (!validation.success) {
            console.error('[COMPLETE REGISTRATION] Validation failed:', validation.error.errors);
            return res.status(400).json({ error: 'Missing or invalid required fields', details: validation.error.errors });
        }
        const { email, password, fullName, workspaceName, role, teamSize, companySize } = validation.data;
        // DEBUG LOGGING for troubleshooting registration issues
        console.log('[COMPLETE REGISTRATION] email:', email);
        console.log('[COMPLETE REGISTRATION] password:', password ? '[REDACTED]' : '[MISSING]');
        console.log('[COMPLETE REGISTRATION] fullName:', fullName);
        console.log('[COMPLETE REGISTRATION] workspaceName:', workspaceName);
        console.log('[COMPLETE REGISTRATION] role:', role);
        console.log('[COMPLETE REGISTRATION] teamSize:', teamSize);
        console.log('[COMPLETE REGISTRATION] companySize:', companySize);
        // Find user
        const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
        console.log('[COMPLETE REGISTRATION] user:', user);
        if (!user) {
            console.error('[COMPLETE REGISTRATION] User not found for email:', email);
            return res.status(404).json({ error: 'User not found' });
        }
        // Split full name
        const [firstName, ...rest] = fullName.trim().split(' ');
        const lastName = rest.join(' ') || '';
        // Hash password
        const hash = await bcrypt.hash(password, 10);
        // Create/find company by workspace name
        let company = await prisma.cOMPANY.findFirst({ where: { NAME: workspaceName } });
        console.log('[COMPLETE REGISTRATION] found company:', company);
        if (!company) {
            company = await prisma.cOMPANY.create({ data: { NAME: workspaceName } });
            console.log('[COMPLETE REGISTRATION] created company:', company);
        }
        // Update user with password, name, and company ID
        const updatedUser = await prisma.uSERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                PASSWORD_HASH: hash,
                FIRST_NAME: firstName,
                LAST_NAME: lastName,
                COMPANY_ID: company.COMPANY_ID,
                UPDATE_DATE: new Date(),
                STATUS: 'A',
                EMAIL_VALIDATED: true
            }
        });
        console.log('[COMPLETE REGISTRATION] updated user:', updatedUser);
        // Upsert into company info (role, team size, etc.)
        try {
            const companyInfo = await prisma.cOMPANY_INFO.upsert({
                where: {
                    USER_ID_COMPANY_ID: {
                        USER_ID: user.USER_ID,
                        COMPANY_ID: company.COMPANY_ID
                    }
                },
                update: {
                    ROLE: role || null,
                    TEAM_SIZE: teamSize || null,
                    COMPANY_SIZE: companySize || null,
                    WORKSPACE_NAME: workspaceName,
                    UPDATED_AT: new Date()
                },
                create: {
                    USER_ID: user.USER_ID,
                    COMPANY_ID: company.COMPANY_ID,
                    ROLE: role || null,
                    TEAM_SIZE: teamSize || null,
                    COMPANY_SIZE: companySize || null,
                    WORKSPACE_NAME: workspaceName,
                    CREATED_AT: new Date(),
                    UPDATED_AT: new Date()
                }
            });
            console.log('[COMPLETE REGISTRATION] upserted companyInfo:', companyInfo);
        }
        catch (upsertErr) {
            console.error('[COMPLETE REGISTRATION] companyInfo upsert failed:', upsertErr);
        }
        return res.json({ success: true, companyId: company.COMPANY_ID });
    }
    catch (err) {
        console.error('[COMPLETE REGISTRATION]', err);
        return res.status(500).json({ error: 'Server error completing registration' });
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
