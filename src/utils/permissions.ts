/**
 * Role-based access control — Phase 1 (hardcoded matrix).
 *
 * Phase 2 will replace the MATRIX constant with a DB-driven lookup managed
 * by JAFAR (role 6) via the admin dashboard. Call sites use `can(user, key)`
 * and do not need to change.
 *
 * Matrix source of truth: guardian_roles_access.md
 */

export const ROLE = {
  ADMIN: 1,
  GENERAL_USER: 2,
  PROCESSOR: 3,
  MANAGER: 4,
  EXTERNAL_USER: 5,
  SUPER_ADMIN: 6,
} as const;

export type RoleId = typeof ROLE[keyof typeof ROLE];

export type PermissionKey =
  // Home / landing
  | 'home.requestQueue'
  | 'home.requestOverview'
  | 'home.myRequests'
  | 'home.notices'
  // Requests
  | 'requests.new'
  | 'requests.viewAll'
  | 'requests.viewAllDetails'
  | 'requests.viewMy'
  | 'requests.start'
  | 'requests.assign'
  | 'requests.reassign'
  | 'requests.tasks'
  | 'requests.complete'
  // Notices
  | 'notices.new'
  | 'notices.viewAll'
  | 'notices.viewMy'
  | 'notices.respond'
  // Workflows (request type / form templates)
  | 'workflows.viewTemplates'
  | 'workflows.createTemplate'
  | 'workflows.editTemplate'
  | 'workflows.deleteTemplate'
  // Reporting
  | 'reports.workflow';

const A = ROLE.ADMIN;
const G = ROLE.GENERAL_USER;
const P = ROLE.PROCESSOR;
const M = ROLE.MANAGER;
const E = ROLE.EXTERNAL_USER;
const S = ROLE.SUPER_ADMIN;

/**
 * Hardcoded matrix. Each key lists role IDs that have access.
 * Super Admin (S) inherits Admin wherever Admin has access.
 */
const MATRIX: Record<PermissionKey, readonly RoleId[]> = {
  'home.requestQueue':       [A, P, M, S],
  'home.requestOverview':    [A, P, M, S],
  'home.myRequests':         [A, G, P, M, E, S],
  'home.notices':            [A, G, P, M, E, S],

  'requests.new':            [A, G, P, M, E, S], // External restricted to permitted types (Phase 2)
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
  'notices.viewMy':          [A, G, P, M, E, S], // External restricted to permitted types (Phase 2)
  'notices.respond':         [A, G, P, M, E, S],

  'workflows.viewTemplates': [A, S],
  'workflows.createTemplate':[A, S],
  'workflows.editTemplate':  [A, S],
  'workflows.deleteTemplate':[A, S],

  'reports.workflow':        [A, M, S],
};

export interface UserLike {
  roles?: Array<{ id?: number; ROLE_ID?: number }> | null;
  role?: string | number | null;
  ROLE_ID?: number;
}

/**
 * Extract numeric role IDs from a user object. Handles both frontend
 * (roles[].id) and backend (req.userRoles) shapes.
 */
export function extractRoleIds(user: UserLike | null | undefined): number[] {
  if (!user) return [];
  const ids = new Set<number>();

  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      const id = r?.id ?? r?.ROLE_ID;
      if (typeof id === 'number' && !Number.isNaN(id)) ids.add(id);
    }
  }

  if (typeof user.ROLE_ID === 'number') ids.add(user.ROLE_ID);

  if (user.role !== undefined && user.role !== null) {
    const n = typeof user.role === 'number' ? user.role : parseInt(String(user.role), 10);
    if (!Number.isNaN(n)) ids.add(n);
  }

  return [...ids];
}

/**
 * Effective permissions cache populated from /api/me/permissions on app load.
 * When set, can() consults this Set first; otherwise it falls back to the
 * hardcoded MATRIX (Phase 1 behavior). Persisted to localStorage so that
 * page reloads don't briefly flash unauthorized UI.
 */
const STORAGE_KEY = 'effective_permissions';
let effectivePermissions: Set<string> | null = null;

function loadEffectiveFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) effectivePermissions = new Set(parsed);
  } catch {
    // Corrupt storage: ignore and fall back to matrix.
  }
}
loadEffectiveFromStorage();

export function setEffectivePermissions(keys: string[] | null): void {
  if (keys === null) {
    effectivePermissions = null;
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  effectivePermissions = new Set(keys);
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* quota */ }
  }
}

/** Does the user have permission for the given key? */
export function can(user: UserLike | null | undefined, key: PermissionKey): boolean {
  // Prefer the server-computed effective set when present; it already accounts
  // for JAFAR overrides. Fall back to the hardcoded matrix for resilience
  // (first paint before /api/me/permissions resolves, or offline-ish states).
  if (effectivePermissions) return effectivePermissions.has(key);
  const allowed = MATRIX[key];
  if (!allowed) return false;
  const userRoles = extractRoleIds(user);
  if (userRoles.length === 0) return false;
  return userRoles.some((rid) => (allowed as readonly number[]).includes(rid));
}

/** Convenience: does the user hold ANY of the given role IDs? */
export function hasRole(user: UserLike | null | undefined, ...roleIds: RoleId[]): boolean {
  const userRoles = extractRoleIds(user);
  return userRoles.some((rid) => roleIds.includes(rid as RoleId));
}

/** Convenience: is the user an admin (role 1 or 6)? */
export function isAdmin(user: UserLike | null | undefined): boolean {
  return hasRole(user, ROLE.ADMIN, ROLE.SUPER_ADMIN);
}
