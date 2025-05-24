import { Request, Response, NextFunction } from 'express';

// Middleware to allow users with admin role_id (1) or JAFAR role_id (6)
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  // AuthUser type: roles: number[]
  // @ts-ignore
  const roles: number[] = req.user?.roles || [];
  // @ts-ignore
  const role: string = req.user?.role || '';
  
  // Check both roles array and role string
  if (roles.includes(1) || roles.includes(6) || role === '1' || role === '6') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin or JAFAR access required.' });
}
