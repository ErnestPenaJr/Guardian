import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFieldTypes() {
  try {
    console.log('Checking for existing field types...');
    
    // Check if field types already exist
    const existingFieldTypes = await prisma.fIELD_TYPE.findMany();
    
    if (existingFieldTypes.length === 0) {
      console.log('No field types found. Seeding field types...');
      
      // Create default field types
      await prisma.fIELD_TYPE.createMany({
        data: [
          { 
            FIELD_TYPE_ID: 1, 
            FIELD_TYPE_NAME: 'Text', 
            FIELD_TYPE_DESCRIPTION: 'Single line text input', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 1,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 2, 
            FIELD_TYPE_NAME: 'TextArea', 
            FIELD_TYPE_DESCRIPTION: 'Multi-line text input', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 2,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 3, 
            FIELD_TYPE_NAME: 'Number', 
            FIELD_TYPE_DESCRIPTION: 'Numeric input', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 3,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 4, 
            FIELD_TYPE_NAME: 'Select', 
            FIELD_TYPE_DESCRIPTION: 'Dropdown selection', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 4,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 5, 
            FIELD_TYPE_NAME: 'Radio', 
            FIELD_TYPE_DESCRIPTION: 'Radio button selection', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 5,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 6, 
            FIELD_TYPE_NAME: 'Checkbox', 
            FIELD_TYPE_DESCRIPTION: 'Checkbox selection', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 6,
            CREATE_DATE: new Date()
          },
          { 
            FIELD_TYPE_ID: 7, 
            FIELD_TYPE_NAME: 'Date', 
            FIELD_TYPE_DESCRIPTION: 'Date selection', 
            IS_ACTIVE: true,
            IS_DELETED: false,
            SORT_ORDER: 7,
            CREATE_DATE: new Date()
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
