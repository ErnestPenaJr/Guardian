import { Request, Response, NextFunction } from "express";

/** Role IDs allowed to create/edit notices: Admin (1), Manager (3), Processor (5), Super Admin (6) */
const ALLOWED_ROLE_IDS = [1, 3, 5, 6];

/**
 * Middleware to allow only users with isAdmin, isManager, or isProcessor roles
 * to create or update notices. Must run after requireAuth so req.user.roles is set.
 */
export function canCreateNotice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.user as { roles?: number[] } | undefined;
  if (!user) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Authentication required" });
  }
  const roleIds = user.roles ?? [];
  const allowed = roleIds.some((id) => ALLOWED_ROLE_IDS.includes(id));
  if (!allowed) {
    return res.status(403).json({
      message:
        "Forbidden: Only Admin, Manager, or Processor can create or update notices.",
    });
  }
  next();
}
