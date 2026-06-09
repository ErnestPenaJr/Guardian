import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from "./prisma-client.js";
// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
const JWT_EXPIRES_IN = '24h';
// Zod schema for login validation
export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});
// Test user for development purposes
const TEST_USERS = [
    {
        id: 1,
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        roles: [1] // Admin role
    },
    {
        id: 2,
        email: 'user@example.com',
        password: 'password123',
        firstName: 'Regular',
        lastName: 'User',
        roles: [2] // Regular user role
    }
];
// Type guard to check if an object is a TestUser
function isTestUser(obj) {
    return (obj !== null &&
        typeof obj === 'object' &&
        'id' in obj &&
        'email' in obj &&
        'password' in obj &&
        'firstName' in obj &&
        'lastName' in obj &&
        'roles' in obj &&
        typeof obj.id === 'number' &&
        typeof obj.email === 'string' &&
        typeof obj.password === 'string' &&
        typeof obj.firstName === 'string' &&
        typeof obj.lastName === 'string' &&
        Array.isArray(obj.roles) &&
        obj.roles.every((role) => typeof role === 'number'));
}
// Setup passport local strategy for username/password authentication
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
}, async (email, password, done) => {
    try {
        // For development/testing: Check against test users first
        const testUser = TEST_USERS.find((user) => user.email === email);
        if (testUser && isTestUser(testUser)) {
            if (testUser.password === password) {
                // Return test user for development
                const authenticatedUser = {
                    id: testUser.id,
                    email: testUser.email,
                    firstName: testUser.firstName,
                    lastName: testUser.lastName,
                    roles: testUser.roles,
                    COMPANY_ID: 0, // Add COMPANY_ID to test user
                    username: testUser.email, // Use email as username
                    role: testUser.roles.includes(1) ? '1' : testUser.roles.includes(6) ? '6' : testUser.roles.includes(5) ? '5' : testUser.roles[0]?.toString() || 'user', // Set role as string ID
                };
                return done(null, authenticatedUser);
            }
            else {
                // Test user found but password doesn't match
                return done(null, false, { message: 'Invalid password for test account' });
            }
        }
        // Try to authenticate against the database
        // Use raw SQL to query GUARDIAN schema directly (Prisma ORM queries dbo schema incorrectly)
        try {
            const users = await prisma.$queryRawUnsafe(`
            SELECT u."USER_ID", u."EMAIL", u."FIRST_NAME", u."LAST_NAME", u."STATUS", u."COMPANY_ID",
                   u."PASSWORD_HASH", u."EMAIL_VALIDATED"
            FROM "GUARDIAN"."USERS" u WHERE u."EMAIL" = '${email.replace(/'/g, "''")}'
          `);
            const user = users.length > 0 ? users[0] : null;
            if (!user) {
                return done(null, false, { message: 'User not found with this email address' });
            }
            if (!user.EMAIL_VALIDATED) {
                return done(null, false, { message: 'Email not verified. Please verify your email before logging in' });
            }
            if (user.STATUS !== 'A') {
                return done(null, false, { message: 'Account is not active. Please contact support' });
            }
            if (!user.PASSWORD_HASH) {
                return done(null, false, { message: 'Password not set for this account. Please use password reset' });
            }
            const isPasswordValid = await bcrypt.compare(password, user.PASSWORD_HASH);
            if (!isPasswordValid) {
                return done(null, false, { message: 'Invalid password. Please try again' });
            }
            // Get user roles via raw SQL
            const userRoles = await prisma.$queryRawUnsafe(`
            SELECT "ROLE_ID" FROM "GUARDIAN"."USER_ROLES" WHERE "USER_ID" = ${user.USER_ID} AND "STATUS" = 'P'
          `);
            const roleIds = userRoles.map((ur) => ur.ROLE_ID);
            // Return user without sensitive data, always include roles array
            const authenticatedUser = {
                id: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                roles: Array.isArray(roleIds) ? roleIds : [],
                COMPANY_ID: user.COMPANY_ID, // Pass COMPANY_ID to downstream handlers
                username: user.EMAIL, // Use email as username
                role: roleIds.includes(1) ? 'admin' : 'user', // Determine role based on roles array
            };
            return done(null, authenticatedUser);
        }
        catch (dbError) {
            console.error('Database authentication error:', dbError);
            // If database authentication fails but we have a test user, use that instead
            if (testUser && isTestUser(testUser)) {
                console.log('Falling back to test user authentication');
                const authenticatedUser = {
                    id: testUser.id,
                    email: testUser.email,
                    firstName: testUser.firstName,
                    lastName: testUser.lastName,
                    roles: testUser.roles,
                    COMPANY_ID: 0, // Add COMPANY_ID to test user
                    username: testUser.email, // Use email as username
                    role: testUser.roles.includes(1) ? '1' : testUser.roles.includes(6) ? '6' : testUser.roles.includes(5) ? '5' : testUser.roles[0]?.toString() || 'user', // Set role as string ID
                };
                return done(null, authenticatedUser);
            }
            // Otherwise, pass the error to the callback
            return done(null, false, { message: 'Database authentication failed. Try again later' });
        }
    }
    catch (error) {
        return done(error);
    }
}));
// Setup JWT strategy for token authentication
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
}, async (jwtPayload, done) => {
    try {
        // For development/testing: Check against test users first
        const testUser = TEST_USERS.find((user) => user.id === jwtPayload.id);
        if (testUser && isTestUser(testUser)) {
            const authenticatedUser = {
                id: testUser.id,
                email: testUser.email,
                firstName: testUser.firstName,
                lastName: testUser.lastName,
                roles: testUser.roles,
                COMPANY_ID: 0, // Add COMPANY_ID to test user
                username: testUser.email, // Use email as username
                role: testUser.roles.includes(1) ? 'admin' : 'user', // Determine role based on roles array
            };
            return done(null, authenticatedUser);
        }
        try {
            // Use raw SQL to query GUARDIAN schema directly (Prisma ORM queries dbo schema incorrectly)
            const users = await prisma.$queryRawUnsafe(`
            SELECT u."USER_ID", u."EMAIL", u."FIRST_NAME", u."LAST_NAME", u."STATUS", u."COMPANY_ID"
            FROM "GUARDIAN"."USERS" u WHERE u."USER_ID" = ${jwtPayload.id}
          `);
            const user = users.length > 0 ? users[0] : null;
            if (!user) {
                return done(null, false, { message: 'User not found with token ID' });
            }
            if (user.STATUS !== 'A') {
                return done(null, false, { message: 'Account is not active' });
            }
            // Get user roles via raw SQL
            const userRoles = await prisma.$queryRawUnsafe(`
            SELECT "ROLE_ID" FROM "GUARDIAN"."USER_ROLES" WHERE "USER_ID" = ${user.USER_ID} AND "STATUS" = 'P'
          `);
            const roleIds = userRoles.map((ur) => ur.ROLE_ID);
            const authenticatedUser = {
                id: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                roles: roleIds,
                COMPANY_ID: user.COMPANY_ID,
                username: user.EMAIL,
                role: roleIds.includes(1) ? 'admin' : 'user', // Determine role based on roles array
            };
            return done(null, authenticatedUser);
        }
        catch (dbError) {
            console.error('Database JWT verification error:', dbError);
            // If database verification fails but we have a test user, use that instead
            const fallbackUser = TEST_USERS.find((user) => user.id === jwtPayload.id);
            if (fallbackUser && isTestUser(fallbackUser)) {
                console.log('Falling back to test user for JWT verification');
                const authenticatedUser = {
                    id: fallbackUser.id,
                    email: fallbackUser.email,
                    firstName: fallbackUser.firstName,
                    lastName: fallbackUser.lastName,
                    roles: fallbackUser.roles,
                    COMPANY_ID: 0, // Add COMPANY_ID to test user
                    username: fallbackUser.email, // Use email as username
                    role: fallbackUser.roles.includes(1) ? 'admin' : 'user', // Determine role based on roles array
                };
                return done(null, authenticatedUser);
            }
            return done(null, false, { message: 'Token verification failed' });
        }
    }
    catch (error) {
        return done(error);
    }
}));
// Generate JWT token
export const generateToken = (user) => {
    return jwt.sign({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        COMPANY_ID: user.COMPANY_ID, // Add COMPANY_ID to JWT payload
        username: user.username, // Add username to JWT payload
        role: user.role, // Add role to JWT payload
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
// Middleware to require authentication
export const requireAuth = passport.authenticate('jwt', { session: false });
// Helper to hash passwords using bcrypt
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};
// Export the configured passport instance
export { passport };
