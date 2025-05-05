// Middleware to allow only users with processor role_id (5)
export function isProcessor(req, res, next) {
    // AuthUser type: role: string
    // @ts-ignore
    const role = req.user?.role || '';
    if (role === '1' || role === '5') {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: Processors only.' });
}
// Middleware to check if user is processor of a specific group/organization
export function isGroupProcessor(req, res, next) {
    // @ts-ignore
    const user = req.user;
    const role = user?.role || '';
    // Using type assertion since COMPANY_ID is not in the User type but exists at runtime
    const companyId = user?.COMPANY_ID;
    const requestCompanyId = parseInt(req.params.companyId || req.body.companyId);
    // Admin can access any group
    if (role === '1') {
        return next();
    }
    // Processor can only access their own group
    if (role === '5' && companyId === requestCompanyId) {
        return next();
    }
    return res.status(403).json({
        message: 'Forbidden: You can only process workflows for your own group/organization.'
    });
}
// Middleware to filter data to only show processor's group
export function filterToProcessorGroup(req, res, next) {
    // @ts-ignore
    const user = req.user;
    const role = user?.role || '';
    // Using type assertion since COMPANY_ID is not in the User type but exists at runtime
    const companyId = user?.COMPANY_ID;
    // If user is admin, don't filter
    if (role === '1') {
        return next();
    }
    // If user is processor, add company filter to query
    if (role === '5' && companyId) {
        // @ts-ignore
        req.companyFilter = companyId;
    }
    next();
}
