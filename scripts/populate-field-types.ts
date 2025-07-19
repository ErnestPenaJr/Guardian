import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateFieldTypes() {
  console.log('🚀 Starting to populate field types...');

  try {
    // Check if FIELD_TYPE table is empty
    const existingFieldTypes = await prisma.fIELD_TYPE.count();
    console.log(`Found ${existingFieldTypes} existing field types`);

    if (existingFieldTypes === 0) {
      console.log('📝 Populating FIELD_TYPE table...');
      
      const fieldTypes = [
        { FIELD_TYPE_DESC: 'Text Input', SORT_ORDER: 1 },
        { FIELD_TYPE_DESC: 'Textarea', SORT_ORDER: 2 },
        { FIELD_TYPE_DESC: 'Number', SORT_ORDER: 3 },
        { FIELD_TYPE_DESC: 'Email', SORT_ORDER: 4 },
        { FIELD_TYPE_DESC: 'Phone', SORT_ORDER: 5 },
        { FIELD_TYPE_DESC: 'Date', SORT_ORDER: 6 },
        { FIELD_TYPE_DESC: 'Time', SORT_ORDER: 7 },
        { FIELD_TYPE_DESC: 'DateTime', SORT_ORDER: 8 },
        { FIELD_TYPE_DESC: 'Dropdown', SORT_ORDER: 9 },
        { FIELD_TYPE_DESC: 'Radio Button', SORT_ORDER: 10 },
        { FIELD_TYPE_DESC: 'Checkbox', SORT_ORDER: 11 },
        { FIELD_TYPE_DESC: 'File Upload', SORT_ORDER: 12 },
        { FIELD_TYPE_DESC: 'URL', SORT_ORDER: 13 },
        { FIELD_TYPE_DESC: 'Password', SORT_ORDER: 14 },
        { FIELD_TYPE_DESC: 'Hidden', SORT_ORDER: 15 }
      ];

      for (const fieldType of fieldTypes) {
        await prisma.fIELD_TYPE.create({
          data: fieldType
        });
      }
      
      console.log(`✅ Created ${fieldTypes.length} field types`);
    } else {
      console.log('ℹ️  FIELD_TYPE table already has data, skipping...');
    }

    // Check if FIELD_LOOKUP_DISPLAY_TYPE table is empty
    const existingDisplayTypes = await prisma.fIELD_LOOKUP_DISPLAY_TYPE.count();
    console.log(`Found ${existingDisplayTypes} existing display types`);

    if (existingDisplayTypes === 0) {
      console.log('📝 Populating FIELD_LOOKUP_DISPLAY_TYPE table...');
      
      const displayTypes = [
        { FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION: 'Dropdown List', SORT_ORDER: 1 },
        { FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION: 'Radio Buttons', SORT_ORDER: 2 },
        { FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION: 'Checkboxes', SORT_ORDER: 3 },
        { FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION: 'Multi-select List', SORT_ORDER: 4 },
        { FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION: 'Button Group', SORT_ORDER: 5 }
      ];

      for (const displayType of displayTypes) {
        await prisma.fIELD_LOOKUP_DISPLAY_TYPE.create({
          data: displayType
        });
      }
      
      console.log(`✅ Created ${displayTypes.length} display types`);
    } else {
      console.log('ℹ️  FIELD_LOOKUP_DISPLAY_TYPE table already has data, skipping...');
    }

    // Check if we have any forms
    const existingForms = await prisma.fORMS.count({
      where: { IS_DELETED: false }
    });
    console.log(`Found ${existingForms} existing forms`);

    if (existingForms === 0) {
      console.log('📝 Creating default form template...');
      
      const defaultForm = await prisma.fORMS.create({
        data: {
          FORM_NAME: 'Default Request Form',
          FORM_DESCRIPTION: 'Default form template for requests',
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: 1,
          UPDATE_USER_ID: 1
        }
      });
      
      console.log(`✅ Created default form with ID: ${defaultForm.FORM_ID}`);
    } else {
      console.log('ℹ️  Forms already exist, skipping default form creation...');
    }

    // Display current data
    console.log('\n📊 Current Field Types:');
    const fieldTypes = await prisma.fIELD_TYPE.findMany({
      orderBy: { SORT_ORDER: 'asc' }
    });
    fieldTypes.forEach((ft, index) => {
      console.log(`  ${index + 1}. ${ft.FIELD_TYPE_DESC} (ID: ${ft.FIELD_TYPE_ID})`);
    });

    console.log('\n📊 Current Display Types:');
    const displayTypes = await prisma.fIELD_LOOKUP_DISPLAY_TYPE.findMany({
      orderBy: { SORT_ORDER: 'asc' }
    });
    displayTypes.forEach((dt, index) => {
      console.log(`  ${index + 1}. ${dt.FIELD_LOOKUP_DISPLAY_TYPE_DESCRIPTION} (ID: ${dt.FIELD_LOOKUP_DISPLAY_TYPE_ID})`);
    });

    console.log('\n📊 Current Forms:');
    const forms = await prisma.fORMS.findMany({
      where: { IS_DELETED: false },
      orderBy: { FORM_NAME: 'asc' }
    });
    forms.forEach((form, index) => {
      console.log(`  ${index + 1}. ${form.FORM_NAME} (ID: ${form.FORM_ID})`);
    });

    console.log('\n🎉 Field types population completed successfully!');

  } catch (error) {
    console.error('❌ Error populating field types:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

populateFieldTypes();