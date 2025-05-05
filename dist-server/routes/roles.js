import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { isAdmin } from '../middleware/isAdmin';
import { PREDEFINED_ROLES } from '../models/permissions';
const router = express.Router();
const prisma = new PrismaClient();
// Validation schema for role creation/update
const roleInputSchema = z.object({
    name: z.string().min(1, 'Role name is required'),
    displayName: z.string().min(1, 'Display name is required'),
    description: z.string().optional(),
    permissions: z.array(z.number()).default([]),
});
// Get all roles
router.get('/', async (req, res) => {
    try {
        // First check if roles exist in the database
        const dbRoles = await prisma.rOLES.findMany({
            orderBy: { ROLE_ID: 'asc' }
        });
        // If no roles exist, return predefined roles
        if (dbRoles.length === 0) {
            return res.json(PREDEFINED_ROLES);
        }
        // Map database roles to our role schema format
        const roles = await Promise.all(dbRoles.map(async (role) => {
            // Get role permissions from the database
            const rolePermissions = await prisma.$queryRaw `
        SELECT PERMISSION_ID FROM ROLE_PERMISSIONS 
        WHERE ROLE_ID = ${role.ROLE_ID} AND STATUS = 'A'
      `;
            return {
                id: role.ROLE_ID,
                name: role.NAME,
                displayName: role.DISPLAY_NAME,
                description: role.DESCRIPTION,
                // Using type assertion since rolePermissions is of type unknown
                permissions: rolePermissions.map((p) => p.PERMISSION_ID),
            };
        }));
        res.json(roles);
    }
    catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Failed to fetch roles' });
    }
});
// Get a specific role by ID
router.get('/:id', async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        // Check if this is a predefined role
        const predefinedRole = PREDEFINED_ROLES.find(r => r.id === roleId);
        if (predefinedRole) {
            return res.json(predefinedRole);
        }
        // Otherwise, get from database
        const role = await prisma.rOLES.findUnique({
            where: { ROLE_ID: roleId }
        });
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        // Get role permissions
        const rolePermissions = await prisma.$queryRaw `
      SELECT PERMISSION_ID FROM ROLE_PERMISSIONS 
      WHERE ROLE_ID = ${roleId} AND STATUS = 'A'
    `;
        res.json({
            id: role.ROLE_ID,
            name: role.NAME,
            displayName: role.DISPLAY_NAME,
            description: role.DESCRIPTION,
            // Using type assertion since rolePermissions is of type unknown
            permissions: rolePermissions.map((p) => p.PERMISSION_ID),
        });
    }
    catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ message: 'Failed to fetch role' });
    }
});
// Create a new role (admin only)
router.post('/', isAdmin, async (req, res) => {
    try {
        // Validate input
        const validationResult = roleInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: 'Invalid role data',
                errors: validationResult.error.errors
            });
        }
        const roleData = validationResult.data;
        // Create role in database
        const role = await prisma.rOLES.create({
            data: {
                NAME: roleData.name,
                DISPLAY_NAME: roleData.displayName,
                DESCRIPTION: roleData.description || '',
                STATUS: 'A',
                CREATE_USER_ID: req.user?.id || null,
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date(),
            }
        });
        // Add role permissions
        if (roleData.permissions.length > 0) {
            const permissionInserts = roleData.permissions.map(permissionId => ({
                ROLE_ID: role.ROLE_ID,
                PERMISSION_ID: permissionId,
                STATUS: 'A',
                CREATE_USER_ID: req.user?.id || null,
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date(),
            }));
            await prisma.$transaction(permissionInserts.map(data => prisma.$executeRaw `
            INSERT INTO ROLE_PERMISSIONS (ROLE_ID, PERMISSION_ID, STATUS, CREATE_USER_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${data.ROLE_ID}, ${data.PERMISSION_ID}, ${data.STATUS}, ${data.CREATE_USER_ID}, ${data.CREATE_DATE}, ${data.UPDATE_DATE})
          `));
        }
        res.status(201).json({
            id: role.ROLE_ID,
            name: role.NAME,
            displayName: role.DISPLAY_NAME,
            description: role.DESCRIPTION,
            permissions: roleData.permissions,
        });
    }
    catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ message: 'Failed to create role' });
    }
});
// Update a role (admin only)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        // Validate input
        const validationResult = roleInputSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: 'Invalid role data',
                errors: validationResult.error.errors
            });
        }
        const roleData = validationResult.data;
        // Check if role exists
        const existingRole = await prisma.rOLES.findUnique({
            where: { ROLE_ID: roleId }
        });
        if (!existingRole) {
            return res.status(404).json({ message: 'Role not found' });
        }
        // Update role
        const updatedRole = await prisma.rOLES.update({
            where: { ROLE_ID: roleId },
            data: {
                NAME: roleData.name,
                DISPLAY_NAME: roleData.displayName,
                DESCRIPTION: roleData.description || '',
                UPDATE_USER_ID: req.user?.id || null,
                UPDATE_DATE: new Date(),
            }
        });
        // Update role permissions - first delete existing ones
        await prisma.$executeRaw `
      UPDATE ROLE_PERMISSIONS
      SET STATUS = 'D', UPDATE_USER_ID = ${req.user?.id || null}, UPDATE_DATE = ${new Date()}
      WHERE ROLE_ID = ${roleId}
    `;
        // Then add new permissions
        if (roleData.permissions.length > 0) {
            const permissionInserts = roleData.permissions.map(permissionId => ({
                ROLE_ID: roleId,
                PERMISSION_ID: permissionId,
                STATUS: 'A',
                CREATE_USER_ID: req.user?.id || null,
                CREATE_DATE: new Date(),
                UPDATE_DATE: new Date(),
            }));
            await prisma.$transaction(permissionInserts.map(data => prisma.$executeRaw `
            INSERT INTO ROLE_PERMISSIONS (ROLE_ID, PERMISSION_ID, STATUS, CREATE_USER_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${data.ROLE_ID}, ${data.PERMISSION_ID}, ${data.STATUS}, ${data.CREATE_USER_ID}, ${data.CREATE_DATE}, ${data.UPDATE_DATE})
          `));
        }
        res.json({
            id: updatedRole.ROLE_ID,
            name: updatedRole.NAME,
            displayName: updatedRole.DISPLAY_NAME,
            description: updatedRole.DESCRIPTION,
            permissions: roleData.permissions,
        });
    }
    catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ message: 'Failed to update role' });
    }
});
// Delete a role (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        // Don't allow deletion of predefined roles
        if (roleId <= 3) {
            return res.status(403).json({
                message: 'Cannot delete predefined roles'
            });
        }
        // Check if role exists
        const existingRole = await prisma.rOLES.findUnique({
            where: { ROLE_ID: roleId }
        });
        if (!existingRole) {
            return res.status(404).json({ message: 'Role not found' });
        }
        // Soft delete role
        await prisma.rOLES.update({
            where: { ROLE_ID: roleId },
            data: {
                STATUS: 'D',
                UPDATE_USER_ID: req.user?.id || null,
                UPDATE_DATE: new Date(),
            }
        });
        // Soft delete role permissions
        await prisma.$executeRaw `
      UPDATE ROLE_PERMISSIONS
      SET STATUS = 'D', UPDATE_USER_ID = ${req.user?.id || null}, UPDATE_DATE = ${new Date()}
      WHERE ROLE_ID = ${roleId}
    `;
        res.json({ message: 'Role deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ message: 'Failed to delete role' });
    }
});
export default router;
