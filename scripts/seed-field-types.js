// Import PrismaClient using ES module syntax
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFieldTypes() {
  try {
    console.log('Checking for existing field types...');
    
    // Check if field types already exist
    const existingFieldTypes = await prisma.fIELD_TYPE.findMany();
    
    if (existingFieldTypes.length === 0) {
      console.log('No field types found. Seeding field types...');
      
      // Create default field types with the correct field names according to the schema
      await prisma.fIELD_TYPE.createMany({
        data: [
          { 
            FIELD_TYPE_DESC: 'Text', 
            SORT_ORDER: 1
          },
          { 
            FIELD_TYPE_DESC: 'TextArea', 
            SORT_ORDER: 2
          },
          { 
            FIELD_TYPE_DESC: 'Number', 
            SORT_ORDER: 3
          },
          { 
            FIELD_TYPE_DESC: 'Select', 
            SORT_ORDER: 4
          },
          { 
            FIELD_TYPE_DESC: 'Radio', 
            SORT_ORDER: 5
          },
          { 
            FIELD_TYPE_DESC: 'Checkbox', 
            SORT_ORDER: 6
          },
          { 
            FIELD_TYPE_DESC: 'Date', 
            SORT_ORDER: 7
          }
        ]
      });
      
      console.log('Field types seeded successfully!');
    } else {
      console.log(`Found ${existingFieldTypes.length} existing field types. No seeding needed.`);
    }
  } catch (error) {
    console.error('Error seeding field types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedFieldTypes();
