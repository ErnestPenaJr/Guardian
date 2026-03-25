import { PrismaClient } from "@prisma/client";
import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";

const prisma = new PrismaClient();

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "guardian-jwt-secret-key";
const JWT_EXPIRES_IN = "24h";

// Zod schema for login validation
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Define test user type
interface TestUser {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: number[];
}

// Define authenticated user type (for token generation)
interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: number[];
  COMPANY_ID: number | null; // Allow null for COMPANY_ID
  username: string; // Add username property
  role: string; // Add role property
}

// Test user for development purposes
const TEST_USERS: TestUser[] = [
  {
    id: 1,
    email: "admin@example.com",
    password: "password123",
    firstName: "Admin",
    lastName: "User",
    roles: [1], // Admin role
  },
  {
    id: 2,
    email: "user@example.com",
    password: "password123",
    firstName: "Regular",
    lastName: "User",
    roles: [2], // Regular user role
  },
];

// Type guard to check if an object is a TestUser
function isTestUser(obj: any): obj is TestUser {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "email" in obj &&
    "password" in obj &&
    "firstName" in obj &&
    "lastName" in obj &&
    "roles" in obj &&
    typeof obj.id === "number" &&
    typeof obj.email === "string" &&
    typeof obj.password === "string" &&
    typeof obj.firstName === "string" &&
    typeof obj.lastName === "string" &&
    Array.isArray(obj.roles) &&
    obj.roles.every((role: number) => typeof role === "number")
  );
}

// Setup passport local strategy for username/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // For development/testing: Check against test users first
        const testUser = TEST_USERS.find((user) => user.email === email);

        if (testUser && isTestUser(testUser)) {
          if (testUser.password === password) {
            // Return test user for development
            const authenticatedUser: AuthUser = {
              id: testUser.id,
              email: testUser.email,
              firstName: testUser.firstName,
              lastName: testUser.lastName,
              roles: testUser.roles,
              COMPANY_ID: 0, // Add COMPANY_ID to test user
              username: testUser.email, // Use email as username
              role: testUser.roles.includes(1)
                ? "1"
                : testUser.roles.includes(6)
                  ? "6"
                  : testUser.roles.includes(5)
                    ? "5"
                    : testUser.roles[0]?.toString() || "user", // Set role as string ID
            };
            return done(null, authenticatedUser);
          } else {
            // Test user found but password doesn't match
            return done(null, false, {
              message: "Invalid password for test account",
            });
          }
        }

        // Try to authenticate against the database
        try {
          // Find user by email
          const user = await prisma.uSERS.findFirst({
            where: {
              EMAIL: email,
            },
          });

          if (!user) {
            return done(null, false, {
              message: "User not found with this email address",
            });
          }

          // Check if email is validated
          if (!user.EMAIL_VALIDATED) {
            return done(null, false, {
              message:
                "Email not verified. Please verify your email before logging in",
            });
          }

          // Check if user is active
          if (user.STATUS !== "A") {
            return done(null, false, {
              message: "Account is not active. Please contact support",
            });
          }

          // Check if password is correct
          // Make sure passwordHash is not null
          if (!user.PASSWORD_HASH) {
            return done(null, false, {
              message:
                "Password not set for this account. Please use password reset",
            });
          }

          // Use bcrypt to compare passwords
          const isPasswordValid = await bcrypt.compare(
            password,
            user.PASSWORD_HASH,
          );
          if (!isPasswordValid) {
            return done(null, false, {
              message: "Invalid password. Please try again",
            });
          }

          // Get user roles
          const userRoles = await prisma.uSER_ROLES.findMany({
            where: { USER_ID: user.USER_ID },
          });

          // Get role IDs
          const roleIds = userRoles.map(
            (ur: { ROLE_ID: number }) => ur.ROLE_ID,
          );

          // Return user without sensitive data, always include roles array
          const authenticatedUser: AuthUser = {
            id: user.USER_ID,
            email: user.EMAIL,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            roles: Array.isArray(roleIds) ? roleIds : [],
            COMPANY_ID: user.COMPANY_ID, // Pass COMPANY_ID to downstream handlers
            username: user.EMAIL, // Use email as username
            role: roleIds.includes(1) ? "admin" : "user", // Determine role based on roles array
          };
          return done(null, authenticatedUser);
        } catch (dbError) {
          console.error("Database authentication error:", dbError);
          // If database authentication fails but we have a test user, use that instead
          if (testUser && isTestUser(testUser)) {
            console.log("Falling back to test user authentication");
            const authenticatedUser: AuthUser = {
              id: (testUser as TestUser).id,
              email: (testUser as TestUser).email,
              firstName: (testUser as TestUser).firstName,
              lastName: (testUser as TestUser).lastName,
              roles: (testUser as TestUser).roles,
              COMPANY_ID: 0, // Add COMPANY_ID to test user
              username: (testUser as TestUser).email, // Use email as username
              role: (testUser as TestUser).roles.includes(1)
                ? "1"
                : (testUser as TestUser).roles.includes(6)
                  ? "6"
                  : (testUser as TestUser).roles.includes(5)
                    ? "5"
                    : (testUser as TestUser).roles[0]?.toString() || "user", // Set role as string ID
            };
            return done(null, authenticatedUser);
          }
          // Otherwise, pass the error to the callback
          return done(null, false, {
            message: "Database authentication failed. Try again later",
          });
        }
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// Setup JWT strategy for token authentication
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
    },
    async (jwtPayload, done) => {
      try {
        // For development/testing: Check against test users first
        const testUser = TEST_USERS.find((user) => user.id === jwtPayload.id);

        if (testUser && isTestUser(testUser)) {
          const authenticatedUser: AuthUser = {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            roles: testUser.roles,
            COMPANY_ID: 0, // Add COMPANY_ID to test user
            username: testUser.email, // Use email as username
            role: testUser.roles.includes(1) ? "admin" : "user", // Determine role based on roles array
          };
          return done(null, authenticatedUser);
        }

        try {
          // Find user by ID from JWT payload
          const user = await prisma.uSERS.findUnique({
            where: { USER_ID: jwtPayload.id },
          });

          if (!user) {
            return done(null, false, {
              message: "User not found with token ID",
            });
          }

          // Check if user is active
          if (user.STATUS !== "A") {
            return done(null, false, { message: "Account is not active" });
          }

          // Get user roles
          const userRoles = await prisma.uSER_ROLES.findMany({
            where: { USER_ID: user.USER_ID },
          });

          // Get role IDs
          const roleIds = userRoles.map(
            (ur: { ROLE_ID: number }) => ur.ROLE_ID,
          );

          // Return user without sensitive data
          const authenticatedUser: AuthUser = {
            id: user.USER_ID,
            email: user.EMAIL,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            roles: roleIds,
            COMPANY_ID: user.COMPANY_ID, // Pass COMPANY_ID to downstream handlers
            username: user.EMAIL, // Use email as username
            role: roleIds.includes(1) ? "admin" : "user", // Determine role based on roles array
          };
          return done(null, authenticatedUser);
        } catch (dbError) {
          console.error("Database JWT verification error:", dbError);
          // If database verification fails but we have a test user, use that instead
          const fallbackUser = TEST_USERS.find(
            (user) => user.id === jwtPayload.id,
          );

          if (fallbackUser && isTestUser(fallbackUser)) {
            console.log("Falling back to test user for JWT verification");
            const authenticatedUser: AuthUser = {
              id: fallbackUser.id,
              email: fallbackUser.email,
              firstName: fallbackUser.firstName,
              lastName: fallbackUser.lastName,
              roles: fallbackUser.roles,
              COMPANY_ID: 0, // Add COMPANY_ID to test user
              username: fallbackUser.email, // Use email as username
              role: fallbackUser.roles.includes(1) ? "admin" : "user", // Determine role based on roles array
            };
            return done(null, authenticatedUser);
          }
          return done(null, false, { message: "Token verification failed" });
        }
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// Generate JWT token
export const generateToken = (user: AuthUser) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      COMPANY_ID: user.COMPANY_ID, // Add COMPANY_ID to JWT payload
      username: user.username, // Add username to JWT payload
      role: user.role, // Add role to JWT payload
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
};

// Middleware to require authentication
export const requireAuth = passport.authenticate("jwt", { session: false });
console.log(requireAuth, "requireAuth");

// Helper to hash passwords using bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Export the configured passport instance
export { passport };
