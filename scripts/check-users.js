import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking users in the database...');
    
    // First, get the basic user information
    const users = await prisma.uSERS.findMany({
      select: {
        USER_ID: true,
        EMAIL: true,
        FIRST_NAME: true,
        LAST_NAME: true,
        STATUS: true,
        EMAIL_VALIDATED: true,
        PASSWORD_HASH: true
      },
      take: 10 // Limit to first 10 users
    });

    console.log('Found users:', JSON.stringify(users, null, 2));
    
    // Check if test user exists
    const testUser = users.find(u => u.EMAIL === 'admin@example.com');
    
    if (testUser) {
      console.log('\nTest user found:');
      console.log(`Email: ${testUser.EMAIL}`);
      console.log(`Name: ${testUser.FIRST_NAME} ${testUser.LAST_NAME}`);
      console.log(`Status: ${testUser.STATUS}`);
      console.log(`Email Validated: ${testUser.EMAIL_VALIDATED}`);
      console.log(`Has Password: ${!!testUser.PASSWORD_HASH}`);
      
      // Now get the roles for this user
      const userRoles = await prisma.uSER_ROLES.findMany({
        where: { USER_ID: testUser.USER_ID },
        include: { ROLES: true }
      });
      
      console.log('User Roles:', userRoles.map(ur => ur.ROLES?.NAME || 'unknown').join(', '));
    } else {
      console.log('\nTest user (admin@example.com) not found in the database.');
    }
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
