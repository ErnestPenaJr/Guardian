import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating test admin user...');
    
    // Check if user already exists
    const existingUser = await prisma.uSERS.findFirst({
      where: { EMAIL: 'admin@example.com' }
    });

    if (existingUser) {
      console.log('Test user already exists. Updating password...');
      
      // Update existing user
      const passwordHash = await bcrypt.hash('password123', 10);
      
      await prisma.uSERS.update({
        where: { USER_ID: existingUser.USER_ID },
        data: {
          PASSWORD_HASH: passwordHash,
          STATUS: 'A', // Active
          EMAIL_VALIDATED: true
        }
      });
      
      console.log('Test user password updated successfully');
    } else {
      // Create new test user
      const passwordHash = await bcrypt.hash('password123', 10);
      
      const newUser = await prisma.uSERS.create({
        data: {
          EMAIL: 'admin@example.com',
          FIRST_NAME: 'Admin',
          LAST_NAME: 'User',
          STATUS: 'A', // Active
          EMAIL_VALIDATED: true,
          PASSWORD_HASH: passwordHash,
          CREATE_DATE: new Date(),
          UPDATE_DATE: new Date()
        }
      });
      
      console.log('Test user created successfully');
      
      // Assign admin role (assuming role_id 1 is admin)
      await prisma.uSER_ROLES.create({
        data: {
          USER_ID: newUser.USER_ID,
          ROLE_ID: 1, // Assuming 1 is the admin role
          CREATE_DATE: new Date(),
          UPDATE_DATE: new Date()
        }
      });
      
      console.log('Admin role assigned to test user');
    }
    
    console.log('Test user setup complete');
    console.log('Email: admin@example.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
