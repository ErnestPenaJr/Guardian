// Middleware to check if user is an external user (role_id 6)
export function isExternalUser(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    if (role === '6') {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: External users only.' });
}
// Middleware to allow both external users and internal users
export function allowExternalUser(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    // Set a flag to indicate if the user is external
    // @ts-ignore
    req.isExternal = role === '6';
    return next();
}
// Middleware to filter external user's access to only their own data
export function filterExternalUserData(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    // @ts-ignore
    const userId = req.user?.id;
    // If user is an external user, add filters
    if (role === '6' && userId) {
        // @ts-ignore
        req.externalUserFilter = {
            userId,
            // Add any other filters specific to external users
            externalOnly: true
        };
    }
    next();
}
