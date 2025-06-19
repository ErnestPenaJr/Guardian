/**
 * Utility functions for checking user roles
 */

// Role ID constants
export enum RoleId {
  ADMIN = 1,
  GEN = 2,
  PROCESSOR = 3,
  MANAGER = 4,
  EXTERNAL = 5,
  JAFAR = 6
}

// Role name constants
export enum RoleName {
  ADMIN = 'ADMIN',
  GEN = 'GEN',
  PROCESSOR = 'PROCESSOR',
  MANAGER = 'MANAGER',
  EXTERNAL = 'EXTERNAL',
  JAFAR = 'JAFAR'
}

// Role mapping for display and reference
export const ROLE_MAP = {
  [RoleId.ADMIN]: RoleName.ADMIN,
  [RoleId.GEN]: RoleName.GEN,
  [RoleId.PROCESSOR]: RoleName.PROCESSOR,
  [RoleId.MANAGER]: RoleName.MANAGER,
  [RoleId.EXTERNAL]: RoleName.EXTERNAL,
  [RoleId.JAFAR]: RoleName.JAFAR
};

// Type for a user's role information
export interface UserRole {
  id: number;
  name?: string;
  displayName?: string;
}

/**
 * Check if the user has a specific role by ID
 * @param userRoles Array of user roles
 * @param roleId Role ID to check
 * @returns boolean indicating if the user has the role
 */
export const hasRole = (userRoles: UserRole[], roleId: RoleId): boolean => {
  return userRoles.some(role => role.id === roleId);
};

/**
 * Check if the user has any of the specified roles
 * @param userRoles Array of user roles
 * @param roleIds Array of role IDs to check
 * @returns boolean indicating if the user has any of the roles
 */
export const hasAnyRole = (userRoles: UserRole[], roleIds: RoleId[]): boolean => {
  return userRoles.some(role => roleIds.includes(role.id as RoleId));
};

/**
 * Check if the user has all of the specified roles
 * @param userRoles Array of user roles
 * @param roleIds Array of role IDs to check
 * @returns boolean indicating if the user has all of the roles
 */
export const hasAllRoles = (userRoles: UserRole[], roleIds: RoleId[]): boolean => {
  return roleIds.every(roleId => userRoles.some(role => role.id === roleId));
};

/**
 * Check if the user is an admin
 * @param userRoles Array of user roles
 * @returns boolean indicating if the user is an admin
 */
export const isAdmin = (userRoles: UserRole[]): boolean => {
  return hasRole(userRoles, RoleId.ADMIN);
};

/**
 * Check if the user is a processor
 * @param userRoles Array of user roles
 * @returns boolean indicating if the user is a processor
 */
export const isProcessor = (userRoles: UserRole[]): boolean => {
  return hasRole(userRoles, RoleId.PROCESSOR);
};

/**
 * Check if the user is a manager
 * @param userRoles Array of user roles
 * @returns boolean indicating if the user is a manager
 */
export const isManager = (userRoles: UserRole[]): boolean => {
  return hasRole(userRoles, RoleId.MANAGER);
};

/**
 * Check if the user is external
 * @param userRoles Array of user roles
 * @returns boolean indicating if the user is external
 */
export const isExternal = (userRoles: UserRole[]): boolean => {
  return hasRole(userRoles, RoleId.EXTERNAL);
};

/**
 * Get the highest priority role for a user
 * Priority order: ADMIN > MANAGER > PROCESSOR > GEN > EXTERNAL > JAFAR
 * @param userRoles Array of user roles
 * @returns The highest priority role or undefined if no roles
 */
export const getHighestRole = (userRoles: UserRole[]): UserRole | undefined => {
  if (hasRole(userRoles, RoleId.ADMIN)) {
    return userRoles.find(role => role.id === RoleId.ADMIN);
  }
  if (hasRole(userRoles, RoleId.MANAGER)) {
    return userRoles.find(role => role.id === RoleId.MANAGER);
  }
  if (hasRole(userRoles, RoleId.PROCESSOR)) {
    return userRoles.find(role => role.id === RoleId.PROCESSOR);
  }
  if (hasRole(userRoles, RoleId.GEN)) {
    return userRoles.find(role => role.id === RoleId.GEN);
  }
  if (hasRole(userRoles, RoleId.EXTERNAL)) {
    return userRoles.find(role => role.id === RoleId.EXTERNAL);
  }
  if (hasRole(userRoles, RoleId.JAFAR)) {
    return userRoles.find(role => role.id === RoleId.JAFAR);
  }
  return undefined;
};

/**
 * Get a list of role names for a user
 * @param userRoles Array of user roles
 * @returns Array of role names
 */
export const getRoleNames = (userRoles: UserRole[]): string[] => {
  return userRoles.map(role => ROLE_MAP[role.id as RoleId] || '');
};
