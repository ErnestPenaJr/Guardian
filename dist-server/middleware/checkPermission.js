import { hasPermission } from '../models/permissions.js';
// Middleware to check if a user has a specific permission
export function checkPermission(permissionType, resourceType) {
    return (req, res, next) => {
        // Get the authenticated user from the request
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: Authentication required' });
        }
        // If user has roles but no permissions, we need to fetch them
        // Check if user is an admin (role_id 1) or has JAFAR developer role (role_id 6)
        if (user.roles.includes(1) || user.roles.includes(6)) {
            // Admin and JAFAR developer have all permissions
            return next();
        }
        // If user has explicit permissions, check them
        if (user.permissions && hasPermission(user.permissions, permissionType, resourceType)) {
            return next();
        }
        // Otherwise, deny access
        return res.status(403).json({
            message: 'Forbidden: You do not have permission to perform this action'
        });
    };
}
