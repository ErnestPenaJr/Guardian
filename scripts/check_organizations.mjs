// Script to check organizations in the database
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkOrganizations() {
  try {
    console.log('Checking organizations in the database...');
    
    // Get all organizations
    const organizations = await prisma.ORGANIZATIONS.findMany();
    
    console.log('Organizations found:', organizations.length);
    console.log('Organizations:', JSON.stringify(organizations, null, 2));
    
    // Get all field types
    const fieldTypes = await prisma.FIELD_TYPE.findMany();
    
    console.log('Field types found:', fieldTypes.length);
    console.log('Field types:', JSON.stringify(fieldTypes, null, 2));
    
  } catch (error) {
    console.error('Error checking organizations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
checkOrganizations()
  .then(() => console.log('Script completed'))
  .catch(e => console.error('Script failed:', e));
