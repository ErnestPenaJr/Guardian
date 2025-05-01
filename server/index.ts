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
import { passport, loginSchema, generateToken, requireAuth, hashPassword } from './auth.js';
import rateLimit from 'express-rate-limit';
import { isAdmin } from './middleware/isAdmin.js';

// --- Type Inference for Role, User, UserRole, Invite ---
type Role = { ROLE_ID: number; NAME?: string; DISPLAY_NAME?: string; DESCRIPTION?: string };
type User = { USER_ID: number; FIRST_NAME: string; LAST_NAME: string; EMAIL: string; CREATE_DATE: Date; STATUS: string; COMPANY_ID: number | null };
type UserRole = { USER_ID: number; ROLE_ID: number };
type Invite = { INVITE_ID: number; EMAIL: string; ROLE_ID: number; STATUS: string; EXPIRES_AT: Date; CREATED_AT: Date; USED_AT: Date | null };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
// Support both server- and client-named keys
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY;
console.log('[SENDGRID] API Key set:', !!SENDGRID_API_KEY);
// Determine sender email
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.VITE_SENDGRID_FROM_EMAIL || 'no-reply@yourdomain.com';
console.log('[SENDGRID] From email:', SENDGRID_FROM_EMAIL);
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('SendGrid API key is not set. Skipping email sends.');
}

const prisma = new PrismaClient();
const prismaAny = prisma as any;
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Create a rate limiter for login attempts
// 5 failed attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: { 
    success: false, 
    message: 'Too many login attempts. Please try again later.' 
  }
});

// --- ADMIN-ONLY TEST ENDPOINT ---
app.get('/api/admin/secret', passport.authenticate('jwt', { session: false }), isAdmin, (req, res) => {
  res.json({ secret: 'This is admin-only data.' });
});

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
    const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
    // Hash the password (empty string in this case)
    const passwordHash = crypto.createHash('sha256').update('').digest('hex');
    // get first name from email
    const firstName = email.split('@')[0].split('.')[0];
    // get last name from email
    const lastName = email.split('@')[0].split('.')[1] || '';
    // Company by domain
    const domain = email.split('@')[1];
    const companyName = domain.split('.')[0];
    let company = await prisma.cOMPANY.findFirst({ where: { NAME: companyName } });
    if (!company) {
      company = await prisma.cOMPANY.create({ data: { NAME: companyName } });
    }
    // Save user and hashed token
    const user = await prisma.uSERS.create({
      data: {
        EMAIL: email,
        PASSWORD_HASH: passwordHash,
        EMAIL_VALIDATION_TOKEN: hashedCode,
        EMAIL_VALIDATION_TOKEN_EXPIRY: tokenExpiry,
        EMAIL_VALIDATED: false,
        STATUS: 'P',
        CREATE_DATE: new Date(),
        UPDATE_DATE: new Date(),
        FIRST_NAME: firstName,
        LAST_NAME: lastName,
        COMPANY_ID: company.COMPANY_ID // assign directly from company
      },
    });
    // Only proceed if company.COMPANY_ID is a valid number
    if (user.COMPANY_ID == null) throw new Error('User missing COMPANY_ID');
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ where: { USER_ID: user.USER_ID } });
    if (!companyInfo) {
      await prisma.cOMPANY_INFO.create({
        data: {
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID!,
        }
      });
    }
    // Assign Admin role to new user
    try {
      let adminRole = await prisma.rOLES.findFirst({ where: { NAME: 'Admin' } });
      if (!adminRole) {
        adminRole = await prisma.rOLES.create({ data: { NAME: 'ADMIN', DISPLAY_NAME: 'Administrator', DESCRIPTION: 'Default admin role' } });
      }
      await prisma.uSER_ROLES.create({ data: { USER_ID: user.USER_ID, ROLE_ID: adminRole.ROLE_ID } });
    } catch (roleError) {
      console.error('[REGISTER] Role assignment failed:', roleError);
    }
    await sendVerificationEmail(email, verificationCode);
    return res.status(201).json({ message: 'Registration successful. Please check your email for verification.', userId: user.USER_ID });
  } catch (err) {
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
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (!user) {
      return res.status(404).json({ error: 'No user found for this email. Please register again.' });
    }
    // If user already has a non-expired EMAIL_VALIDATION_TOKEN and expiry, reuse it
    // (Assume EMAIL_VALIDATION_TOKEN_EXPIRY is available, otherwise use UPDATE_DATE + 15min as fallback)
    let verificationCode;
    let expiryTime;
    let hashedCode = user.EMAIL_VALIDATION_TOKEN;
    // If you have an expiry column, use it; otherwise, fallback to 15min after UPDATE_DATE
    const tokenExpiry = user.EMAIL_VALIDATION_TOKEN_EXPIRY || new Date(new Date(user.UPDATE_DATE).getTime() + 1000 * 60 * 15);
    if (hashedCode && tokenExpiry > new Date()) {
      // Reuse the existing code (but we don't have the plain code, so cannot email it)
      // Instead, require that plain code is stored in a temp field or in-memory cache for resend, or always generate a new one
      // For now, fallback to always generating a new code if plain code is not available
      // (You may want to persist the plain code for the duration of the expiry for resend support)
      // ---
      // If you want to persist the plain code, add a column to USERS, e.g. EMAIL_VALIDATION_CODE_PLAIN
      verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
      expiryTime = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
      // Update the user with the new token, plain code, and expiry
      await prisma.uSERS.update({
        where: { USER_ID: user.USER_ID },
        data: {
          EMAIL_VALIDATION_TOKEN: hashedCode,
          EMAIL_VALIDATION_TOKEN_EXPIRY: expiryTime,
          UPDATE_DATE: new Date(),
        }
      });
    } else {
      verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
      expiryTime = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
      // Update the user with the new token, plain code, and expiry
      await prisma.uSERS.update({
        where: { USER_ID: user.USER_ID },
        data: {
          EMAIL_VALIDATION_TOKEN: hashedCode,
          EMAIL_VALIDATION_TOKEN_EXPIRY: expiryTime,
          UPDATE_DATE: new Date(),
        }
      });
    }
    // Send the email
    await sendVerificationEmail(email, verificationCode);
    return res.json({ success: true, code: verificationCode, expiryTime });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'body' in error.response
    ) {
      console.error('SendGrid API Error Details:', (error as any).response.body);
    }
    return res.status(500).json({
      error: 'Failed to send verification email',
      details: (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error)
    });
  }
});

// POST /api/validate-email
app.post('/api/validate-email', async (req, res) => {
  try {
    console.log('[validate-email] req.body:', req.body); // DEBUG: log incoming request
    const { email, purpose } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ valid: false, reason: 'Invalid email format' });
    }
    const existingUser = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (purpose === 'register') {
      if (existingUser) {
        return res.status(409).json({ valid: false, reason: 'Email already registered' });
      }
      return res.json({ valid: true });
    } else if (purpose === 'reset') {
      if (!existingUser) {
        return res.status(404).json({ valid: false, reason: 'Email not found' });
      }
      if (existingUser.EMAIL_VALIDATED !== true) {
        return res.status(403).json({ valid: false, reason: 'Email not verified' });
      }
      return res.json({ valid: true });
    } else {
      return res.status(400).json({ valid: false, reason: 'Invalid purpose' });
    }
  } catch (error) {
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
  } catch (error) {
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
  } catch (err) {
    console.error('[SET PASSWORD]', err);
    return res.status(500).json({ error: 'Server error setting password' });
  }
});

// --- Update Company/Account Info After Verification ---
app.post('/api/update-profile', async (req, res) => {
  try {
    const { email, role, teamSize, companySize, workspaceName } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    // Find user and their company info
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ where: { USER_ID: user.USER_ID } });
    if (!companyInfo) return res.status(404).json({ error: 'Company info not found' });
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
    if (companySize && user.COMPANY_ID != null) {
      await prisma.cOMPANY.update({
        where: { COMPANY_ID: user.COMPANY_ID },
        data: { ADDRESS: companySize } // If you want to store it in a dedicated field, adjust here
      });
    }
    return res.json({ success: true });
  } catch (err) {
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
    const { email, password, fullName, workspaceName, role, teamSize, companySize } = req.body;
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Split full name
    const [firstName, ...rest] = fullName.trim().split(' ');
    const lastName = rest.join(' ') || '';
    // Hash password
    const hash = await bcrypt.hash(password, 10);
    // Update user with password, name, and keep company ID
    const updatedUser = await prisma.uSERS.update({
      where: { USER_ID: user.USER_ID },
      data: {
        PASSWORD_HASH: hash,
        FIRST_NAME: firstName,
        LAST_NAME: lastName,
        UPDATE_DATE: new Date(),
        STATUS: 'A',
        EMAIL_VALIDATED: true
      }
    });
    // Update company_info with workspaceName, role, teamSize, companySize
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ where: { USER_ID: user.USER_ID } });
    if (!companyInfo) {
      if (user.COMPANY_ID == null) throw new Error('User missing COMPANY_ID');
      await prisma.cOMPANY_INFO.create({
        data: {
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID!,
          WORKSPACE_NAME: workspaceName,
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize
        }
      });
    } else {
      await prisma.cOMPANY_INFO.update({
        where: { COMPANY_INFO_ID: companyInfo.COMPANY_INFO_ID },
        data: {
          WORKSPACE_NAME: workspaceName,
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize
        }
      });
    }
    return res.json({ success: true, companyId: user.COMPANY_ID });
  } catch (err) {
    console.error('[COMPLETE REGISTRATION]', err);
    return res.status(500).json({ error: 'Server error completing registration' });
  }
});

// --- Request Password Reset ---
app.post('/api/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (!user) {
      return res.status(404).json({ error: 'No user found for this email.' });
    }
    if (!user.EMAIL_VALIDATED) {
      return res.status(403).json({ error: 'Your email is not verified. Please verify your email before resetting your password.' });
    }
    // Generate a 6-digit numeric reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedResetCode = crypto.createHash('sha256').update(resetCode).digest('hex');
    // Store hashed code
    await prisma.uSERS.update({
      where: { USER_ID: user.USER_ID },
      data: {
        PASSWORD_RESET_TOKEN: hashedResetCode
      }
    });
    // Send password reset email (customized text)
    await sendPasswordResetEmail(email, resetCode);
    return res.json({ success: true });
  } catch (err) {
    console.error('[REQUEST PASSWORD RESET]', err);
    return res.status(500).json({ error: 'Server error requesting password reset' });
  }
});

// --- Reset Password ---
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    if (!user) {
      return res.status(404).json({ error: 'No user found for this email.' });
    }
    if (!user.EMAIL_VALIDATED) {
      return res.status(403).json({ error: 'Your email is not verified. Please verify your email before resetting your password.' });
    }
    // Check code
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    if (hashedCode !== user.PASSWORD_RESET_TOKEN) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }
    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.uSERS.update({
      where: { USER_ID: user.USER_ID },
      data: {
        PASSWORD_HASH: hash,
        PASSWORD_RESET_TOKEN: null,
        UPDATE_DATE: new Date()
      }
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[RESET PASSWORD]', err);
    return res.status(500).json({ error: 'Server error resetting password' });
  }
});

// --- Send Password Reset Email Helper ---
async function sendPasswordResetEmail(email: string, code: string) {
  // Use SendGrid or your mailer, but change the subject and body to clarify this is a password reset
  const msg = {
    to: email,
    from: SENDGRID_FROM_EMAIL,
    subject: 'Your Guardian Password Reset Code',
    text: `You requested a password reset for your Guardian account.\n\nYour password reset code is: ${code}\n\nThis code will expire in 15 minutes. If you did not request a password reset, please ignore this email.`,
    html: `<p>You requested a password reset for your Guardian account.</p><p><b>Your password reset code is: <span style='font-size:1.5em;'>${code}</span></b></p><p>This code will expire in 15 minutes.</p><p>If you did not request a password reset, please ignore this email.</p>`
  };
  await sgMail.send(msg);
}

async function sendVerificationEmail(email: string, verificationToken: string) {
  try {
    console.log('[SendGrid] Attempting to send verification email...');
    console.log(`[SendGrid] To: ${email}`);
    console.log(`[SendGrid] Using API Key: ${!!SENDGRID_API_KEY}`);
    const msg = {
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: 'Verify Your Guardian Account',
      text: `Hello,
You requested to verify your Guardian account.
Your verification code is: ${verificationToken}
This code expires in 15 minutes.
If you did not request this, please ignore this email.
Best regards,
The Guardian Team`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Guardian Account</title>
  <style>
    body { margin:0; padding:0; background:#f9f9f9; font-family:Arial,sans-serif; }
    .container { max-width:600px; margin:20px auto; background:#fff; padding:20px; border-radius:8px; }
    h2 { color:#2EBCBC; }
    .code { background:#f4f4f4; padding:15px; text-align:center; font-size:24px; letter-spacing:6px; border-radius:4px; margin:20px 0; }
    .footer { font-size:12px; color:#777; margin-top:30px; text-align:center; }
    a { color:#2EBCBC; text-decoration:none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Guardian Email Verification</h2>
    <p>Thank you for registering with Guardian. Please use the following verification code to confirm your email address:</p>
    <div class="code">${verificationToken}</div>
    <p>This code will expire in 15 minutes.</p>
    <p>If you did not request this, please ignore this email or contact <a href="mailto:support@shieldlytics.com">support@shieldlytics.com</a>.</p>
    <div class="footer">&copy; ${new Date().getFullYear()} Guardian by Shieldlytics. All rights reserved.<br>123 Main St, City, State, ZIP</div>
  </div>
</body>
</html>`
    };
    const [response] = await sgMail.send(msg);
    console.log('[SendGrid] Email sent successfully.');
    console.log('[SendGrid] SendGrid API response statusCode:', response.statusCode);
  } catch (error: any) {
    if (
      error &&
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'body' in error.response
    ) {
      console.error('SendGrid API Error Details:', (error as any).response.body);
    }
    console.error('[SendGrid] Error sending verification email:', error);
  }
}

// --- GET ROLES ENDPOINT ---
app.get('/api/roles', async (req, res) => {
  try {
    const roles = await prisma.rOLES.findMany({
      where: { STATUS: 'A' }, // Only active roles
      select: {
        ROLE_ID: true,
        NAME: true,
        DISPLAY_NAME: true,
        DESCRIPTION: true
      }
    });
    return res.json(
      roles.map((r: Role) => ({
        id: r.ROLE_ID,
        name: r.DISPLAY_NAME || r.NAME,
        description: r.DESCRIPTION
      }))
    );
  } catch (err) {
    console.error('[GET ROLES]', err);
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// --- GET REQUESTS ENDPOINT ---
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await prisma.rEQUESTS.findMany({
      select: {
        REQUEST_ID: true,
        REQUEST_NAME: true,
        EXTERNAL_USER: true,
        SUBMITTED_DATE: true,
        REQUESTOR_ID: true,
        ASSIGNED_ID: true,
        STATUS: true,
        CREATE_DATE: true,
        UPDATE_DATE: true,
        CREATE_USER_ID: true,
        UPDATE_USER_ID: true,
        TRACKINGID: true,
      },
    });
    res.json(requests);
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('[GET REQUESTS] Error:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message, stack: error.stack });
    } else {
      res.status(500).json({ error: 'Failed to fetch requests', detail: error });
    }
  }
});

// --- INVITE TABLE (PRISMA MODEL) ---
// Table: INVITES (fields: INVITE_ID, EMAIL, ROLE_ID, TOKEN, STATUS, EXPIRES_AT, USED_AT, CREATED_AT)

// --- SEND INVITES ENDPOINT ---
app.post('/api/invites/send', requireAuth, async (req, res) => {
  try {
    const { invites } = req.body; // [{ email, roleId }]
    const adminUserId = (req.user as any).id;
    const adminUser = await prisma.uSERS.findUnique({ where: { USER_ID: adminUserId } });
    if (!adminUser || !adminUser.COMPANY_ID) {
      return res.status(400).json({ error: 'Admin user does not have a company_id' });
    }
    const companyId = adminUser.COMPANY_ID;
    console.log('[SEND INVITES] Invites:', invites, 'adminUserId:', adminUserId, 'companyId:', companyId);
    if (!Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ error: 'No invites provided' });
    }
    const results: { email: string; inviteUrl: string }[] = [];
    for (const invite of invites) {
      const token = crypto.randomBytes(32).toString('hex');
      // Use admin's companyId for all invites
      await prismaAny.iNVITES.create({
        data: {
          EMAIL: invite.email,
          ROLE_ID: invite.roleId,
          COMPANY_ID: companyId,
          TOKEN: token,
          STATUS: 'P', // Pending
          EXPIRES_AT: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
          CREATED_AT: new Date()
        }
      });
      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;
      // Log email preparation
      console.log('[SEND INVITES] About to send email for', invite.email);
      // Attempt email send, but don't block on failure
      if (SENDGRID_API_KEY) {
        console.log('[SEND INVITES] Sending email to', invite.email, 'from', SENDGRID_FROM_EMAIL);
        try {
          // Include plain-text content to improve deliverability
          const mailData = {
            to: invite.email,
            from: SENDGRID_FROM_EMAIL,
            subject: 'You have been invited to Guardian!',
            text: `Hello,

You have been invited to join Guardian, a modern security and compliance platform designed to protect your organization and streamline your workflows.

Your invitation is unique to you. Please click the link below to set up your account and get started:

${inviteUrl}

If you have any questions or did not expect this invitation, please contact our support team at support@shieldlytics.com.

Guardian by Shieldlytics
123 Main St, City, State, ZIP
https://shieldlytics.com
`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Guardian!</title>
  <style>
    body { margin:0; padding:0; background:#f9f9f9; font-family:Arial,sans-serif; }
    .container { max-width:600px; margin:20px auto; background:#fff; padding:24px; border-radius:8px; box-shadow:0 2px 8px rgba(44,44,44,0.06); }
    h2 { color:#2EBCBC; }
    .cta { display:inline-block; margin:24px 0; padding:12px 28px; background:#2EBCBC; color:#fff; border-radius:4px; text-decoration:none; font-weight:bold; letter-spacing:1px; }
    .footer { font-size:12px; color:#777; margin-top:30px; text-align:center; }
    .features { margin:24px 0 0 0; padding:0; }
    .features li { margin-bottom:8px; }
    a { color:#2EBCBC; }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://shieldlytics.com/logo.png" alt="Guardian by Shieldlytics" style="height:40px; margin-bottom:16px;">
    <h2>Welcome to Guardian!</h2>
    <p>Hi there,</p>
    <p>You have been invited to join <b>Guardian</b>, the modern security and compliance platform by <b>Shieldlytics</b>.</p>
    <ul class="features">
      <li>✔️ Real-time security monitoring</li>
      <li>✔️ Automated compliance workflows</li>
      <li>✔️ Easy team collaboration</li>
      <li>✔️ Secure cloud-based access</li>
    </ul>
    <p style="margin-top:18px;">To get started, please click the button below to accept your invitation and set up your account:</p>
    <p><a class="cta" href="${inviteUrl}">Accept Your Invitation</a></p>
    <p>If you did not expect this invitation, please ignore this email or <a href="mailto:support@shieldlytics.com">contact support</a>.</p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Guardian by Shieldlytics. All rights reserved.<br>
      123 Main St, City, State, ZIP<br>
      <a href="https://shieldlytics.com">https://shieldlytics.com</a>
    </div>
  </div>
</body>
</html>`
          };
          const [response] = await sgMail.send(mailData);
          console.log('[SEND INVITES] SendGrid API response statusCode:', response.statusCode);
        } catch (emailErr) {
          console.error('[SEND INVITES] Email send status code:', (emailErr as any).code);
          console.error('[SEND INVITES] SendGrid error response body:', (emailErr as any).response?.body);
          const sgBody = (emailErr as any).response?.body;
          console.error('[SEND INVITES] SendGrid response errors:', JSON.stringify(sgBody?.errors, null, 2));
        }
      }
      results.push({ email: invite.email, inviteUrl });
    }
    return res.json({ success: true, invites: results });
  } catch (err) {
    console.error('[SEND INVITES]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// --- ACCEPT INVITE ENDPOINT ---
app.post('/api/invite/accept', async (req, res) => {
  try {
    const { token, firstName, lastName, password } = req.body;
    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Find invite
    const invite = await prismaAny.iNVITES.findFirst({ where: { TOKEN: token, STATUS: 'P' } });
    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }
    // Create user
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.uSERS.create({
      data: {
        EMAIL: invite.EMAIL,
        PASSWORD_HASH: hash,
        FIRST_NAME: firstName,
        LAST_NAME: lastName,
        EMAIL_VALIDATED: true,
        STATUS: 'A',
        CREATE_DATE: new Date(),
        UPDATE_DATE: new Date(),
        COMPANY_ID: invite.COMPANY_ID
      }
    });
    // Only proceed if invite.COMPANY_ID is a valid number
    if (user.COMPANY_ID == null) throw new Error('User missing COMPANY_ID');
    // Assign role
    await prisma.uSER_ROLES.create({ data: { USER_ID: user.USER_ID, ROLE_ID: invite.ROLE_ID } });
    // Mark invite as used
    await prismaAny.iNVITES.update({ where: { INVITE_ID: invite.INVITE_ID }, data: { STATUS: 'U', USED_AT: new Date() } });
    // Create company_info
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ where: { USER_ID: user.USER_ID } });
    if (!companyInfo) {
      await prisma.cOMPANY_INFO.create({
        data: {
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID!
        }
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[ACCEPT INVITE]', err);
    return res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// --- RESEND INVITE (ADMIN ONLY) ---
app.post('/api/invites/resend', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const { inviteId } = req.body;
    const invite = await prisma.iNVITES.findUnique({ where: { INVITE_ID: inviteId } });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    // Generate new token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    await prisma.iNVITES.update({
      where: { INVITE_ID: inviteId },
      data: { TOKEN: token, EXPIRES_AT: newExpiry, STATUS: 'P', USED_AT: null }
    });
    // Send invite email (reuse logic)
    if (SENDGRID_API_KEY) {
      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;
      const expirationHours = 168;
      const days = Math.floor(expirationHours / 24);
      const expiresAtString = newExpiry.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      });
      await sgMail.send({
        to: invite.EMAIL,
        from: SENDGRID_FROM_EMAIL,
        subject: 'Your Guardian Invitation (Resent)',
        text: `You have been re-invited to Guardian. Please use the following link to accept: ${inviteUrl}`,
        html: `<!DOCTYPE html>
<html>
  <body style="font-family: 'Inter', 'Montserrat', Arial, sans-serif; background: #fff; color: #222;">
    <div style="max-width: 520px; margin: 0 auto; border: 1px solid #e3e3e3; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 32px;">
      <img src="https://shieldlytics.com/logo.png" alt="Shieldlytics" style="height: 38px; margin-bottom: 18px;">
      <h2 style="color: #25c6c6; margin: 0 0 18px;">Re-invitation to Guardian!</h2>
      <p>
        Hi there,<br><br>
        This is a <b>reminder</b> that you have been invited to join <b>Guardian</b>, the modern security and compliance platform by <b>Shieldlytics</b>.
      </p>
      <ul style="margin: 18px 0 18px 18px; padding: 0;">
        <li>✔ Real-time security monitoring</li>
        <li>✔ Automated compliance workflows</li>
        <li>✔ Easy team collaboration</li>
        <li>✔ Secure cloud-based access</li>
      </ul>
      <p>
        <b>Please note:</b> This is a re-invite. Your invitation will <b>expire in ${days} days (${expirationHours} hours)</b>, on <b>${expiresAtString}</b> from the time this email was sent.<br>
        If you have not yet accepted, please use the button below to activate your account:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}" style="background: #25c6c6; color: #fff; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 18px;">Accept Your Invitation</a>
      </div>
      <p style="font-size: 13px; color: #666;">
        If you did not expect this invitation, please ignore this email or <a href="mailto:support@shieldlytics.com" style="color: #25c6c6;">contact support</a>.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <div style="font-size: 12px; color: #aaa; text-align: center;">
        &copy; 2025 Guardian by Shieldlytics. All rights reserved.<br>
        123 Main St, City, State, ZIP<br>
        <a href="https://shieldlytics.com" style="color: #25c6c6;">https://shieldlytics.com</a>
      </div>
    </div>
  </body>
</html>`
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[RESEND INVITE]', err);
    res.status(500).json({ error: 'Failed to resend invite' });
  }
});

// --- REMOVE INVITE (ADMIN ONLY) ---
app.delete('/api/invites/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const inviteId = parseInt(req.params.id, 10);
    await prisma.iNVITES.delete({ where: { INVITE_ID: inviteId } });
    res.json({ success: true });
  } catch (err) {
    console.error('[REMOVE INVITE]', err);
    res.status(500).json({ error: 'Failed to remove invite' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
