import jwt from 'jsonwebtoken';
import prisma from "../prisma-client.js";
// Middleware to allow users with admin role_id (1) or JAFAR role_id (6)
export async function isAdmin(req, res, next) {
    try {
        // Get the token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No authorization token provided' });
        }
        const token = authHeader.split(' ')[1]; // Get the token part after 'Bearer '
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        // Use the same JWT_SECRET as in auth.ts
        const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        // Get user roles from the database
        const userRoles = await prisma.uSER_ROLES.findMany({
            where: { USER_ID: decoded.id },
            select: { ROLE_ID: true }
        });
        const roleIds = userRoles.map(ur => ur.ROLE_ID);
        const hasAdminAccess = roleIds.includes(1) || roleIds.includes(6);
        if (!hasAdminAccess) {
            return res.status(403).json({
                message: 'Forbidden: Admin or JAFAR access required.',
                debug: {
                    userId: decoded.id,
                    roles: roleIds,
                    hasAdmin: roleIds.includes(1),
                    hasJafar: roleIds.includes(6)
                }
            });
        }
        // Look up COMPANY_ID from database (JWT may not include it, or Prisma ORM may return wrong value)
        let companyId = decoded.companyId || decoded.COMPANY_ID || null;
        if (!companyId) {
            try {
                const userRow = await prisma.$queryRawUnsafe(`SELECT "COMPANY_ID" FROM "GUARDIAN"."USERS" WHERE "USER_ID" = $1`, Number(decoded.id));
                if (userRow && userRow.length > 0) {
                    companyId = userRow[0].COMPANY_ID;
                }
            }
            catch (e) {
                console.error('Error fetching COMPANY_ID for user:', e);
            }
        }
        // Attach user info to the request for downstream middleware
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: roleIds.includes(1) ? '1' : '6',
            COMPANY_ID: companyId,
            USER_ID: decoded.id,
        };
        next();
    }
    catch (error) {
        console.error('Error in isAdmin middleware:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(401).json({
            message: 'Invalid or expired token',
            error: errorMessage
        });
    }
}
