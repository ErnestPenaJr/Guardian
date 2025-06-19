import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { isAdmin } from '../models/permissions.js';
const prisma = new PrismaClient();
const router = express.Router();
// Get all fields (requires authentication)
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get user from request object (added by requireAuth middleware)
        const user = req.user; // Cast to any to access properties
        // Get user roles - handle both arrays and string format for compatibility
        const roles = user?.roles || [];
        const role = user?.role || '';
        // Convert string role to number array if needed
        const normalizedRoles = roles.length > 0 ? roles : (role ? [parseInt(role)] : []);
        // Use utility function to check admin role
        const userIsAdmin = isAdmin(normalizedRoles);
        // Check for JAFAR role (ID: 6)
        const userIsJafar = normalizedRoles.includes(6);
        let fieldsQuery = {};
        // Apply role-based filtering at the database query level
        if (userIsJafar) {
            // JAFAR users can see all fields (no filtering needed)
            // fieldsQuery remains an empty object to return all fields
            console.log('User has JAFAR role - showing all fields');
        }
        else if (userIsAdmin) {
            // For ADMIN users, show fields where isPublic is true or company ID matches the user's company ID
            fieldsQuery = {
                OR: [
                    { IS_PUBLIC: true },
                    {
                        ORGANIZATION_ID: user?.COMPANY_ID, // Use COMPANY_ID instead of company.id
                        NOT: { ORGANIZATION_ID: null }
                    }
                ]
            };
            console.log('User has ADMIN role - applying organization filtering');
        }
        else {
            // For other users, show public fields AND fields matching their company ID
            fieldsQuery = {
                OR: [
                    { IS_PUBLIC: true },
                    {
                        ORGANIZATION_ID: user?.COMPANY_ID,
                        NOT: { ORGANIZATION_ID: null }
                    }
                ]
            };
            console.log('User has standard role - showing public fields and company fields');
        }
        const fields = await prisma.fIELDS.findMany({
            where: fieldsQuery,
            include: {
                FIELD_TYPE: true,
                FIELD_LOOKUP_DISPLAY_TYPE: true
            },
            orderBy: {
                FIELD_NAME: 'asc'
            }
        });
        console.log(`Returning ${fields.length} fields for user with roles: ${JSON.stringify(user?.roles?.map((r) => r.id))}`);
        res.json(fields);
    }
    catch (error) {
        console.error('Error fetching fields:', error);
        res.status(500).json({ error: 'Failed to fetch fields' });
    }
});
// Get a specific field by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const field = await prisma.fIELDS.findUnique({
            where: {
                FIELD_ID: parseInt(id)
            },
            include: {
                FIELD_TYPE: true,
                FIELD_LOOKUP_DISPLAY_TYPE: true
            }
        });
        if (!field) {
            return res.status(404).json({ error: 'Field not found' });
        }
        res.json(field);
    }
    catch (error) {
        console.error(`Error fetching field ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch field' });
    }
});
// Get lookups for a specific field
router.get('/:id/lookups', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if field exists
        const field = await prisma.fIELDS.findUnique({
            where: {
                FIELD_ID: parseInt(id)
            }
        });
        if (!field) {
            return res.status(404).json({ error: 'Field not found' });
        }
        // Check if field has lookups
        if (!field.HAS_LOOKUP) {
            return res.json([]);
        }
        // Get lookups for the field
        const lookups = await prisma.fIELDS_LOOKUP.findMany({
            where: {
                FIELD_ID: parseInt(id)
            },
            orderBy: {
                SORT_ORDER: 'asc'
            }
        });
        res.json(lookups);
    }
    catch (error) {
        console.error(`Error fetching lookups for field ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch field lookups' });
    }
});
// Create a new field (requires authentication)
router.post('/', requireAuth, async (req, res) => {
    try {
        const { FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP, IS_PUBLIC, IS_REQUIRED, IS_SENSITIVE, FIELD_LOOKUP_DISPLAY_TYPE_ID, ORGANIZATION_ID } = req.body;
        // Get the authenticated user
        const userId = req.user?.id;
        // Create the field
        const field = await prisma.fIELDS.create({
            data: {
                FIELD_NAME,
                FIELD_TYPE_ID,
                DISPLAY_FORMAT,
                HAS_LOOKUP: HAS_LOOKUP || false,
                IS_PUBLIC: IS_PUBLIC || false,
                IS_ACTIVE: true,
                IS_DELETED: false,
                IS_REQUIRED: IS_REQUIRED || false,
                IS_SENSITIVE: IS_SENSITIVE || false,
                CAN_SELECT_MULIPLE: false,
                FIELD_LOOKUP_DISPLAY_TYPE_ID,
                ORGANIZATION_ID,
                CREATE_USER_ID: userId,
                UPDATE_USER_ID: userId
            }
        });
        res.status(201).json(field);
    }
    catch (error) {
        console.error('Error creating field:', error);
        res.status(500).json({ error: 'Failed to create field' });
    }
});
// Update a field (requires authentication)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP, IS_PUBLIC, IS_REQUIRED, IS_SENSITIVE, FIELD_LOOKUP_DISPLAY_TYPE_ID, ORGANIZATION_ID } = req.body;
        // Get the authenticated user
        const userId = req.user?.id;
        // Update the field
        const field = await prisma.fIELDS.update({
            where: {
                FIELD_ID: parseInt(id)
            },
            data: {
                FIELD_NAME,
                FIELD_TYPE_ID,
                DISPLAY_FORMAT,
                HAS_LOOKUP,
                IS_PUBLIC,
                IS_REQUIRED,
                IS_SENSITIVE,
                FIELD_LOOKUP_DISPLAY_TYPE_ID,
                ORGANIZATION_ID,
                UPDATE_USER_ID: userId,
                UPDATE_DATE: new Date()
            }
        });
        res.json(field);
    }
    catch (error) {
        console.error(`Error updating field ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to update field' });
    }
});
// Add lookups to a field (requires authentication)
router.post('/:id/lookups', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { lookups } = req.body;
        if (!Array.isArray(lookups)) {
            return res.status(400).json({ error: 'Lookups must be an array' });
        }
        // Get the authenticated user
        const userId = req.user?.id;
        // Update the field to have lookups
        await prisma.fIELDS.update({
            where: {
                FIELD_ID: parseInt(id)
            },
            data: {
                HAS_LOOKUP: true,
                UPDATE_USER_ID: userId,
                UPDATE_DATE: new Date()
            }
        });
        // Delete existing lookups
        await prisma.fIELDS_LOOKUP.deleteMany({
            where: {
                FIELD_ID: parseInt(id)
            }
        });
        // Create new lookups
        const createdLookups = [];
        for (let i = 0; i < lookups.length; i++) {
            const lookup = lookups[i];
            const createdLookup = await prisma.fIELDS_LOOKUP.create({
                data: {
                    FIELD_ID: parseInt(id),
                    LOOKUP_CODE: lookup.LOOKUP_CODE || `${i + 1}`,
                    LOOKUP_DESCRIPTION: lookup.LOOKUP_DESCRIPTION,
                    SORT_ORDER: lookup.SORT_ORDER || i,
                    CREATE_USER_ID: userId,
                    UPDATE_USER_ID: userId
                }
            });
            createdLookups.push(createdLookup);
        }
        res.json(createdLookups);
    }
    catch (error) {
        console.error(`Error adding lookups to field ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to add lookups to field' });
    }
});
// Delete a field (requires authentication)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const fieldId = parseInt(id);
        // Check if field exists
        const field = await prisma.fIELDS.findUnique({
            where: {
                FIELD_ID: fieldId
            }
        });
        if (!field) {
            return res.status(404).json({ error: 'Field not found' });
        }
        // First delete any lookup values associated with this field
        if (field.HAS_LOOKUP) {
            await prisma.fIELDS_LOOKUP.deleteMany({
                where: {
                    FIELD_ID: fieldId
                }
            });
        }
        // Then delete the field
        await prisma.fIELDS.delete({
            where: {
                FIELD_ID: fieldId
            }
        });
        res.json({ message: 'Field deleted successfully' });
    }
    catch (error) {
        console.error(`Error deleting field ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to delete field' });
    }
});
export default router;
