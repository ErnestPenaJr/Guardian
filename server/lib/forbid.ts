// server/lib/forbid.ts
import type { Response } from 'express';

export function forbid(res: Response, action: string): Response {
  return res.status(403).json({ error: `You do not have permission to ${action}.` });
}
