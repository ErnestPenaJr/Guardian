import { Request, Response, NextFunction } from 'express';

// Middleware to allow only users with admin role_id (1)
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  // AuthUser type: roles: number[]
  // @ts-ignore
  const roles: number[] = req.user?.roles || [];
  if (roles.includes(1)) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admins only.' });
}
