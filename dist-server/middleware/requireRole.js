import { forbid } from '../lib/forbid.js';
import prisma from "../prisma-client.js";
// Mirror of MATRIX from src/utils/permissions.ts. Keep in sync.
const ROLE_PERMS = {
    'securitiesNotice.template.create': [1, 6],
    'securitiesNotice.template.edit': [1, 6],
    'securitiesNotice.send': [3, 4],
    'securitiesNotice.submit': [3],
    'securitiesNotice.approve': [4],
    'securitiesNotice.markRecordsReleased': [3, 4],
    'subpoenaRider.configureLanguage': [1, 6],
    'subpoenaRider.generate': [3, 4],
    'audit.viewFull': [1, 6],
    'audit.viewScoped': [4],
    'audit.export': [1, 6],
    'platform.config': [6],
    'external.viewOwnNotice': [5],
    'external.attachSubpoena': [5],
    'external.requestCall': [5],
};
export function requireRole(permissionKey, action) {
    return async function (req, res, next) {
        const u = req.user;
        const userId = Number(u?.id ?? u?.userId);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });
        const userRoles = await prisma.uSER_ROLES.findMany({
            where: { USER_ID: userId, STATUS: 'P' },
            select: { ROLE_ID: true },
        });
        const allowed = ROLE_PERMS[permissionKey] ?? [];
        const has = userRoles.some((r) => allowed.includes(r.ROLE_ID));
        if (!has)
            return forbid(res, action);
        req.actorRoleId = userRoles[0]?.ROLE_ID ?? null;
        next();
    };
}
