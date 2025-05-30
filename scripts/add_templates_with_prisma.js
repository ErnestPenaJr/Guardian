// Script to add standard form templates using Prisma client
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addStandardTemplates() {
  try {
    console.log('Starting to add standard form templates...');
    
    // Get current user ID for audit fields
    const adminUser = await prisma.uSERS.findFirst({
      where: { ROLE_ID: 1 }
    });
    
    const userId = adminUser?.USER_ID || 1; // Default to 1 if no admin found
    const currentDate = new Date();
    
    // 1. First, ensure we have the necessary field types
    const fieldTypes = [
      { 
        FIELD_TYPE_ID: 1, 
        FIELD_TYPE_DESC: 'Text', 
        FIELD_TYPE_DESCRIPTION: 'Single line text input',
        SORT_ORDER: 1,
        IS_ACTIVE: true,
        IS_DELETED: false,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId,
        CREATE_DATE: currentDate,
        UPDATE_DATE: currentDate
      },
      { 
        FIELD_TYPE_ID: 2, 
        FIELD_TYPE_DESC: 'Number', 
        FIELD_TYPE_DESCRIPTION: 'Numeric input field',
        SORT_ORDER: 2,
        IS_ACTIVE: true,
        IS_DELETED: false,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId,
        CREATE_DATE: currentDate,
        UPDATE_DATE: currentDate
      },
      { 
        FIELD_TYPE_ID: 3, 
        FIELD_TYPE_DESC: 'Date', 
        FIELD_TYPE_DESCRIPTION: 'Date picker field',
        SORT_ORDER: 3,
        IS_ACTIVE: true,
        IS_DELETED: false,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId,
        CREATE_DATE: currentDate,
        UPDATE_DATE: currentDate
      },
      { 
        FIELD_TYPE_ID: 4, 
        FIELD_TYPE_DESC: 'SSN', 
        FIELD_TYPE_DESCRIPTION: 'Social Security Number field',
        SORT_ORDER: 4,
        IS_ACTIVE: true,
        IS_DELETED: false,
        CREATE_USER_ID: userId,
        UPDATE_USER_ID: userId,
        CREATE_DATE: currentDate,
        UPDATE_DATE: currentDate
      }
    ];
    
    // Create field types if they don't exist
    for (const fieldType of fieldTypes) {
      await prisma.fIELD_TYPE.upsert({
        where: { FIELD_TYPE_ID: fieldType.FIELD_TYPE_ID },
        update: fieldType,
        create: fieldType
      });
    }
    
    console.log('Field types created or updated');
    
    // 2. Create the standard templates
    const templates = [
      {
        // SUBJECT Template
        form: {
          FORM_NAME: 'SUBJECT',
          FORM_DESCRIPTION: 'Personal information template',
          ORGANIZATION_ID: 1,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId,
          CREATE_DATE: currentDate,
          UPDATE_DATE: currentDate
        },
        fields: [
          {
            FIELD_NAME: 'First Name',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 1,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Middle Name',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 2,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Last Name',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 3,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Date of Birth',
            FIELD_TYPE_ID: 3, // Date
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'MM/DD/YYYY',
            SORT_ORDER: 4,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'SSN',
            FIELD_TYPE_ID: 4, // SSN
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'XXX-XX-XXXX',
            SORT_ORDER: 5,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          }
        ]
      },
      {
        // FINANCIAL Template
        form: {
          FORM_NAME: 'FINANCIAL',
          FORM_DESCRIPTION: 'Banking information template',
          ORGANIZATION_ID: 1,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId,
          CREATE_DATE: currentDate,
          UPDATE_DATE: currentDate
        },
        fields: [
          {
            FIELD_NAME: 'Bank Name',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 1,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Account Number',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 2,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Routing Number',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 3,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          }
        ]
      },
      {
        // ADDRESS Template
        form: {
          FORM_NAME: 'ADDRESS',
          FORM_DESCRIPTION: 'Address information template',
          ORGANIZATION_ID: 1,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId,
          CREATE_DATE: currentDate,
          UPDATE_DATE: currentDate
        },
        fields: [
          {
            FIELD_NAME: 'Address Line 1',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 1,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'Address Line 2',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 2,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'City',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 3,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'State',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: true,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 4,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          },
          {
            FIELD_NAME: 'ZIP Code',
            FIELD_TYPE_ID: 1, // Text
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            SORT_ORDER: 5,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            CREATE_DATE: currentDate,
            UPDATE_DATE: currentDate
          }
        ]
      }
    ];
    
    // Create each template and its fields
    for (const template of templates) {
      console.log(`Creating template: ${template.form.FORM_NAME}`);
      
      // Check if form exists
      const existingForm = await prisma.fORMS.findFirst({
        where: { FORM_NAME: template.form.FORM_NAME }
      });
      
      let form;
      if (existingForm) {
        // Update existing form
        form = await prisma.fORMS.update({
          where: { FORM_ID: existingForm.FORM_ID },
          data: template.form
        });
        console.log(`Updated existing form with ID: ${form.FORM_ID}`);
      } else {
        // Create new form
        form = await prisma.fORMS.create({
          data: template.form
        });
        console.log(`Created new form with ID: ${form.FORM_ID}`);
      }
      
      // Create the fields for this form
      for (const field of template.fields) {
        // Check if field exists
        const existingField = await prisma.fIELDS.findFirst({
          where: { 
            FORM_ID: form.FORM_ID,
            FIELD_NAME: field.FIELD_NAME
          }
        });
        
        let createdField;
        if (existingField) {
          // Update existing field
          createdField = await prisma.fIELDS.update({
            where: { FIELD_ID: existingField.FIELD_ID },
            data: {
              ...field,
              FORM_ID: form.FORM_ID
            }
          });
          console.log(`Updated existing field: ${createdField.FIELD_NAME}`);
        } else {
          // Create new field
          createdField = await prisma.fIELDS.create({
            data: {
              ...field,
              FORM_ID: form.FORM_ID
            }
          });
          console.log(`Created new field: ${createdField.FIELD_NAME}`);
        }
        
        // Check if form_fields junction record exists
        const existingFormField = await prisma.fORMS_FIELDS.findFirst({
          where: {
            FORM_ID: form.FORM_ID,
            FIELD_ID: createdField.FIELD_ID
          }
        });
        
        if (!existingFormField) {
          // Create form_fields junction record
          await prisma.fORMS_FIELDS.create({
            data: {
              FORM_ID: form.FORM_ID,
              FIELD_ID: createdField.FIELD_ID,
              IS_REQUIRED: field.IS_REQUIRED,
              SORT_ORDER: field.SORT_ORDER,
              CREATE_USER_ID: userId,
              UPDATE_USER_ID: userId,
              CREATE_DATE: currentDate,
              UPDATE_DATE: currentDate
            }
          });
        }
      }
    }
    
    console.log('Standard templates added successfully');
  } catch (error) {
    console.error('Error adding standard templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
addStandardTemplates()
  .then(() => console.log('Script completed'))
  .catch(e => console.error('Script failed:', e));
