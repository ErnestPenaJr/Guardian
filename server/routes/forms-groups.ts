import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// Define interfaces for type safety
interface FormGroup {
  GROUP_ID: number;
  GROUP_NAME: string;
  GROUP_DESCRIPTION?: string;
  IS_PUBLIC: number;
  SORT_ORDER: number;
  ORGANIZATION_ID?: number;
  COMPANY_NAME?: string;
  CREATE_USER_ID?: number;
  UPDATE_USER_ID?: number;
  CREATE_DATE?: Date;
  UPDATE_DATE?: Date;
}

interface GroupField {
  FIELD_ID: number;
  SORT_ORDER?: number;
  IS_REQUIRED?: boolean;
}

// Define interface for group fields with related field data
// Mirrors exactly what the /:id/fields query SELECTs:
//   gf."GROUP_ID", gf."FIELD_ID", gf."SORT_ORDER",
//   f."FIELD_NAME", f."IS_REQUIRED" as "FIELD_IS_REQUIRED", f."OPTIONS" as "FIELD_OPTIONS"
interface GroupFieldWithDetails {
  GROUP_ID: number;
  FIELD_ID: number;
  SORT_ORDER: number;
  FIELD_NAME: string;
  FIELD_IS_REQUIRED: boolean;
  FIELD_OPTIONS?: string | null;
}

// Get all groups
router.get('/', async (req, res) => {
  try {
    // Use raw SQL query instead of Prisma model
    const groups = await prisma.$queryRaw`
      SELECT g.*, o."COMPANY_NAME"
      FROM "GUARDIAN"."FORMS_GROUPS" g
      LEFT JOIN "GUARDIAN"."ORGANIZATIONS" o ON g."ORGANIZATION_ID" = o."ORGANIZATION_ID"
      ORDER BY g."GROUP_NAME" ASC
    `;

    res.json(groups as FormGroup[]);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get a specific group by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use raw SQL query instead of Prisma model
    const groups = await prisma.$queryRaw`
      SELECT g.*, o."COMPANY_NAME"
      FROM "GUARDIAN"."FORMS_GROUPS" g
      LEFT JOIN "GUARDIAN"."ORGANIZATIONS" o ON g."ORGANIZATION_ID" = o."ORGANIZATION_ID"
      WHERE g."GROUP_ID" = ${parseInt(id)}
    `;
    
    const typedGroups = groups as FormGroup[];
    if (!typedGroups || typedGroups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(typedGroups[0]);
  } catch (error) {
    console.error(`Error fetching group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Get fields for a specific group
router.get('/:id/fields', async (req, res) => {
  try {
    const { id } = req.params;
    const groupId = parseInt(id);
    
    // Check if group exists
    const groups = await prisma.$queryRaw`
      SELECT * FROM "GUARDIAN"."FORMS_GROUPS"
      WHERE "GROUP_ID" = ${groupId}
    `;

    const typedGroups = groups as FormGroup[];
    if (!typedGroups || typedGroups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get fields for the group
    const fields = await prisma.$queryRaw`
      SELECT gf."GROUP_ID", gf."FIELD_ID", gf."SORT_ORDER",
             f."FIELD_NAME", f."IS_REQUIRED" as "FIELD_IS_REQUIRED", f."OPTIONS" as "FIELD_OPTIONS"
      FROM "GUARDIAN"."FORMS_GROUPS_FIELDS" gf
      JOIN "GUARDIAN"."FIELDS" f ON gf."FIELD_ID" = f."FIELD_ID"
      WHERE gf."GROUP_ID" = ${groupId}
      ORDER BY gf."SORT_ORDER", f."FIELD_NAME"
    `;
    
    res.json(fields as GroupFieldWithDetails[]);
  } catch (error) {
    console.error(`Error fetching fields for group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch group fields' });
  }
});

// Create a new group (requires authentication)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      GROUP_NAME, 
      GROUP_DESCRIPTION, 
      IS_PUBLIC,
      SORT_ORDER,
      ORGANIZATION_ID
    } = req.body;
    
    // Get the authenticated user
    const userId = req.user?.id;
    
    // Create the group using raw SQL
    const currentDate = new Date().toISOString();
    const isPublicValue = IS_PUBLIC ? true : false;
    const sortOrderValue = SORT_ORDER || 0;

    const result = await prisma.$queryRaw`
      INSERT INTO "GUARDIAN"."FORMS_GROUPS" (
        "GROUP_NAME",
        "GROUP_DESCRIPTION",
        "IS_PUBLIC",
        "SORT_ORDER",
        "ORGANIZATION_ID",
        "CREATE_USER_ID",
        "UPDATE_USER_ID",
        "CREATE_DATE",
        "UPDATE_DATE"
      ) VALUES (
        ${GROUP_NAME},
        ${GROUP_DESCRIPTION},
        ${isPublicValue},
        ${sortOrderValue},
        ${ORGANIZATION_ID},
        ${userId},
        ${userId},
        ${currentDate},
        ${currentDate}
      ) RETURNING "GROUP_ID"
    `;

    // Get the newly created group
    const typedResult = result as { GROUP_ID: number }[];
    const newGroupId = typedResult[0].GROUP_ID;
    const groups = await prisma.$queryRaw`
      SELECT g.*, o."COMPANY_NAME"
      FROM "GUARDIAN"."FORMS_GROUPS" g
      LEFT JOIN "GUARDIAN"."ORGANIZATIONS" o ON g."ORGANIZATION_ID" = o."ORGANIZATION_ID"
      WHERE g."GROUP_ID" = ${newGroupId}
    `;
    
    const typedGroups = groups as FormGroup[];
    res.status(201).json(typedGroups[0]);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update a group (requires authentication)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const groupId = parseInt(id);
    const { 
      GROUP_NAME, 
      GROUP_DESCRIPTION, 
      IS_PUBLIC,
      SORT_ORDER,
      ORGANIZATION_ID
    } = req.body;
    
    // Get the authenticated user
    const userId = req.user?.id;
    const currentDate = new Date().toISOString();
    const isPublicValue = IS_PUBLIC ? true : false;
    
    // Update the group using raw SQL
    await prisma.$queryRaw`
      UPDATE "GUARDIAN"."FORMS_GROUPS"
      SET
        "GROUP_NAME" = ${GROUP_NAME},
        "GROUP_DESCRIPTION" = ${GROUP_DESCRIPTION},
        "IS_PUBLIC" = ${isPublicValue},
        "SORT_ORDER" = ${SORT_ORDER},
        "ORGANIZATION_ID" = ${ORGANIZATION_ID},
        "UPDATE_USER_ID" = ${userId},
        "UPDATE_DATE" = ${currentDate}
      WHERE "GROUP_ID" = ${groupId}
    `;

    // Get the updated group
    const groups = await prisma.$queryRaw`
      SELECT g.*, o."COMPANY_NAME"
      FROM "GUARDIAN"."FORMS_GROUPS" g
      LEFT JOIN "GUARDIAN"."ORGANIZATIONS" o ON g."ORGANIZATION_ID" = o."ORGANIZATION_ID"
      WHERE g."GROUP_ID" = ${groupId}
    `;
    
    const group = (groups as any[])[0];
    if (!group) {
      return res.status(404).json({ error: 'Group not found after update' });
    }
    
    res.json(group);
  } catch (error) {
    console.error(`Error updating group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Define group field type
interface GroupField {
  FIELD_ID: number;
  SORT_ORDER?: number;
  IS_REQUIRED?: boolean;
}

// Add fields to a group (requires authentication)
router.post('/:id/fields', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const groupId = parseInt(id);
    const { fields } = req.body as { fields: GroupField[] };
    
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }
    
    // Get the authenticated user
    const userId = req.user?.id;
    const currentDate = new Date().toISOString();
    
    // Delete existing group fields
    await prisma.$queryRaw`
      DELETE FROM "GUARDIAN"."FORMS_GROUPS_FIELDS"
      WHERE "GROUP_ID" = ${groupId}
    `;

    // Create new group fields
    const createdGroupFields: any[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const sortOrder = field.SORT_ORDER || i;
      const isRequired = field.IS_REQUIRED ? 1 : 0;

      // Insert the new group field
      await prisma.$queryRaw`
        INSERT INTO "GUARDIAN"."FORMS_GROUPS_FIELDS" (
          "GROUP_ID",
          "FIELD_ID",
          "SORT_ORDER",
          "CREATE_USER_ID",
          "UPDATE_USER_ID",
          "CREATE_DATE",
          "UPDATE_DATE"
        ) VALUES (
          ${groupId},
          ${field.FIELD_ID},
          ${sortOrder},
          ${userId},
          ${userId},
          ${currentDate},
          ${currentDate}
        )
      `;
      
      // Add to the result array
      createdGroupFields.push({
        GROUP_ID: groupId,
        FIELD_ID: field.FIELD_ID,
        SORT_ORDER: sortOrder,
        IS_REQUIRED: isRequired,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId,
        CREATE_DATE: currentDate,
        UPDATE_DATE: currentDate
      });
    }
    
    res.status(201).json(createdGroupFields);
  } catch (error) {
    console.error(`Error adding fields to group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to add fields to group' });
  }
});

// Delete a group (requires authentication)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const groupId = parseInt(id);
    
    console.log(`Attempting to delete group with ID: ${groupId}`);
    
    // Check if group exists
    const groups = await prisma.$queryRaw`
      SELECT * FROM "GUARDIAN"."FORMS_GROUPS"
      WHERE "GROUP_ID" = ${groupId}
    `;

    const group = (groups as any[])[0];
    if (!group) {
      console.log(`Group with ID ${groupId} not found`);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log(`Found group:`, group);

    // First delete any group fields associated with this group
    console.log(`Deleting group fields for group ID: ${groupId}`);
    try {
      await prisma.$queryRaw`
        DELETE FROM "GUARDIAN"."FORMS_GROUPS_FIELDS"
        WHERE "GROUP_ID" = ${groupId}
      `;
      console.log(`Deleted group fields for group ID: ${groupId}`);
    } catch (fieldError) {
      console.log(`No group fields to delete or error:`, fieldError);
      // Continue with group deletion even if field deletion fails
    }

    // Then delete the group
    await prisma.$queryRaw`
      DELETE FROM "GUARDIAN"."FORMS_GROUPS"
      WHERE "GROUP_ID" = ${groupId}
    `;
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error(`Error deleting group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
