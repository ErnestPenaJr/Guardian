import express from 'express';
import { requireAuth } from '../auth.js';

import prisma from "../prisma-client.js";
const router = express.Router();

// Create a single lookup value for a field
router.post('/', requireAuth, async (req, res) => {
  try {
    const { FIELD_ID, LOOKUP_CODE, LOOKUP_DESCRIPTION, SORT_ORDER, IS_ACTIVE } = req.body;
    
    // Validate required fields
    if (!FIELD_ID) {
      return res.status(400).json({ error: 'Field ID is required' });
    }
    
    if (!LOOKUP_DESCRIPTION) {
      return res.status(400).json({ error: 'Lookup description is required' });
    }
    
    // Get the authenticated user
    const userId = req.user?.id;
    
    console.log('Creating lookup with data:', { FIELD_ID, LOOKUP_CODE, LOOKUP_DESCRIPTION, SORT_ORDER });
    
    // Create the lookup
    const lookup = await prisma.fIELDS_LOOKUP.create({
      data: {
        FIELD_ID: Number(FIELD_ID),
        LOOKUP_CODE: LOOKUP_CODE || `${Date.now()}`,
        LOOKUP_DESCRIPTION,
        SORT_ORDER: SORT_ORDER || 0,
        // IS_ACTIVE is not in the schema, so we'll omit it
        CREATE_USER_ID: userId || 1, // Default to 1 if no user ID
        UPDATE_USER_ID: userId || 1  // Default to 1 if no user ID
      }
    });
    
    console.log('Created lookup:', lookup);
    res.status(201).json(lookup);
  } catch (error) {
    console.error('Error creating lookup:', error);
    res.status(500).json({ error: 'Failed to create lookup' });
  }
});

// Update a lookup value
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { LOOKUP_CODE, LOOKUP_DESCRIPTION, SORT_ORDER, IS_ACTIVE } = req.body;
    
    // Validate required fields
    if (!LOOKUP_DESCRIPTION) {
      return res.status(400).json({ error: 'Lookup description is required' });
    }
    
    // Get the authenticated user
    const userId = req.user?.id;
    
    console.log('Updating lookup with ID:', id, 'Data:', { LOOKUP_CODE, LOOKUP_DESCRIPTION, SORT_ORDER });
    
    // Update the lookup
    const lookup = await prisma.fIELDS_LOOKUP.update({
      where: {
        FIELD_LOOKUP_ID: parseInt(id)
      },
      data: {
        LOOKUP_CODE,
        LOOKUP_DESCRIPTION,
        SORT_ORDER: SORT_ORDER || 0,
        // IS_ACTIVE is not in the schema, so we'll omit it
        UPDATE_USER_ID: userId || 1, // Default to 1 if no user ID
        UPDATE_DATE: new Date()
      }
    });
    
    console.log('Updated lookup:', lookup);
    res.json(lookup);
  } catch (error) {
    console.error(`Error updating lookup ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update lookup' });
  }
});

// Delete a lookup value
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Deleting lookup with ID:', id);
    
    // Delete the lookup
    await prisma.fIELDS_LOOKUP.delete({
      where: {
        FIELD_LOOKUP_ID: parseInt(id)
      }
    });
    
    console.log('Lookup deleted successfully');
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting lookup ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete lookup' });
  }
});

export default router;
