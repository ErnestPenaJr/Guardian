import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function listForms() {
  try {
    const forms = await prisma.fORMS.findMany({ take: 10 });
    console.log('Forms:', forms);
    
    // Check for specific form ID
    const specificForm = await prisma.fORMS.findUnique({
      where: {
        FORM_ID: 1005
      }
    });
    console.log('Form with ID 1005:', specificForm);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listForms();
