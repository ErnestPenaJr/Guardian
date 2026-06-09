import type { Request, Response, NextFunction } from 'express'

import prisma from "../prisma-client.js";

export async function requireJafar(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as { id?: number; userId?: number } | undefined
    const userId = Number(authUser?.id ?? authUser?.userId)

    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userRoles = await prisma.uSER_ROLES.findMany({
      where: {
        USER_ID: userId,
        STATUS: 'P'
      },
      select: {
        ROLE_ID: true
      }
    })

    const isJafar = userRoles.some((role) => role.ROLE_ID === 6)
    if (!isJafar) {
      return res.status(403).json({ error: 'JAFAR access required' })
    }

    next()
  } catch (error) {
    console.error('[JAFAR AUTH] Failed to verify JAFAR access:', error)
    res.status(500).json({ error: 'Failed to verify JAFAR access' })
  }
}
