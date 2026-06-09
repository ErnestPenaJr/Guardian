// server/middleware/requireExternalUser.ts
//
// Phase 7 / US-SRB-03 — Role-5 (External User) gate for the external portal.
// Mirrors the pattern of requireJafar.ts.
import type { Request, Response, NextFunction } from 'express';
import { forbid } from '../lib/forbid.js';

import prisma from "../prisma-client.js";

export async function requireExternalUser(req: Request, res: Response, next: NextFunction) {
  try {
    const u = req.user as { id?: number; userId?: number } | undefined;
    const userId = Number(u?.id ?? u?.userId);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const roles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId, STATUS: 'P' },
      select: { ROLE_ID: true },
    });
    if (!roles.some((r) => r.ROLE_ID === 5)) {
      return forbid(res, 'access this external portal');
    }
    next();
  } catch (err) {
    console.error('[requireExternalUser]', err);
    return res.status(500).json({ error: 'Failed to verify external portal access' });
  }
}
