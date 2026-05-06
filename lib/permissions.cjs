/**
 * Role-based access control for the Node.js servers (server.cjs,
 * server.js, server-production.js). Mirrors src/utils/permissions.ts.
 *
 * Phase 2: hybrid. The MATRIX below is the default policy. JAFAR-managed
 * overrides live in GUARDIAN.ROLE_PERMISSIONS / ROLE_FORM_ALLOWLIST /
 * ROLE_NOTICE_TYPE_ALLOWLIST and are read through lib/permissionCache.cjs.
 * Resolution: cache override (deny/grant) > matrix default. If no override
 * exists for a given (role, key), the matrix decides.
 *
 * Source of truth for defaults: guardian_roles_access.md
 */
const cache = require('./permissionCache.cjs');

const ROLE = {
  ADMIN: 1,
  GENERAL_USER: 2,
  PROCESSOR: 3,
  MANAGER: 4,
  EXTERNAL_USER: 5,
  SUPER_ADMIN: 6,
};

const A = ROLE.ADMIN;
const G = ROLE.GENERAL_USER;
const P = ROLE.PROCESSOR;
const M = ROLE.MANAGER;
const E = ROLE.EXTERNAL_USER;
const S = ROLE.SUPER_ADMIN;

const MATRIX = {
  'home.requestQueue':       [A, P, M, S],
  'home.requestOverview':    [A, P, M, S],
  'home.myRequests':         [A, G, P, M, E, S],
  'home.notices':            [A, G, P, M, E, S],

  'requests.new':            [A, G, P, M, E, S],
  'requests.viewAll':        [A, P, M, S],
  'requests.viewAllDetails': [A, P, M, S],
  'requests.viewMy':         [A, G, P, M, E, S],
  'requests.start':          [A, P, M, S],
  'requests.assign':         [A, M, S],
  'requests.reassign':       [A, M, S],
  'requests.tasks':          [A, P, M, S],
  'requests.complete':       [A, P, M, S],

  'notices.new':             [A, P, M, S],
  'notices.viewAll':         [A, P, M, S],
  'notices.viewMy':          [A, G, P, M, E, S],
  'notices.respond':         [A, G, P, M, E, S],

  'workflows.viewTemplates': [A, S],
  'workflows.createTemplate':[A, S],
  'workflows.editTemplate':  [A, S],
  'workflows.deleteTemplate':[A, S],

  'reports.workflow':        [A, M, S],
};

/**
 * Extract numeric role IDs from a user-ish object. Accepts:
 *   - req (with req.userRoles set by auth middleware)
 *   - user object with roles[], ROLE_ID, or role fields
 *   - array of role IDs directly
 */
function extractRoleIds(source) {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source
      .map((r) => (typeof r === 'number' ? r : r?.id ?? r?.ROLE_ID))
      .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  }

  const ids = new Set();

  // Express req with auth middleware (getAuthenticatedUserCompany sets userRoleIds)
  if (Array.isArray(source.userRoleIds)) {
    for (const r of source.userRoleIds) {
      const id = typeof r === 'number' ? r : parseInt(r, 10);
      if (typeof id === 'number' && !Number.isNaN(id)) ids.add(id);
    }
  }
  if (Array.isArray(source.userRoles)) {
    for (const r of source.userRoles) {
      const id = typeof r === 'number' ? r : r?.id ?? r?.ROLE_ID;
      if (typeof id === 'number' && !Number.isNaN(id)) ids.add(id);
    }
  }

  // User object with roles[]
  if (Array.isArray(source.roles)) {
    for (const r of source.roles) {
      const id = typeof r === 'number' ? r : r?.id ?? r?.ROLE_ID;
      if (typeof id === 'number' && !Number.isNaN(id)) ids.add(id);
    }
  }

  // Scalar fields
  if (typeof source.ROLE_ID === 'number') ids.add(source.ROLE_ID);
  if (source.role !== undefined && source.role !== null) {
    const n = typeof source.role === 'number' ? source.role : parseInt(String(source.role), 10);
    if (!Number.isNaN(n)) ids.add(n);
  }

  return [...ids];
}

/**
 * Resolve the effective allow for ONE role on one permission key.
 * Returns true if granted, false if denied. Override beats default.
 */
function effectiveAllow(roleId, key, companyId) {
  const override = cache.lookupOverride('permissions', roleId, key, companyId);
  if (override === true) return true;
  if (override === false) return false;
  const allowed = MATRIX[key];
  return Array.isArray(allowed) && allowed.includes(roleId);
}

function can(source, key) {
  if (!MATRIX[key]) return false; // unknown key — be safe, deny
  const userRoles = extractRoleIds(source);
  if (userRoles.length === 0) return false;
  const companyId = source && typeof source === 'object' ? source.companyId : undefined;
  return userRoles.some((rid) => effectiveAllow(rid, key, companyId));
}

/**
 * Compute the full set of permission keys this user holds. Used by the
 * /api/me/permissions endpoint so the frontend can hydrate its cache.
 */
function effectivePermissionKeys(source) {
  const userRoles = extractRoleIds(source);
  if (userRoles.length === 0) return [];
  const companyId = source && typeof source === 'object' ? source.companyId : undefined;
  const keys = [];
  for (const key of Object.keys(MATRIX)) {
    if (userRoles.some((rid) => effectiveAllow(rid, key, companyId))) keys.push(key);
  }
  return keys;
}

/**
 * Form (request type) allowlist check. If a role has NO entries in the
 * allowlist table, that role is unrestricted (sees all forms). If it
 * has any entries, only forms with GRANTED=1 are allowed.
 *
 * Phase 2 only restricts External User by default; admins/processors/
 * managers stay unrestricted because no rows are written for them.
 */
function canViewForm(source, formId) {
  const userRoles = extractRoleIds(source);
  if (userRoles.length === 0) return false;
  const companyId = source && typeof source === 'object' ? source.companyId : undefined;
  const snap = cache.snapshot();
  for (const rid of userRoles) {
    const roleEntries = snap.formAllowlist?.[rid];
    if (!roleEntries || Object.keys(roleEntries).length === 0) return true; // unrestricted role
    const override = cache.lookupOverride('formAllowlist', rid, formId, companyId);
    if (override === true) return true;
  }
  return false;
}

function canViewNoticeType(source, noticeType) {
  const userRoles = extractRoleIds(source);
  if (userRoles.length === 0) return false;
  const companyId = source && typeof source === 'object' ? source.companyId : undefined;
  const snap = cache.snapshot();
  for (const rid of userRoles) {
    const roleEntries = snap.noticeTypeAllowlist?.[rid];
    if (!roleEntries || Object.keys(roleEntries).length === 0) return true;
    const override = cache.lookupOverride('noticeTypeAllowlist', rid, noticeType, companyId);
    if (override === true) return true;
  }
  return false;
}

function hasRole(source, ...roleIds) {
  const userRoles = extractRoleIds(source);
  return userRoles.some((rid) => roleIds.includes(rid));
}

function isAdmin(source) {
  return hasRole(source, ROLE.ADMIN, ROLE.SUPER_ADMIN);
}

/**
 * Express middleware factory. Usage:
 *   app.put('/api/requests/:id/assign', authenticateToken, requirePermission('requests.assign'), handler);
 *
 * Assumes upstream auth middleware has populated req.userRoles (array of role IDs
 * or {id} objects). Returns 403 on denial.
 */
function requirePermission(key) {
  return (req, res, next) => {
    if (!can(req, key)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Your role does not have permission for: ${key}`,
      });
    }
    return next();
  };
}

module.exports = {
  ROLE,
  MATRIX,
  can,
  hasRole,
  isAdmin,
  extractRoleIds,
  requirePermission,
  effectiveAllow,
  effectivePermissionKeys,
  canViewForm,
  canViewNoticeType,
  cache, // re-exported so server bootstrap can call cache.init(prisma)
};
