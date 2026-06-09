import express from 'express';
import { requireAuth } from '../auth.js';

import prisma from "../prisma-client.js";
const router = express.Router();

// Get all field types
router.get('/', async (req, res) => {
  try {
    const fieldTypes = await prisma.fIELD_TYPE.findMany({
      orderBy: {
        SORT_ORDER: 'asc'
      }
    });
    
    res.json(fieldTypes);
  } catch (error) {
    console.error('Error fetching field types:', error);
    res.status(500).json({ error: 'Failed to fetch field types' });
  }
});

// Get a specific field type by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const fieldType = await prisma.fIELD_TYPE.findUnique({
      where: {
        FIELD_TYPE_ID: parseInt(id)
      }
    });
    
    if (!fieldType) {
      return res.status(404).json({ error: 'Field type not found' });
    }
    
    res.json(fieldType);
  } catch (error) {
    console.error(`Error fetching field type ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch field type' });
  }
});

// Create a new field type (requires authentication)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      FIELD_TYPE_NAME, 
      FIELD_TYPE_DESC,
      SORT_ORDER
    } = req.body;
    
    // Validate required fields
    if (!FIELD_TYPE_NAME) {
      return res.status(400).json({ error: 'Field type name is required' });
    }
    
    // Create the field type
    const fieldType = await prisma.fIELD_TYPE.create({
      data: {
        FIELD_TYPE_DESC: FIELD_TYPE_NAME, // Using the name as the description since schema only has FIELD_TYPE_DESC
        SORT_ORDER: SORT_ORDER || 0
      }
    });
    
    res.status(201).json(fieldType);
  } catch (error) {
    console.error('Error creating field type:', error);
    res.status(500).json({ error: 'Failed to create field type' });
  }
});

// Update a field type (requires authentication)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      FIELD_TYPE_NAME, 
      FIELD_TYPE_DESC,
      SORT_ORDER,
      IS_ACTIVE
    } = req.body;
    
    // Validate required fields
    if (!FIELD_TYPE_NAME) {
      return res.status(400).json({ error: 'Field type name is required' });
    }
    
    // Update the field type
    const fieldType = await prisma.fIELD_TYPE.update({
      where: {
        FIELD_TYPE_ID: parseInt(id)
      },
      data: {
        FIELD_TYPE_DESC: FIELD_TYPE_NAME,
        SORT_ORDER: SORT_ORDER || undefined
      }
    });
    
    res.json(fieldType);
  } catch (error) {
    console.error(`Error updating field type ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update field type' });
  }
});

// Delete a field type (soft delete, requires authentication)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete the field type
    await prisma.fIELD_TYPE.delete({
      where: {
        FIELD_TYPE_ID: parseInt(id)
      }
    });
    
    res.json({ success: true, message: 'Field type deleted successfully' });
  } catch (error) {
    console.error(`Error deleting field type ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete field type' });
  }
});

export default router;
