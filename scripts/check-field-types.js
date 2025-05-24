import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const fieldTypes = await prisma.fIELD_TYPE.findMany({
      orderBy: {
        SORT_ORDER: 'asc',
      },
    });
    
    console.log('Field types in the database:');
    console.log(JSON.stringify(fieldTypes, null, 2));
  } catch (error) {
    console.error('Error fetching field types:', error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
