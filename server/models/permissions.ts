import { z } from 'zod';

// Define permission types
export enum PermissionType {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  APPROVE = 'approve',
  ASSIGN = 'assign',
  MANAGE = 'manage',
  CONFIGURE = 'configure',
}

// Define resource types
export enum ResourceType {
  USER = 'user',
  REQUEST = 'request',
  NOTICE = 'notice',
  TASK = 'task',
  FORM = 'form',
  FIELD = 'field',
  REPORT = 'report',
  ORGANIZATION = 'organization',
  COMPANY = 'company',
  ROLE = 'role',
  SYSTEM_SETTINGS = 'system_settings',
}

// Define permission schema
export const PermissionSchema = z.object({
  id: z.number(),
  type: z.nativeEnum(PermissionType),
  resource: z.nativeEnum(ResourceType),
  description: z.string(),
});

export type Permission = z.infer<typeof PermissionSchema>;

// Define role schema with permissions
export const RoleSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  permissions: z.array(z.number()), // Array of permission IDs
});

export type Role = z.infer<typeof RoleSchema>;

// Define all permissions
export const PERMISSIONS: Permission[] = [
  // User permissions
  { id: 1, type: PermissionType.VIEW, resource: ResourceType.USER, description: 'View users' },
  { id: 2, type: PermissionType.CREATE, resource: ResourceType.USER, description: 'Create users' },
  { id: 3, type: PermissionType.EDIT, resource: ResourceType.USER, description: 'Edit users' },
  { id: 4, type: PermissionType.DELETE, resource: ResourceType.USER, description: 'Delete users' },
  
  // Request permissions
  { id: 5, type: PermissionType.VIEW, resource: ResourceType.REQUEST, description: 'View all requests' },
  { id: 6, type: PermissionType.CREATE, resource: ResourceType.REQUEST, description: 'Create requests' },
  { id: 7, type: PermissionType.EDIT, resource: ResourceType.REQUEST, description: 'Edit requests' },
  { id: 8, type: PermissionType.DELETE, resource: ResourceType.REQUEST, description: 'Delete requests' },
  { id: 9, type: PermissionType.APPROVE, resource: ResourceType.REQUEST, description: 'Approve requests' },
  { id: 10, type: PermissionType.ASSIGN, resource: ResourceType.REQUEST, description: 'Assign requests' },
  
  // Notice permissions
  { id: 11, type: PermissionType.VIEW, resource: ResourceType.NOTICE, description: 'View all notices' },
  { id: 12, type: PermissionType.CREATE, resource: ResourceType.NOTICE, description: 'Create notices' },
  { id: 13, type: PermissionType.EDIT, resource: ResourceType.NOTICE, description: 'Edit notices' },
  { id: 14, type: PermissionType.DELETE, resource: ResourceType.NOTICE, description: 'Delete notices' },
  
  // Task permissions
  { id: 15, type: PermissionType.VIEW, resource: ResourceType.TASK, description: 'View all tasks' },
  { id: 16, type: PermissionType.CREATE, resource: ResourceType.TASK, description: 'Create tasks' },
  { id: 17, type: PermissionType.EDIT, resource: ResourceType.TASK, description: 'Edit tasks' },
  { id: 18, type: PermissionType.DELETE, resource: ResourceType.TASK, description: 'Delete tasks' },
  { id: 19, type: PermissionType.ASSIGN, resource: ResourceType.TASK, description: 'Assign tasks' },
  
  // Form permissions
  { id: 20, type: PermissionType.VIEW, resource: ResourceType.FORM, description: 'View forms' },
  { id: 21, type: PermissionType.CREATE, resource: ResourceType.FORM, description: 'Create forms' },
  { id: 22, type: PermissionType.EDIT, resource: ResourceType.FORM, description: 'Edit forms' },
  { id: 23, type: PermissionType.DELETE, resource: ResourceType.FORM, description: 'Delete forms' },
  
  // Field permissions
  { id: 24, type: PermissionType.VIEW, resource: ResourceType.FIELD, description: 'View fields' },
  { id: 25, type: PermissionType.CREATE, resource: ResourceType.FIELD, description: 'Create fields' },
  { id: 26, type: PermissionType.EDIT, resource: ResourceType.FIELD, description: 'Edit fields' },
  { id: 27, type: PermissionType.DELETE, resource: ResourceType.FIELD, description: 'Delete fields' },
  
  // Report permissions
  { id: 28, type: PermissionType.VIEW, resource: ResourceType.REPORT, description: 'View reports' },
  { id: 29, type: PermissionType.CREATE, resource: ResourceType.REPORT, description: 'Create reports' },
  { id: 30, type: PermissionType.EDIT, resource: ResourceType.REPORT, description: 'Edit reports' },
  { id: 31, type: PermissionType.DELETE, resource: ResourceType.REPORT, description: 'Delete reports' },
  
  // Organization permissions
  { id: 32, type: PermissionType.VIEW, resource: ResourceType.ORGANIZATION, description: 'View organizations' },
  { id: 33, type: PermissionType.CREATE, resource: ResourceType.ORGANIZATION, description: 'Create organizations' },
  { id: 34, type: PermissionType.EDIT, resource: ResourceType.ORGANIZATION, description: 'Edit organizations' },
  { id: 35, type: PermissionType.DELETE, resource: ResourceType.ORGANIZATION, description: 'Delete organizations' },
  
  // Company permissions
  { id: 36, type: PermissionType.VIEW, resource: ResourceType.COMPANY, description: 'View companies' },
  { id: 37, type: PermissionType.CREATE, resource: ResourceType.COMPANY, description: 'Create companies' },
  { id: 38, type: PermissionType.EDIT, resource: ResourceType.COMPANY, description: 'Edit companies' },
  { id: 39, type: PermissionType.DELETE, resource: ResourceType.COMPANY, description: 'Delete companies' },
  
  // Role permissions
  { id: 40, type: PermissionType.VIEW, resource: ResourceType.ROLE, description: 'View roles' },
  { id: 41, type: PermissionType.CREATE, resource: ResourceType.ROLE, description: 'Create roles' },
  { id: 42, type: PermissionType.EDIT, resource: ResourceType.ROLE, description: 'Edit roles' },
  { id: 43, type: PermissionType.DELETE, resource: ResourceType.ROLE, description: 'Delete roles' },
  
  // System settings permissions
  { id: 44, type: PermissionType.VIEW, resource: ResourceType.SYSTEM_SETTINGS, description: 'View system settings' },
  { id: 45, type: PermissionType.CONFIGURE, resource: ResourceType.SYSTEM_SETTINGS, description: 'Configure system settings' },
  
  // Management permissions
  { id: 46, type: PermissionType.MANAGE, resource: ResourceType.USER, description: 'Manage all users' },
  { id: 47, type: PermissionType.MANAGE, resource: ResourceType.REQUEST, description: 'Manage all requests' },
  { id: 48, type: PermissionType.MANAGE, resource: ResourceType.NOTICE, description: 'Manage all notices' },
  { id: 49, type: PermissionType.MANAGE, resource: ResourceType.ORGANIZATION, description: 'Manage all organizations' },
];

// Define predefined roles with their permissions
export const PREDEFINED_ROLES: Role[] = [
  {
    id: 1,
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: PERMISSIONS.map(p => p.id), // Admin has all permissions
  },
  {
    id: 2,
    name: 'user',
    displayName: 'Regular User',
    description: 'Basic user with limited permissions',
    permissions: [
      1, 5, 6, 7, 11, 15, 16, 17, 20, 28 // Basic view and create permissions
    ],
  },
  {
    id: 3,
    name: 'manager',
    displayName: 'Manager',
    description: 'Manager with team oversight permissions',
    permissions: [
      1, 3, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 28, 32, 36
    ],
  },
];

// Helper function to check if a user has a specific permission
export function hasPermission(
  userPermissions: number[],
  permissionType: PermissionType,
  resourceType: ResourceType
): boolean {
  const permission = PERMISSIONS.find(
    p => p.type === permissionType && p.resource === resourceType
  );
  
  if (!permission) {
    return false;
  }
  
  return userPermissions.includes(permission.id);
}

// Helper function to get all permissions for a role
export function getRolePermissions(roleId: number): Permission[] {
  const role = PREDEFINED_ROLES.find(r => r.id === roleId);
  if (!role) {
    return [];
  }
  
  return PERMISSIONS.filter(p => role.permissions.includes(p.id));
}

// Helper function to check if a user has admin role
export function isAdmin(roles: number[]): boolean {
  return roles.includes(1); // Admin role ID is 1
}
