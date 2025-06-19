import express from 'express';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';

// Define user profile type for TypeScript
interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  companyName?: string | null;
  company?: {
    id: number | null;
  };
}

const router = express.Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user profile from database with only the fields that exist in the schema
    const user = await prisma.uSERS.findUnique({
      where: { USER_ID: userId },
      select: {
        USER_ID: true,
        FIRST_NAME: true,
        LAST_NAME: true,
        EMAIL: true,
        COMPANY_ID: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get company information if available
    let companyName = '';
    let companyId: number | null = null;
    
    if (user.COMPANY_ID) {
      try {
        const company = await prisma.cOMPANY.findUnique({
          where: { COMPANY_ID: user.COMPANY_ID },
          select: { NAME: true, COMPANY_ID: true }
        });
        
        if (company) {
          companyName = company.NAME;
          // Explicitly type as number | null to fix TypeScript error
          companyId = company.COMPANY_ID || null;
        }
      } catch (err) {
        console.error('Error fetching company:', err);
        // Continue without company info if there's an error
      }
    }
    
    // Format response with the fields we have
    const profile: UserProfile = {
      id: user.USER_ID,
      email: user.EMAIL,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      phone: '', // Will be handled by frontend
      jobTitle: '', // Will be handled by frontend
      department: '', // Will be handled by frontend
      companyName: companyName,
      company: {
        id: companyId
      }
    };
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { firstName, lastName } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    
    // Update user profile with only the fields that exist in the schema
    const updatedUser = await prisma.uSERS.update({
      where: { USER_ID: userId },
      data: {
        FIRST_NAME: firstName,
        LAST_NAME: lastName
        // We'll handle additional fields in a future schema update
      },
      select: {
        USER_ID: true,
        EMAIL: true,
        FIRST_NAME: true,
        LAST_NAME: true,
        COMPANY_ID: true
      }
    });
    
    // Get company information if available
    let companyName = '';
    let companyId: number | null = null;
    
    if (updatedUser.COMPANY_ID) {
      try {
        const company = await prisma.cOMPANY.findUnique({
          where: { COMPANY_ID: updatedUser.COMPANY_ID },
          select: { NAME: true, COMPANY_ID: true }
        });
        
        if (company) {
          companyName = company.NAME;
          // Explicitly type as number | null to fix TypeScript error
          companyId = company.COMPANY_ID || null;
        }
      } catch (err) {
        console.error('Error fetching company:', err);
        // Continue without company info if there's an error
      }
    }
    
    // Format response
    const profile: UserProfile = {
      id: updatedUser.USER_ID,
      email: updatedUser.EMAIL,
      firstName: updatedUser.FIRST_NAME,
      lastName: updatedUser.LAST_NAME,
      phone: '', // Will be handled by frontend or future schema update
      jobTitle: '', // Will be handled by frontend or future schema update
      department: '', // Will be handled by frontend or future schema update
      companyName: companyName,
      company: {
        id: companyId
      }
    };
    
    // Log the updated profile
    console.log('Updated user profile:', profile);
    
    res.json(profile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
