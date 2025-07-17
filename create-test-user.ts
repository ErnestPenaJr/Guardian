import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // First, let's check if there are any existing users
    const existingUsers = await prisma.uSERS.findMany();
    console.log('Existing users:', existingUsers.length);
    
    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      console.log('Found existing user:', {
        id: user.USER_ID,
        email: user.EMAIL,
        firstName: user.FIRST_NAME,
        lastName: user.LAST_NAME
      });
      
      // Check if user has a company_id
      if (!user.COMPANY_ID) {
        console.log('User needs a company_id, creating company...');
        const company = await prisma.cOMPANY.create({
          data: {
            NAME: 'Test Company',
            ADDRESS: '123 Test St',
            PHONE: '555-0123'
          }
        });
        
        // Update user with company_id
        await prisma.uSERS.update({
          where: { USER_ID: user.USER_ID },
          data: { COMPANY_ID: company.COMPANY_ID }
        });
        
        console.log('Updated user with company_id:', company.COMPANY_ID);
      }
      
      // Check if user has a password
      if (!user.PASSWORD_HASH) {
        console.log('User needs a password, setting password...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        await prisma.uSERS.update({
          where: { USER_ID: user.USER_ID },
          data: { PASSWORD_HASH: hashedPassword }
        });
        console.log('Password set for user');
      }
      
      return;
    }
    
    console.log('No existing users found, creating test user...');
    
    // Create a company first
    const company = await prisma.cOMPANY.create({
      data: {
        NAME: 'Test Company',
        ADDRESS: '123 Test St',
        PHONE: '555-0123'
      }
    });
    
    console.log('Created company:', company.COMPANY_ID);
    
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.uSERS.create({
      data: {
        FIRST_NAME: 'Test',
        LAST_NAME: 'Admin',
        EMAIL: 'admin@test.com',
        PASSWORD_HASH: hashedPassword,
        COMPANY_ID: company.COMPANY_ID,
        EMAIL_VALIDATED: true,
        STATUS: 'A'
      }
    });
    
    console.log('Created user:', user.USER_ID);
    
    // Check if we have roles
    const roles = await prisma.rOLES.findMany();
    console.log('Available roles:', roles.length);
    
    if (roles.length > 0) {
      // Assign user to first role
      await prisma.uSER_ROLES.create({
        data: {
          USER_ID: user.USER_ID,
          ROLE_ID: roles[0].ROLE_ID
        }
      });
      console.log('Assigned user to role:', roles[0].ROLE_ID);
    }
    
    console.log('Test user created successfully!');
    console.log('Email: admin@test.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();