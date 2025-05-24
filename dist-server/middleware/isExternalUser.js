// Middleware to check if user is an external user (role_id 5) or JAFAR developer (role_id 6)
export function isExternalUser(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    if (role === '5' || role === '6') {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: External users only.' });
}
// Middleware to allow both external users and internal users
export function allowExternalUser(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    // Set flags to indicate user type
    // @ts-ignore
    req.isExternal = role === '5';
    // @ts-ignore
    req.isJafarDeveloper = role === '6';
    return next();
}
// Middleware to filter external user's access to only their own data
export function filterExternalUserData(req, res, next) {
    // @ts-ignore
    const role = req.user?.role || '';
    // @ts-ignore
    const userId = req.user?.id;
    // If user is an external user, add filters (JAFAR developers bypass filters)
    if (role === '6') {
        // JAFAR developers have full access, no filters
        next();
        return;
    }
    if (role === '5' && userId) {
        // @ts-ignore
        req.externalUserFilter = {
            userId,
            // Add any other filters specific to external users
            externalOnly: true
        };
    }
    next();
}
