import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get all field types
    const fieldTypes = await prisma.fIELD_TYPE.findMany({
      orderBy: {
        SORT_ORDER: 'asc',
      },
    });
    
    console.log('FIELD_TYPE records:');
    console.log(JSON.stringify(fieldTypes, null, 2));
    
    // Get all fields
    const fields = await prisma.fIELDS.findMany({
      include: {
        FIELD_TYPE: true
      }
    });
    
    console.log('\nFIELDS records:');
    console.log(JSON.stringify(fields, null, 2));
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
