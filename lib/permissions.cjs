/**
 * Role-based access control for the Node.js servers (server.cjs,
 * server.js, server-production.js). Mirrors src/utils/permissions.ts.
 *
 * Phase 1: hardcoded matrix. Phase 2 will swap MATRIX for a DB lookup
 * backed by the JAFAR role-settings UI. Call sites use `can(user, key)`.
 *
 * Source of truth: guardian_roles_access.md
 */

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

function can(source, key) {
  const allowed = MATRIX[key];
  if (!allowed) return false;
  const userRoles = extractRoleIds(source);
  if (userRoles.length === 0) return false;
  return userRoles.some((rid) => allowed.includes(rid));
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
};
