import { hasPermission } from '../models/permissions';
// Middleware to check if a user has a specific permission
export function checkPermission(permissionType, resourceType) {
    return (req, res, next) => {
        // Get the authenticated user from the request
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized: Authentication required' });
        }
        // If user has roles but no permissions, we need to fetch them
        // For now, we'll just check if they're an admin (role_id 1)
        if (user.roles.includes(1)) {
            // Admin has all permissions
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
