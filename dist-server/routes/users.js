import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAdmin } from '../middleware/isAdmin.js';
import { requireAuth } from '../auth.js';
import { Resend } from 'resend';
import bcrypt from 'bcryptjs';
import passport from 'passport';
const router = express.Router();
const prisma = new PrismaClient();
// Initialize Resend client
const RESEND_API_KEY = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
const resend = new Resend(RESEND_API_KEY);
// Create a new user (admin only)
router.post('/', requireAuth, isAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, roleId, companyId } = req.body;
        // Get the admin user's information from the JWT
        const adminUser = req.user;
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
                }
                catch (companyErr) {
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
            }
            catch (roleErr) {
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
                }
                catch (emailErr) {
                    console.error('[ADD USER] Failed to send email:', emailErr);
                    if (emailErr && typeof emailErr === 'object' && 'message' in emailErr) {
                        console.error('[ADD USER] Error details:', emailErr.message);
                    }
                    // Continue execution even if email fails
                }
            }
            else {
                console.log('[ADD USER] Email not sent - Resend API key not configured');
                console.log('[ADD USER] Would have sent temporary password:', tempPassword);
            }
        }
        catch (emailError) {
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
    }
    catch (err) {
        console.error('[ADD USER]', err);
        res.status(500).json({ error: 'Failed to add user' });
    }
});
// Get assignable users for request assignment (any authenticated user can access)
router.get('/assignable', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        // Get the company ID from the authenticated user
        const companyId = req.user?.COMPANY_ID;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }
        console.log(`[USERS] Fetching assignable users for company ID: ${companyId}`);
        // Query users from the same company for assignment purposes
        const users = await prisma.uSERS.findMany({
            where: {
                COMPANY_ID: companyId,
                STATUS: 'A' // Only active users
            },
            select: {
                USER_ID: true,
                FIRST_NAME: true,
                LAST_NAME: true,
                EMAIL: true,
                COMPANY_ID: true
            },
            orderBy: [
                { LAST_NAME: 'asc' },
                { FIRST_NAME: 'asc' }
            ]
        });
        // Ensure the requesting user is included in the options (creator should be selectable)
        const requestingUserId = req.user?.USER_ID;
        if (requestingUserId && !users.some(u => u.USER_ID === requestingUserId)) {
            try {
                const requestingUser = await prisma.uSERS.findFirst({
                    where: {
                        USER_ID: requestingUserId,
                        COMPANY_ID: companyId,
                        STATUS: 'A'
                    },
                    select: {
                        USER_ID: true,
                        FIRST_NAME: true,
                        LAST_NAME: true,
                        EMAIL: true,
                        COMPANY_ID: true
                    }
                });
                if (requestingUser) {
                    users.unshift(requestingUser);
                }
            }
            catch (_err) {
                // Ignore and continue returning the base list
            }
        }
        // Format the response to match the expected structure
        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            EMAIL: user.EMAIL,
            COMPANY_ID: user.COMPANY_ID,
            ROLE_NAMES: 'User', // Default role name for assignment purposes
            value: user.USER_ID,
            label: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            subtitle: user.EMAIL
        }));
        console.log(`[USERS] Found ${formattedUsers.length} assignable users`);
        res.json(formattedUsers);
    }
    catch (error) {
        console.error('[USERS] Error fetching assignable users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assignable users'
        });
    }
});
// Get all users for the current company (admin only)
router.get('/', isAdmin, async (req, res) => {
    try {
        // Get the company ID from the authenticated user (now set by isAdmin middleware)
        const companyId = req.user?.COMPANY_ID;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required',
                debug: { user: req.user }
            });
        }
        console.log(`[USERS] Fetching users for company ID: ${companyId}`);
        // First, get users filtered by company using USERS table directly
        let users;
        try {
            // Query users directly from USERS table by COMPANY_ID
            console.log(`[USERS] Querying USERS table for company ID: ${companyId}`);
            users = await prisma.uSERS.findMany({
                where: {
                    COMPANY_ID: companyId,
                    STATUS: 'A'
                },
                orderBy: [
                    { LAST_NAME: 'asc' },
                    { FIRST_NAME: 'asc' }
                ],
                select: {
                    USER_ID: true,
                    FIRST_NAME: true,
                    LAST_NAME: true,
                    EMAIL: true,
                    STATUS: true,
                    CREATE_DATE: true,
                    COMPANY_ID: true
                }
            });
            console.log(`[USERS] Found ${users.length} active users for company ID: ${companyId}`);
        }
        catch (error) {
            console.error('Error fetching users by company:', error);
            // Fallback to all users if company filtering fails
            try {
                users = await prisma.uSERS.findMany({
                    where: {
                        STATUS: 'A'
                    },
                    orderBy: [
                        { LAST_NAME: 'asc' },
                        { FIRST_NAME: 'asc' }
                    ],
                    select: {
                        USER_ID: true,
                        FIRST_NAME: true,
                        LAST_NAME: true,
                        EMAIL: true,
                        STATUS: true,
                        CREATE_DATE: true,
                        COMPANY_ID: true
                    }
                });
                console.log('Fallback: returning all users due to company filtering error');
            }
            catch (fallbackError) {
                console.error('Fallback query also failed:', fallbackError);
                throw fallbackError;
            }
        }
        // Transform the data to match the expected format
        const formattedUsers = users.map(user => ({
            id: user.USER_ID,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            email: user.EMAIL,
            status: user.STATUS,
            createdAt: user.CREATE_DATE,
            companyId: user.COMPANY_ID || companyId // Use the company ID from the database, fallback to token
        }));
        // Then, get roles for each user using Prisma ORM
        const usersWithRoles = await Promise.all(formattedUsers.map(async (user) => {
            try {
                // Get user roles using Prisma ORM - first try without STATUS filter
                const allUserRoles = await prisma.uSER_ROLES.findMany({
                    where: {
                        USER_ID: user.id
                    },
                    select: {
                        ROLE_ID: true,
                        STATUS: true
                    }
                });
                console.log(`[USERS] User ${user.id} (${user.firstName} ${user.lastName}) all roles:`, allUserRoles);
                const userRoles = await prisma.uSER_ROLES.findMany({
                    where: {
                        USER_ID: user.id,
                        STATUS: 'P'
                    },
                    select: {
                        ROLE_ID: true
                    }
                });
                console.log(`[USERS] User ${user.id} (${user.firstName} ${user.lastName}) has ${userRoles.length} active roles:`, userRoles.map(ur => ur.ROLE_ID));
                // Get role details for each role ID
                const roleIds = userRoles.map(ur => ur.ROLE_ID);
                let roles = [];
                if (roleIds.length > 0) {
                    try {
                        roles = await prisma.rOLES.findMany({
                            where: {
                                ROLE_ID: { in: roleIds }
                            },
                            select: {
                                ROLE_ID: true,
                                NAME: true,
                                DISPLAY_NAME: true
                            },
                            orderBy: {
                                NAME: 'asc'
                            }
                        });
                    }
                    catch (roleError) {
                        console.error(`Error fetching roles from ROLES table for user ${user.id}:`, roleError);
                        // If ROLES table doesn't exist, create mock roles based on role IDs
                        roles = roleIds.map(roleId => ({
                            ROLE_ID: roleId,
                            NAME: `Role ${roleId}`,
                            DISPLAY_NAME: `Role ${roleId}`
                        }));
                    }
                }
                // Transform roles to expected format
                const formattedRoles = roles.map(role => ({
                    id: role.ROLE_ID,
                    name: role.NAME,
                    displayName: role.DISPLAY_NAME
                }));
                return {
                    ...user,
                    roles: formattedRoles
                };
            }
            catch (error) {
                console.error(`Error fetching roles for user ${user.id}:`, error);
                // Return user without roles if there's an error
                return {
                    ...user,
                    roles: []
                };
            }
        }));
        res.json({
            success: true,
            data: usersWithRoles
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: errorMessage
        });
    }
});
// Update user endpoint
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { firstName, lastName, email, roleId, status } = req.body;
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }
        // Validate required fields
        if (!firstName || !lastName || !email || !roleId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        console.log(`[UPDATE USER] Updating user ${userId} with data:`, { firstName, lastName, email, roleId, status });
        // Check if user exists
        const existingUser = await prisma.uSERS.findUnique({
            where: { USER_ID: userId }
        });
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Update user in transaction
        await prisma.$transaction(async (prisma) => {
            // Update user basic information
            await prisma.uSERS.update({
                where: { USER_ID: userId },
                data: {
                    FIRST_NAME: firstName,
                    LAST_NAME: lastName,
                    EMAIL: email,
                    STATUS: status,
                    UPDATE_DATE: new Date()
                }
            });
            // Update user role - first delete existing roles, then add new one
            await prisma.uSER_ROLES.deleteMany({
                where: { USER_ID: userId }
            });
            await prisma.uSER_ROLES.create({
                data: {
                    USER_ID: userId,
                    ROLE_ID: Number(roleId),
                    STATUS: 'A',
                    CREATE_DATE: new Date(),
                    UPDATE_DATE: new Date()
                }
            });
        });
        console.log(`[UPDATE USER] Successfully updated user ${userId}`);
        res.json({
            success: true,
            message: 'User updated successfully'
        });
    }
    catch (error) {
        console.error('[UPDATE USER] Error updating user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: errorMessage
        });
    }
});
// Delete user endpoint
router.delete('/:id', requireAuth, isAdmin, async (req, res) => {
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
        const adminUser = req.user;
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
    }
    catch (err) {
        console.error('[DELETE USER]', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
export default router;
