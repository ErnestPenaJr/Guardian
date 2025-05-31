import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// Use type assertion to access the models
const groupsModel = (prisma as any).fORMS_GROUPS;
const groupFieldsModel = (prisma as any).fORMS_GROUPS_FIELDS;

// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await groupsModel.findMany({
      include: {
        ORGANIZATIONS: true
      },
      orderBy: {
        GROUP_NAME: 'asc'
      }
    });
    
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get a specific group by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await groupsModel.findUnique({
      where: {
        GROUP_ID: parseInt(id)
      },
      include: {
        ORGANIZATIONS: true
      }
    });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(group);
  } catch (error) {
    console.error(`Error fetching group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Get fields for a specific group
router.get('/:id/fields', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if group exists
    const group = await groupsModel.findUnique({
      where: {
        GROUP_ID: parseInt(id)
      }
    });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get fields for the group
    const groupFields = await groupFieldsModel.findMany({
      where: {
        GROUP_ID: parseInt(id)
      },
      include: {
        FIELDS: {
          include: {
            FIELD_TYPE: true,
            FIELD_LOOKUP_DISPLAY_TYPE: true
          }
        }
      },
      orderBy: {
        SORT_ORDER: 'asc'
      }
    });
    
    res.json(groupFields);
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
    
    // Create the group
    const group = await groupsModel.create({
      data: {
        GROUP_NAME,
        GROUP_DESCRIPTION,
        IS_PUBLIC: IS_PUBLIC || false,
        SORT_ORDER: SORT_ORDER || 0,
        ORGANIZATION_ID,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId
      }
    });
    
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update a group (requires authentication)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      GROUP_NAME, 
      GROUP_DESCRIPTION, 
      IS_PUBLIC,
      SORT_ORDER,
      ORGANIZATION_ID
    } = req.body;
    
    // Get the authenticated user
    const userId = req.user?.id;
    
    // Update the group
    const group = await groupsModel.update({
      where: {
        GROUP_ID: parseInt(id)
      },
      data: {
        GROUP_NAME,
        GROUP_DESCRIPTION,
        IS_PUBLIC,
        SORT_ORDER,
        ORGANIZATION_ID,
        UPDATE_USER_ID: userId,
        UPDATE_DATE: new Date()
      }
    });
    
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
    const { fields } = req.body as { fields: GroupField[] };
    
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }
    
    // Get the authenticated user
    const userId = req.user?.id;
    
    // Delete existing group fields
    await groupFieldsModel.deleteMany({
      where: {
        GROUP_ID: parseInt(id)
      }
    });
    
    // Create new group fields
    const createdGroupFields: any[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const createdGroupField = await groupFieldsModel.create({
        data: {
          GROUP_ID: parseInt(id),
          FIELD_ID: field.FIELD_ID,
          SORT_ORDER: field.SORT_ORDER || i,
          IS_REQUIRED: field.IS_REQUIRED || false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        }
      });
      createdGroupFields.push(createdGroupField);
    }
    
    res.json(createdGroupFields);
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
    const group = await groupsModel.findUnique({
      where: {
        GROUP_ID: groupId
      }
    });
    
    if (!group) {
      console.log(`Group with ID ${groupId} not found`);
      return res.status(404).json({ error: 'Group not found' });
    }
    
    console.log(`Found group:`, group);

    // First delete any group fields associated with this group if the model exists
    console.log(`Checking if group fields model exists`);
    if (groupFieldsModel) {
      console.log(`Deleting group fields for group ID: ${groupId}`);
      try {
        const deletedFields = await groupFieldsModel.deleteMany({
          where: {
            GROUP_ID: groupId
          }
        });
        console.log(`Deleted group fields:`, deletedFields);
      } catch (fieldError) {
        console.log(`No group fields to delete or error:`, fieldError);
        // Continue with group deletion even if field deletion fails
      }
    } else {
      console.log(`Group fields model not found, skipping field deletion`);
    }
    
    // Then delete the group
    console.log(`Deleting group with ID: ${groupId}`);
    const deletedGroup = await groupsModel.delete({
      where: {
        GROUP_ID: groupId
      }
    });
    console.log(`Deleted group:`, deletedGroup);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error(`Error deleting group ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
