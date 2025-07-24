// Import built-in Node.js modules
import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import third-party modules with types
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Resend } from 'resend';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

// Import local modules
import { passport, loginSchema, generateToken, requireAuth, hashPassword } from './auth.js';
import { isAdmin } from './middleware/isAdmin.js';
import formsRoutes from './routes/forms.js';
import externalRoutes from './routes/external.js';
import endpointViewerRoutes from './routes/endpoint-viewer.js';
import fieldsRoutes from './routes/fields.js';
import fieldTypesRoutes from './routes/field-types.js';
import requestsRoutes from './routes/requests.js';
import fieldLookupsRoutes from './routes/field-lookups.js';
import groupsRoutes from './routes/forms-groups.js';
import usersRoutes from './routes/users.js';
import rolesRoutes from './routes/roles.js';

// --- Type Inference for Role, User, UserRole, Invite ---
type Role = { ROLE_ID: number; NAME?: string; DISPLAY_NAME?: string; DESCRIPTION?: string };
type User = { USER_ID: number; FIRST_NAME: string; LAST_NAME: string; EMAIL: string; CREATE_DATE: Date; STATUS: string; COMPANY_ID: number | null };
type UserRole = { USER_ID: number; ROLE_ID: number };
type Invite = { INVITE_ID: number; EMAIL: string; ROLE_ID: number; STATUS: string; EXPIRES_AT: Date; CREATED_AT: Date; USED_AT: Date | null };

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const join = path.join;

// Load environment variables
// Configure Resend email service
const RESEND_API_KEY = process.env.SMTP_PASSWORD; // Using SMTP_PASSWORD from .env which contains Resend API key
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
console.log('[RESEND] Email service initialized');
console.log('[RESEND] From email:', EMAIL_FROM);

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY);

const prisma = new PrismaClient();
const app = express();

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Serve static files from the frontend dist directory
const frontendDistPath = path.resolve(process.cwd(), 'dist');
console.log(`[STATIC FILES] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

// API response middleware - ensures all API responses are JSON
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.path} - User-Agent: ${req.get('User-Agent')}`);
  console.log(`[API REQUEST] Headers:`, req.headers);
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routing test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API routing is working correctly',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// Register API routes
app.use('/api/forms', formsRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/endpoint-viewer', endpointViewerRoutes);
app.use('/api/fields', fieldsRoutes);
app.use('/api/field-types', fieldTypesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/forms-groups', groupsRoutes);
app.use('/api/users', usersRoutes); // Users routes
app.use('/api/roles', rolesRoutes); // Roles routes
app.use('/api/field-lookups', fieldLookupsRoutes);

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

// --- LOGIN ENDPOINT ---
app.post('/api/login', loginRateLimiter, async (req, res) => {
  console.log('[LOGIN] Login attempt:', { email: req.body.email });
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log('[LOGIN] Validation error:', parseResult.error.errors);
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }
    const { email, password } = parseResult.data;
    
    try {
      console.log('[LOGIN] Looking up user in database...');
      const user = await prisma.uSERS.findFirst({ 
        where: { EMAIL: email }
      });
      
      console.log('[LOGIN] User found:', user ? { 
        id: user.USER_ID, 
        email: user.EMAIL,
        hasPassword: !!user.PASSWORD_HASH,
        status: user.STATUS,
        emailValidated: user.EMAIL_VALIDATED
      } : 'No user found');
      
      if (!user || !user.PASSWORD_HASH) {
        console.log('[LOGIN] Invalid user or password hash');
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      console.log('[LOGIN] Comparing password...');
      const valid = await bcrypt.compare(password, user.PASSWORD_HASH);
      if (!valid) {
        console.log('[LOGIN] Invalid password');
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      console.log('[LOGIN] Authentication successful, fetching user roles...');
      // Fetch user roles
      const userRoles = await prisma.uSER_ROLES.findMany({
        where: { USER_ID: user.USER_ID }
      });
    
    // Fetch role details
    const roleIds = userRoles.map((ur: any) => ur.ROLE_ID);
    console.log('[LOGIN] User role IDs:', roleIds);
    
    interface Role {
      ROLE_ID: number;
      NAME: string | null;
      DISPLAY_NAME: string | null;
    }
    
    let roles: Role[] = [];
    if (roleIds.length > 0) {
      roles = await prisma.rOLES.findMany({
        where: {
          ROLE_ID: { in: roleIds }
        }
      }) as Role[];
      console.log('[LOGIN] Found roles:', roles.map(r => r.NAME || 'unnamed'));
    } else {
      console.log('[LOGIN] No roles found for user');
    }
    
    // Format roles for response
    const formattedRoles = roles.map(role => ({
      id: role.ROLE_ID,
      name: role.NAME,
      displayName: role.DISPLAY_NAME
    }));
    
    // Get company information if available
    interface Company {
      id: number;
      name: string;
    }
    let company: Company | null = null;
    if (user.COMPANY_ID) {
      try {
        console.log(`[LOGIN] Fetching company info for ID: ${user.COMPANY_ID}`);
        const companyData = await prisma.cOMPANY.findUnique({
          where: { COMPANY_ID: user.COMPANY_ID }
        });
        if (companyData) {
          company = {
            id: companyData.COMPANY_ID,
            name: companyData.NAME || ''
          };
          console.log(`[LOGIN] Found company: ${company.name}`);
        } else {
          console.log(`[LOGIN] No company found with ID: ${user.COMPANY_ID}`);
        }
      } catch (companyErr) {
        console.error('[LOGIN] Error fetching company:', companyErr);
        // Continue without company info if there's an error
      }
    } else {
      console.log('[LOGIN] No company ID associated with user');
    }
    
    // Create AuthUser object for generateToken
    const role = roleIds.includes(1) ? 'admin' : 
                roleIds.includes(6) ? 'jafar' : 
                roleIds.includes(5) ? 'sorcerer' : 'user';
    
    const authUser = {
      id: user.USER_ID,
      email: user.EMAIL,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      roles: roleIds,
      COMPANY_ID: user.COMPANY_ID,
      username: user.EMAIL, // Use email as username
      role: role // Determine role based on roles array
    };
    
    console.log('[LOGIN] Generating token for user:', { 
      id: authUser.id, 
      email: authUser.email,
      role: authUser.role,
      companyId: authUser.COMPANY_ID
    });
    
    try {
      const token = generateToken(authUser);
      console.log('[LOGIN] Token generated successfully');
      
      const response = { 
        token, 
        user: { 
          id: user.USER_ID, 
          email: user.EMAIL, 
          firstName: user.FIRST_NAME,
          lastName: user.LAST_NAME,
          roles: formattedRoles,
          company
        } 
      };
      
      console.log('[LOGIN] Login successful, sending response');
      res.json(response);
    } catch (tokenErr) {
      console.error('[LOGIN] Error generating token:', tokenErr);
      throw new Error('Failed to generate authentication token');
    }
    } catch (err: any) {
      console.error('[LOGIN] Error during login:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        ...err
      });
      
      // Check for specific error types
      if (err.name === 'PrismaClientInitializationError' || 
          err.message.includes('prisma') || 
          err.message.includes('database')) {
        console.error('[LOGIN] Database connection error - check database configuration');
        return res.status(503).json({ 
          error: 'Database connection error', 
          details: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
      }
      
      // Default error response
      res.status(500).json({ 
        error: 'Server error during login',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  } catch (outerErr: any) {
    console.error('[LOGIN] Unhandled error in login endpoint:', {
      message: outerErr.message,
      stack: outerErr.stack,
      name: outerErr.name
    });
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? outerErr.message : undefined
    });
  }
});

// --- LOGOUT ENDPOINT ---
app.post('/api/logout', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    // Since we're using JWT, the actual logout happens client-side
    // by removing the token from localStorage
    
    // Here we can add any server-side cleanup if needed in the future
    // For example, if we implement token blacklisting or session tracking
    
    // For now, just return a success response
    res.json({ success: true, message: 'Logout successful' });
  } catch (err) {
    console.error('[LOGOUT]', err);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// --- ADMIN-ONLY TEST ENDPOINT ---
app.get('/api/admin/secret', passport.authenticate('jwt', { session: false }), isAdmin, (req, res) => {
  res.json({ secret: 'This is admin-only data.' });
});

// --- CURRENT USER ENDPOINT ---
app.get('/api/me', passport.authenticate('jwt', { session: false }), async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch user details
    const user = await prisma.uSERS.findUnique({
      where: { USER_ID: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch user roles
    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId }
    });
    
    // Fetch role details
    const roleIds = userRoles.map(ur => ur.ROLE_ID);
    const roles = await prisma.rOLES.findMany({
      where: {
        ROLE_ID: { in: roleIds }
      }
    });
    
    // Format roles for response
    const formattedRoles = roles.map(role => ({
      id: role.ROLE_ID,
      name: role.NAME,
      displayName: role.DISPLAY_NAME
    }));
    
    // Get company information if available
    let company: { id: number; name: string } | null = null;
    if (user.COMPANY_ID) {
      const companyData = await prisma.cOMPANY.findUnique({
        where: { COMPANY_ID: user.COMPANY_ID }
      });
      if (companyData) {
        company = {
          id: companyData.COMPANY_ID,
          name: companyData.NAME
        };
      }
    }
    
    // Return user information
    res.json({
      id: user.USER_ID,
      email: user.EMAIL,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      roles: formattedRoles,
      company,
      createdAt: user.CREATE_DATE,
      status: user.STATUS
    });
  } catch (err) {
    console.error('[GET CURRENT USER]', err);
    res.status(500).json({ error: 'Server error while fetching user data' });
  }
});

// Zod schema for registration
const registerSchema = z.object({
  email: z.string().email(),
  companyName: z.string().optional()
});

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }
    const { email, companyName } = parseResult.data;
    console.log('%c Registration Request', 'background: #673AB7; color: #fff', { email, companyName });

    // Debug log: Show raw companyName from request body
    console.log('%c Raw companyName from req.body:', 'background: #FFEB3B; color: #000', companyName);

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

    // Extract domain from email and use it as company name
    let companyNameToUse = 'Default Company';
    try {
      if (email && email.includes('@')) {
        const emailDomain = email.split('@')[1];
        
        if (emailDomain) {
          // Capitalize the domain for better readability
          const domainParts = emailDomain.split('.');
          
          if (domainParts.length > 0 && domainParts[0].length > 0) {
            // Use the main domain part (before the TLD) as company name
            companyNameToUse = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
            
            // Handle common domains with special formatting
            if (emailDomain.includes('gmail.com')) {
              companyNameToUse = 'Gmail';
            } else if (emailDomain.includes('outlook.com') || emailDomain.includes('hotmail.com')) {
              companyNameToUse = 'Microsoft';
            } else if (emailDomain.includes('yahoo.com')) {
              companyNameToUse = 'Yahoo';
            } else if (emailDomain.includes('icloud.com') || emailDomain.includes('me.com') || emailDomain.includes('mac.com')) {
              companyNameToUse = 'Apple';
            }
          }
        }
      }
    } catch (error) {
      console.error('Error extracting domain from email:', error);
      // Fallback to Default Company if any error occurs
      companyNameToUse = 'Default Company';
    }
    
    console.log('%c Company Name from Email Domain', 'background: #009688; color: #fff', { 
      email, 
      extractedCompany: companyNameToUse 
    });
    console.log('%c Company Name', 'background: #009688; color: #fff', companyNameToUse);
    
    // IMPORTANT: Completely bypass the Prisma ORM for company creation
    // Use a direct SQL query with explicit parameters
    try {
      console.log('%c Creating Company', 'background: #FF5722; color: #fff', companyNameToUse);
      
      // First try to find if company exists with exact name match
      const existingCompanies = await prisma.$queryRaw`
        SELECT COMPANY_ID, NAME FROM COMPANY WHERE NAME = ${companyNameToUse}
      `;
      
      console.log('%c Existing Companies', 'background: #9C27B0; color: #fff', existingCompanies);
      
      let companyId;
      
      if (!Array.isArray(existingCompanies) || existingCompanies.length === 0) {
        // Create new company with explicit parameter
        const insertResult = await prisma.$executeRaw`
          INSERT INTO COMPANY (NAME, CREATED_AT) VALUES (${companyNameToUse}, GETDATE())
        `;
        
        console.log('%c Insert Result', 'background: #E91E63; color: #fff', insertResult);
        
        // Get the newly created company
        const newCompanies = await prisma.$queryRaw`
          SELECT TOP 1 COMPANY_ID FROM COMPANY WHERE NAME = ${companyNameToUse} ORDER BY CREATED_AT DESC
        `;
        
        console.log('%c New Company Query', 'background: #3F51B5; color: #fff', newCompanies);
        
        if (Array.isArray(newCompanies) && newCompanies.length > 0) {
          companyId = newCompanies[0].COMPANY_ID;
        } else {
          throw new Error('Failed to retrieve new company ID');
        }
      } else {
        // Use existing company
        companyId = existingCompanies[0].COMPANY_ID;
      }
      
      console.log('%c Final Company ID', 'background: #607D8B; color: #fff', companyId);
      
      if (!companyId) {
        throw new Error('No valid company ID available');
      }
      
      // Log company assignment
      console.warn('%c [COMPANY ASSIGNMENT] Using company:', 'background: #E57373; color: #fff', companyNameToUse, new Date().toISOString());
      
      // Save user with company association
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
          COMPANY_ID: companyId
        },
      });
      
      // Create company_info entry
      const companyInfo = await prisma.cOMPANY_INFO.findFirst({ 
        where: { 
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID ?? undefined // Fix lint error related to null handling for COMPANY_ID
        } 
      });
      
      if (!companyInfo && user.COMPANY_ID) {
        await prisma.cOMPANY_INFO.create({
          data: {
            USER_ID: user.USER_ID,
            COMPANY_ID: user.COMPANY_ID,
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
    } catch (error) {
      console.error('[REGISTER] Error creating company:', error);
      // Fallback to using Default Company if company creation fails
      let defaultCompany = await prisma.cOMPANY.findFirst({ where: { NAME: 'Default Company' } });
      if (!defaultCompany) {
        defaultCompany = await prisma.cOMPANY.create({ data: { NAME: 'Default Company' } });
      }
      console.log('Fallback to Default Company:', defaultCompany);
      // Save user with company association
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
          COMPANY_ID: defaultCompany.COMPANY_ID // assign company
        },
      });
      // Create company_info entry
      const companyInfo = await prisma.cOMPANY_INFO.findFirst({ 
        where: { 
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID ?? undefined // Fix lint error related to null handling for COMPANY_ID
        } 
      });
      
      if (!companyInfo && user.COMPANY_ID) {
        await prisma.cOMPANY_INFO.create({
          data: {
            USER_ID: user.USER_ID,
            COMPANY_ID: user.COMPANY_ID,
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
    }
  } catch (err: any) {
    console.error('[REGISTRATION ERROR]', {
      error: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      email: req.body.email
    });
    
    // More specific error messages based on error type
    if (err.code === 'P1000' || err.message.includes('Authentication failed')) {
      return res.status(503).json({ error: 'Database authentication failed. Please try again later.' });
    }
    
    if (err.message.includes('Cannot open server') || err.message.includes('IP address')) {
      return res.status(503).json({ error: 'Database connection failed. Please try again later.' });
    }
    
    if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    
    if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'Database timeout. Please try again.' });
    }
    
    // Generic error for production security
    return res.status(500).json({ 
      error: 'Registration failed. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      code: process.env.NODE_ENV === 'development' ? err.code : undefined
    });
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
    if (error && typeof error === 'object' && error !== null) {
      console.error('Email API Error:', error);
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
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ 
      where: { 
        USER_ID: user.USER_ID,
        COMPANY_ID: user.COMPANY_ID ?? undefined // Fix lint error related to null handling for COMPANY_ID
      } 
    });
    if (!companyInfo) {
      if (user.COMPANY_ID == null) throw new Error('User missing COMPANY_ID');
      await prisma.cOMPANY_INFO.create({
        data: {
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID,
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize,
          WORKSPACE_NAME: workspaceName
        }
      });
    } else {
      await prisma.cOMPANY_INFO.update({
        where: { COMPANY_INFO_ID: companyInfo.COMPANY_INFO_ID },
        data: {
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize,
          WORKSPACE_NAME: workspaceName
        }
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
    const companyInfo = await prisma.cOMPANY_INFO.findFirst({ 
      where: { 
        USER_ID: user.USER_ID,
        COMPANY_ID: user.COMPANY_ID ?? undefined // Fix lint error related to null handling for COMPANY_ID
      } 
    });
    if (!companyInfo) {
      if (user.COMPANY_ID == null) throw new Error('User missing COMPANY_ID');
      await prisma.cOMPANY_INFO.create({
        data: {
          USER_ID: user.USER_ID,
          COMPANY_ID: user.COMPANY_ID,
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize,
          WORKSPACE_NAME: workspaceName
        }
      });
    } else {
      await prisma.cOMPANY_INFO.update({
        where: { COMPANY_INFO_ID: companyInfo.COMPANY_INFO_ID },
        data: {
          ROLE: role,
          TEAM_SIZE: teamSize,
          COMPANY_SIZE: companySize,
          WORKSPACE_NAME: workspaceName
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
    
    // Always include the verification code in the response for now
    // In production, this would be handled differently for security
    return res.json({ 
      success: true,
      verificationCode: resetCode 
    });
  } catch (err) {
    console.error('[REQUEST PASSWORD RESET]', err);
    return res.status(500).json({ error: 'Server error requesting password reset' });
  }
});

// --- Verify Reset Code ---
app.post('/api/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    
    const user = await prisma.uSERS.findFirst({ where: { EMAIL: email } });
    
    if (!user) {
      return res.status(404).json({ error: 'No user found for this email.' });
    }
    
    if (!user.EMAIL_VALIDATED) {
      return res.status(403).json({ error: 'Your email is not verified. Please verify your email before resetting your password.' });
    }
    
    // Check if the user has a reset token
    if (!user.PASSWORD_RESET_TOKEN) {
      return res.status(400).json({ error: 'No password reset request found. Please request a new code.' });
    }
    
    // Check code
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    
    if (hashedCode !== user.PASSWORD_RESET_TOKEN) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }
    
    return res.json({ success: true });
  } catch (err) {
    console.error('[VERIFY RESET CODE]', err);
    return res.status(500).json({ error: 'Server error verifying reset code' });
  }
});

// --- Reset Password ---
app.post('/api/reset-password', async (req, res) => {
  try {
    console.log('[RESET PASSWORD] Request body:', req.body);
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      console.log('[RESET PASSWORD] Missing fields:', { email: !!email, code: !!code, newPassword: !!newPassword });
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
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?email=${encodeURIComponent(email)}&code=${code}`;
  
  try {
    await resend.emails.send({
      from: `Shieldlytics <${EMAIL_FROM}>`,
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset for your Guardian account.\n\nYour password reset code is: ${code}\n\nOr click this link to reset your password: ${resetUrl}\n\nThis code will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2>Password Reset Request</h2>
          </div>
          <p>Hello,</p>
          <p>We received a request to reset your Guardian account password. Use the code below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f5f5f5; padding: 10px 20px; border-radius: 4px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
              ${code}
            </div>
          </div>
          <p>Or click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>This code will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>The Guardian Team</p>
        </div>
      `
    });
    
    console.log(`[PASSWORD RESET] Email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[PASSWORD RESET] Error sending email:', error);
    throw error; // Re-throw to be handled by the calling function
  }
}

// --- Send Verification Email Helper ---
async function sendVerificationEmail(email: string, verificationCode: string) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationCode}&email=${encodeURIComponent(email)}`;
  
  try {
    await resend.emails.send({
      from: `Shieldlytics <${EMAIL_FROM}>`,
      to: email,
      subject: 'Verify Your Email Address',
      text: `Thank you for registering with Guardian. Your verification code is: ${verificationCode}. You can also verify by clicking this link: ${verificationUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2>Verify Your Email Address</h2>
          </div>
          <p>Hello,</p>
          <p>Thank you for registering with Guardian. Use the verification code below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f5f5f5; padding: 15px 25px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #333;">
              ${verificationCode}
            </div>
          </div>
          <p>Or click the button below to verify automatically:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p>This code will expire in 15 minutes. If you did not create an account, you can safely ignore this email.</p>
          <p>Best regards,<br>The Guardian Team</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="font-size: 12px; color: #777; text-align: center;">
            If you're having trouble with the button above, copy and paste this link into your browser:<br>
            ${verificationUrl}
          </p>
        </div>
      `
    });
    
    console.log(`[VERIFICATION] Email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[VERIFICATION] Error sending email:', error);
    throw error;
  }
}



// ... (rest of the code remains the same)

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
      await prisma.iNVITES.create({
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
      try {
        const { data, error } = await resend.emails.send({
          from: `Shieldlytics <${EMAIL_FROM}>`,
          to: [invite.email],
          subject: 'You have been invited to Guardian!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://shieldlytics.com/logo.png" alt="Shieldlytics" style="height:40px;">
              </div>
              <h2 style="color: #333;">You have been invited to Guardian!</h2>
              <p>Hello,</p>
              <p>You have been invited to join Guardian, a modern security and compliance platform designed to protect your organization and streamline your workflows.</p>
              <p>Please click the button below to accept your invitation and set up your account:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${inviteUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Your Invitation</a>
              </div>
              <p>If you have any questions or did not expect this, please contact our support team at support@shieldlytics.com.</p>
              <p>Best regards,<br>The Shieldlytics Team</p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
              <p style="font-size: 12px; color: #777; text-align: center;">
                If you're having trouble with the button above, copy and paste this link into your browser:<br>
                ${inviteUrl}
              </p>
            </div>
          `,
        });

        if (error) {
          console.error('[RESEND] Error sending email:', error);
          throw error;
        }

        console.log('[RESEND] Email sent successfully:', data);
      } catch (emailErr: any) {
        console.error('[SEND INVITES] Failed to send email:', emailErr);
        console.error('[SEND INVITES] Error details:', emailErr.response?.body?.errors || emailErr.message);
        // Continue execution even if email fails
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

// ... (rest of the code remains the same)

// --- ADD USER ENDPOINT ---
app.post('/api/users', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, roleId, companyId } = req.body;
    
    // Get the admin user's information from the JWT
    const adminUser = req.user as any;
    
    // Validate input
    if (!firstName || !lastName || !email || !roleId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    const existingUser = await prisma.uSERS.findFirst({
      where: { EMAIL: email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Generate a random temporary password
    const generateSimplePassword = () => {
      // Define character sets
      const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing chars like I, O
      const lowercaseChars = 'abcdefghijkmnpqrstuvwxyz'; // Removed confusing chars like l, o
      const numberChars = '23456789'; // Removed confusing chars like 0, 1
      
      // Ensure at least one character from each set
      let password = '';
      password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
      password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
      password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
      
      // Fill the rest with random characters from all sets
      const allChars = uppercaseChars + lowercaseChars + numberChars;
      for (let i = password.length; i < 8; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
      }
      
      // Shuffle the password
      return password.split('').sort(() => 0.5 - Math.random()).join('');
    };
    
    const tempPassword = generateSimplePassword();
    console.log(`[ADD USER] Generated temporary password for ${email}: ${tempPassword}`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Determine the company ID to use
    // First try the company ID from the request, then from the admin user, then null as last resort
    const userCompanyId = companyId || adminUser.COMPANY_ID || null;
    
    console.log('[ADD USER] Using company ID:', userCompanyId, 'Admin user:', adminUser.id);
    
    // Create user in transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create user
      const newUser = await prisma.uSERS.create({
        data: {
          FIRST_NAME: firstName,
          LAST_NAME: lastName,
          EMAIL: email,
          PASSWORD_HASH: hashedPassword,
          STATUS: 'A', // Active
          COMPANY_ID: userCompanyId,
          CREATE_DATE: new Date()
        }
      });
      
      // Assign role
      await prisma.uSER_ROLES.create({
        data: {
          USER_ID: newUser.USER_ID,
          ROLE_ID: Number(roleId)
        }
      });
      
      return newUser;
    });
    
    // Send invitation email with temporary password
    try {
      console.log(`[ADD USER] Sending welcome email to ${email}`);
      
      // Get company information if available
      let companyName = "Guardian";
      if (userCompanyId) {
        try {
          const company = await prisma.cOMPANY.findUnique({
            where: { COMPANY_ID: userCompanyId }
          });
          if (company && company.NAME) {
            companyName = company.NAME;
          }
        } catch (companyErr) {
          console.error('[ADD USER] Error fetching company:', companyErr);
        }
      }
      
      // Get role name
      let roleName = "User";
      try {
        const role = await prisma.rOLES.findUnique({
          where: { ROLE_ID: Number(roleId) }
        });
        if (role && role.NAME) {
          roleName = role.NAME;
        }
      } catch (roleErr) {
        console.error('[ADD USER] Error fetching role:', roleErr);
      }
      
      // Create login URL
      const loginUrl = process.env.NODE_ENV === 'production' 
        ? `${req.protocol}://${req.get('host')}` 
        : 'http://localhost:5175';
      
      // Only try to send email if Resend is configured
      if (resend) {
        try {
          const { data, error } = await resend.emails.send({
            from: `Shieldlytics <${EMAIL_FROM}>`,
            to: [email],
            subject: `Welcome to ${companyName} on Guardian - Your Account Details`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="https://shieldlytics.com/logo.png" alt="Shieldlytics" style="height: 38px; margin-bottom: 18px;">
                </div>
                <h2 style="color: #333; text-align: center;">Welcome to ${companyName} on Guardian!</h2>
                
                <p>Hello ${firstName.toLowerCase()} ${lastName.toLowerCase()},</p>
                
                <p>You have been added to <strong>${companyName}</strong> on the Guardian platform as a <strong>${roleName}</strong>.</p>
                
                <div style="border-left: 4px solid #007bff; padding: 0 0 0 15px; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold;">Your Account Details:</p>
                  <p style="margin: 10px 0 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
                  <p style="margin: 5px 0 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                </div>
                
                <p>Please <a href="${loginUrl}" style="color: #007bff;">login</a> and change your password immediately for security reasons.</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 13px; color: #666;">
                  If you have any questions, please contact your administrator.<br>
                  &copy; ${new Date().getFullYear()} Guardian by Shieldlytics. All rights reserved.
                </p>
              </div>
            `,
          });

          if (error) {
            console.error('[RESEND] Error sending email:', error);
            throw error;
          }

          console.log('[RESEND] Email sent successfully:', data);
        } catch (emailErr: any) {
          console.error('[ADD USER] Failed to send email:', emailErr);
          if (emailErr && typeof emailErr === 'object' && 'message' in emailErr) {
            console.error('[ADD USER] Error details:', emailErr.message);
          }
          // Continue execution even if email fails
        }
      } else {
        console.log('[ADD USER] Email not sent - Resend API key not configured');
        console.log('[ADD USER] Would have sent temporary password:', tempPassword);
      }
    } catch (emailError) {
      console.error('[ADD USER] Error during email sending:', emailError);
      // Continue with the response even if email sending fails
    }
    
    res.status(201).json({
      success: true,
      user: {
        id: result.USER_ID,
        firstName: result.FIRST_NAME,
        lastName: result.LAST_NAME,
        email: result.EMAIL,
        role: roleId,
        companyId: userCompanyId,
        tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
      },
      message: RESEND_API_KEY 
        ? 'User added successfully. An email with login details has been sent.' 
        : 'User added successfully. Email notification is disabled.'
    });
  } catch (err) {
    console.error('[ADD USER]', err);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// --- GET INVITES ENDPOINT ---
app.get('/api/invites', passport.authenticate('jwt', { session: false }), isAdmin, async (req: any, res) => {
  try {
    // Get admin's company ID from JWT token
    const adminCompanyId = req.user.COMPANY_ID;

    if (adminCompanyId === null) {
      return res.status(403).json({ error: 'Admin user is not associated with a company' });
    }

    // Get all invites for the same company
    const invites = await prisma.iNVITES.findMany({
      where: {
        COMPANY_ID: adminCompanyId
      }
    });
    
    // Get roles separately
    const roles = await prisma.rOLES.findMany();
    
    // Create a map of role IDs to role objects for quick lookup
    const roleMap = roles.reduce((map, role) => {
      map[role.ROLE_ID] = role;
      return map;
    }, {} as Record<number, any>);

    // Format the response to match what the frontend expects
    const formattedInvites = invites.map(invite => {
      const role = roleMap[invite.ROLE_ID];
      return {
        id: invite.INVITE_ID,
        email: invite.EMAIL,
        roleId: invite.ROLE_ID,
        roleName: role?.NAME || 'Unknown',
        status: invite.STATUS,
        expiresAt: invite.EXPIRES_AT,
        createdAt: invite.CREATED_AT,
        usedAt: invite.USED_AT,
        companyId: invite.COMPANY_ID
      };
    });

    res.json(formattedInvites);
  } catch (err) {
    console.error('[GET INVITES]', err);
    res.status(500).json({ error: 'Server error while fetching invites' });
  }
});

// --- RESEND INVITE ENDPOINT ---
app.post('/api/invites/resend', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const { inviteId, INVITE_ID } = req.body;
    const id = inviteId || INVITE_ID;
    
    if (!id) {
      return res.status(400).json({ error: 'Invite ID is required' });
    }

    const invite = await prisma.iNVITES.findUnique({
      where: { INVITE_ID: id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Update the invite with a new expiration date
    const updatedInvite = await prisma.iNVITES.update({
      where: { INVITE_ID: id },
      data: {
        EXPIRES_AT: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        STATUS: 'P' // Set status back to pending
      }
    });

    // TODO: Send email with invite link (implement this based on your email sending logic)

    res.json({ success: true, invite: updatedInvite });
  } catch (err) {
    console.error('[RESEND INVITE]', err);
    res.status(500).json({ error: 'Server error while resending invite' });
  }
});

// --- DELETE INVITE ENDPOINT ---
app.delete('/api/invites/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invite ID' });
    }

    const invite = await prisma.iNVITES.findUnique({
      where: { INVITE_ID: id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    await prisma.iNVITES.delete({
      where: { INVITE_ID: id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE INVITE]', err);
    res.status(500).json({ error: 'Server error while deleting invite' });
  }
});

// --- DELETE USER ENDPOINT ---
app.delete('/api/users/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Check if user exists
    const user = await prisma.uSERS.findUnique({
      where: { USER_ID: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow admins to delete themselves
    const adminUser = req.user as any;
    if (adminUser.id === userId) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }
    
    // Delete user in transaction to ensure all related data is removed
    await prisma.$transaction(async (prisma) => {
      // First delete user roles
      await prisma.uSER_ROLES.deleteMany({
        where: { USER_ID: userId }
      });
      
      // Then delete the user
      await prisma.uSERS.delete({
        where: { USER_ID: userId }
      });
    });
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[DELETE USER]', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- DELETE USER ENDPOINT (SIMPLIFIED) ---
app.delete('/api/delete-user/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    console.log(`[DELETE USER] Attempting to delete user with ID: ${userId}`);
    
    // Check if user exists
    const user = await prisma.uSERS.findFirst({ where: { USER_ID: userId } });
    
    if (!user) {
      console.log(`[DELETE USER] User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow admins to delete themselves
    const adminUser = req.user as any;
    if (adminUser.id === userId) {
      console.log(`[DELETE USER] Admin attempted to delete own account: ${userId}`);
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }
    
    console.log(`[DELETE USER] Deleting user: ${userId}`);
    
    // Delete user in transaction to ensure all related data is removed
    await prisma.$transaction(async (prisma) => {
      // First delete user roles
      await prisma.uSER_ROLES.deleteMany({
        where: { USER_ID: userId }
      });
      
      // Then delete the user
      await prisma.uSERS.delete({
        where: { USER_ID: userId }
      });
    });
    
    console.log(`[DELETE USER] Successfully deleted user: ${userId}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[DELETE USER] Error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- TEST DATA ENDPOINT (Development Only) ---
app.post('/api/test/create-sample-requests', passport.authenticate('jwt', { session: false }), async (req: any, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development environment' });
    }

    const userCompanyId = req.user.COMPANY_ID;
    const userId = req.user.id;

    if (userCompanyId === null) {
      return res.status(403).json({ error: 'User is not associated with a company' });
    }

    // Get all users from the same company for assigning requests
    const companyUsers = await prisma.uSERS.findMany({
      where: {
        COMPANY_ID: userCompanyId
      },
      select: {
        USER_ID: true,
        FIRST_NAME: true,
        LAST_NAME: true
      }
    });

    if (companyUsers.length === 0) {
      return res.status(404).json({ error: 'No users found in your company' });
    }

    // Create 10 sample requests
    let createdCount = 0;
    
    // Sample request types
    const requestTypes = [
      'Security Assessment',
      'Vulnerability Scan',
      'Penetration Test',
      'Compliance Review',
      'Security Incident',
      'Access Request',
      'Policy Exception',
      'Security Training'
    ];

    // Sample statuses
    const statuses = ['New', 'In Progress', 'Pending', 'Completed', 'Cancelled'];
    
    // Create requests one by one to avoid TypeScript issues with createMany
    for (let i = 0; i < 10; i++) {
      const requestorId = companyUsers[Math.floor(Math.random() * companyUsers.length)].USER_ID;
      const assignedId = Math.random() > 0.3 ? companyUsers[Math.floor(Math.random() * companyUsers.length)].USER_ID : null;
      const requestType = requestTypes[Math.floor(Math.random() * requestTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Create a date between 1-30 days ago
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - daysAgo);
      
      // Create a tracking ID with format REQ-YYYY-XXXXX
      const year = new Date().getFullYear();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const trackingId = `REQ-${year}-${randomNum}`;

      try {
        await prisma.rEQUESTS.create({
          data: {
            REQUEST_NAME: requestType,
            EXTERNAL_USER: Math.random() > 0.5 ? `external${i}@example.com` : null,
            SUBMITTED_DATE: createdDate,
            REQUESTOR_ID: requestorId,
            ASSIGNED_ID: assignedId,
            STATUS: status,
            CREATE_DATE: createdDate,
            UPDATE_DATE: new Date(),
            CREATE_USER_ID: requestorId,
            UPDATE_USER_ID: assignedId || requestorId
          }
        });
        createdCount++;
      } catch (err) {
        console.error(`Error creating request ${i}:`, err);
      }
    }

    res.json({ 
      message: `Successfully created ${createdCount} sample requests`,
      count: createdCount
    });
  } catch (error) {
    console.error('[CREATE SAMPLE REQUESTS] Error:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message, stack: error.stack });
    } else {
      res.status(500).json({ error: 'Failed to create sample requests', detail: error });
    }
  }
});

app.use('/api/external', externalRoutes);

// Register requests routes
app.use('/api/requests', requestsRoutes);

// For all non-API routes, serve the index.html file (for SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // If it's an API route that wasn't handled, return 404
    return res.status(404).json({ error: 'Not Found' });
  }
  
  // Otherwise serve the SPA
  res.sendFile(join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});
