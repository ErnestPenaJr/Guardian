import express from 'express';
import { PERMISSIONS } from '../models/permissions.js';
const router = express.Router();
// Get all permissions
router.get('/', async (req, res) => {
    try {
        res.json(PERMISSIONS);
    }
    catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Failed to fetch permissions' });
    }
});
// Get a specific permission by ID
router.get('/:id', async (req, res) => {
    try {
        const permissionId = parseInt(req.params.id);
        const permission = PERMISSIONS.find(p => p.id === permissionId);
        if (!permission) {
            return res.status(404).json({ message: 'Permission not found' });
        }
        res.json(permission);
    }
    catch (error) {
        console.error('Error fetching permission:', error);
        res.status(500).json({ message: 'Failed to fetch permission' });
    }
});
export default router;
