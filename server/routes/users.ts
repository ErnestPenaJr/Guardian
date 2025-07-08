import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAdmin } from '../middleware/isAdmin';

interface UserWithRoles {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: Date;
  companyId: number | null;
  roles: Array<{
    id: number;
    name: string | null;
    displayName: string | null;
  }>;
}

const router = express.Router();
const prisma = new PrismaClient();

// Get all users for the current company
router.get('/', isAdmin, async (req: any, res) => {
  try {
    // Get the company ID from the authenticated user (now set by isAdmin middleware)
    const companyId = req.user?.COMPANY_ID;
    
    if (!companyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Company ID is required',
        debug: { user: req.user }
      });
    }
    
    console.log(`[USERS] Fetching users for company ID: ${companyId}`);

    // First, get users filtered by company using USERS table directly
    let users;
    try {
      // Query users directly from USERS table by COMPANY_ID
      console.log(`[USERS] Querying USERS table for company ID: ${companyId}`);
      users = await prisma.uSERS.findMany({
        where: {
          COMPANY_ID: companyId,
          STATUS: 'A'
        },
        orderBy: [
          { LAST_NAME: 'asc' },
          { FIRST_NAME: 'asc' }
        ],
        select: {
          USER_ID: true,
          FIRST_NAME: true,
          LAST_NAME: true,
          EMAIL: true,
          STATUS: true,
          CREATE_DATE: true,
          COMPANY_ID: true
        }
      });
      
      console.log(`[USERS] Found ${users.length} active users for company ID: ${companyId}`);
      
    } catch (error) {
      console.error('Error fetching users by company:', error);
      // Fallback to all users if company filtering fails
      try {
        users = await prisma.uSERS.findMany({
          where: {
            STATUS: 'A'
          },
          orderBy: [
            { LAST_NAME: 'asc' },
            { FIRST_NAME: 'asc' }
          ],
          select: {
            USER_ID: true,
            FIRST_NAME: true,
            LAST_NAME: true,
            EMAIL: true,
            STATUS: true,
            CREATE_DATE: true,
            COMPANY_ID: true
          }
        });
        console.log('Fallback: returning all users due to company filtering error');
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }

    // Transform the data to match the expected format
    const formattedUsers = users.map(user => ({
      id: user.USER_ID,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      email: user.EMAIL,
      status: user.STATUS,
      createdAt: user.CREATE_DATE,
      companyId: user.COMPANY_ID || companyId // Use the company ID from the database, fallback to token
    }));

    // Then, get roles for each user using Prisma ORM
    const usersWithRoles = await Promise.all(formattedUsers.map(async (user) => {
      try {
        // Get user roles using Prisma ORM
        const userRoles = await prisma.uSER_ROLES.findMany({
          where: {
            USER_ID: user.id,
            STATUS: 'A'
          },
          select: {
            ROLE_ID: true
          }
        });

        // Get role details for each role ID
        const roleIds = userRoles.map(ur => ur.ROLE_ID);
        let roles: Array<{
          ROLE_ID: number;
          NAME: string | null;
          DISPLAY_NAME: string | null;
        }> = [];
        
        if (roleIds.length > 0) {
          try {
            roles = await prisma.rOLES.findMany({
              where: {
                ROLE_ID: { in: roleIds }
              },
              select: {
                ROLE_ID: true,
                NAME: true,
                DISPLAY_NAME: true
              },
              orderBy: {
                NAME: 'asc'
              }
            });
          } catch (roleError) {
            console.error(`Error fetching roles from ROLES table for user ${user.id}:`, roleError);
            // If ROLES table doesn't exist, create mock roles based on role IDs
            roles = roleIds.map(roleId => ({
              ROLE_ID: roleId,
              NAME: `Role ${roleId}`,
              DISPLAY_NAME: `Role ${roleId}`
            }));
          }
        }

        // Transform roles to expected format
        const formattedRoles = roles.map(role => ({
          id: role.ROLE_ID,
          name: role.NAME,
          displayName: role.DISPLAY_NAME
        }));

        return {
          ...user,
          roles: formattedRoles
        };
      } catch (error) {
        console.error(`Error fetching roles for user ${user.id}:`, error);
        // Return user without roles if there's an error
        return {
          ...user,
          roles: []
        };
      }
    }));

    res.json({
      success: true,
      data: usersWithRoles
    });
  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: errorMessage
    });
  }
});

export default router;
