import { Request, Response, NextFunction } from 'express';

// Middleware to allow only users with manager role_id (3)
export function isManager(req: Request, res: Response, next: NextFunction) {
  // AuthUser type: role: string
  // @ts-ignore
  const role: string = req.user?.role || '';
  if (role === '1' || role === '3') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Managers only.' });
}

// Middleware to check if user is manager of a specific group/organization
export function isGroupManager(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user;
  const role: string = user?.role || '';
  // Using type assertion since COMPANY_ID is not in the User type but exists at runtime
  const companyId = (user as any)?.COMPANY_ID;
  const requestCompanyId = parseInt(req.params.companyId || req.body.companyId);
  
  // Admin can access any group
  if (role === '1') {
    return next();
  }
  
  // Manager can only access their own group
  if (role === '3' && companyId === requestCompanyId) {
    return next();
  }
  
  return res.status(403).json({ 
    message: 'Forbidden: You can only access data for your own group/organization.' 
  });
}

// Middleware to filter data to only show manager's group
export function filterToManagerGroup(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user;
  const role: string = user?.role || '';
  // Using type assertion since COMPANY_ID is not in the User type but exists at runtime
  const companyId = (user as any)?.COMPANY_ID;
  
  // If user is admin, don't filter
  if (role === '1') {
    return next();
  }
  
  // If user is manager, add company filter to query
  if (role === '3' && companyId) {
    // @ts-ignore
    req.companyFilter = companyId;
  }
  
  next();
}
