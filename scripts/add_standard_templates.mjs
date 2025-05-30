// Script to add standard form templates using Prisma client
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addStandardTemplates() {
  try {
    console.log('Starting to add standard form templates...');
    
    // Get current user ID for audit fields
    const adminUser = await prisma.USERS.findFirst({
      where: { 
        EMAIL: { contains: 'admin' }
      }
    });
    
    const userId = adminUser?.USER_ID || 1; // Default to 1 if no admin found
    const currentDate = new Date();
    
    // 1. First, ensure we have the necessary field types
    const fieldTypes = [
      { 
        FIELD_TYPE_ID: 1, 
        FIELD_TYPE_DESC: 'Text', 
        SORT_ORDER: 1
      },
      { 
        FIELD_TYPE_ID: 2, 
        FIELD_TYPE_DESC: 'Number', 
        SORT_ORDER: 2
      },
      { 
        FIELD_TYPE_ID: 3, 
        FIELD_TYPE_DESC: 'Date', 
        SORT_ORDER: 3
      },
      { 
        FIELD_TYPE_ID: 4, 
        FIELD_TYPE_DESC: 'SSN', 
        SORT_ORDER: 4
      }
    ];
    
    // Create field types if they don't exist
    for (const fieldType of fieldTypes) {
      try {
        await prisma.FIELD_TYPE.upsert({
          where: { FIELD_TYPE_ID: fieldType.FIELD_TYPE_ID },
          update: fieldType,
          create: fieldType
        });
        console.log(`Field type created/updated: ${fieldType.FIELD_TYPE_DESC}`);
      } catch (error) {
        console.error(`Error creating field type ${fieldType.FIELD_TYPE_DESC}:`, error);
      }
    }
    
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
      
      try {
        // Check if form exists
        const existingForm = await prisma.FORMS.findFirst({
          where: { FORM_NAME: template.form.FORM_NAME }
        });
        
        let form;
        if (existingForm) {
          // Update existing form
          form = await prisma.FORMS.update({
            where: { FORM_ID: existingForm.FORM_ID },
            data: template.form
          });
          console.log(`Updated existing form with ID: ${form.FORM_ID}`);
        } else {
          // Create new form
          form = await prisma.FORMS.create({
            data: template.form
          });
          console.log(`Created new form with ID: ${form.FORM_ID}`);
        }
        
        // Create the fields for this form
        for (const field of template.fields) {
          try {
            // Check if field exists
            const existingField = await prisma.FIELDS.findFirst({
              where: { 
                FIELD_NAME: field.FIELD_NAME,
                FORM_ID: form.FORM_ID
              }
            });
            
            let createdField;
            if (existingField) {
              // Update existing field
              createdField = await prisma.FIELDS.update({
                where: { FIELD_ID: existingField.FIELD_ID },
                data: {
                  ...field,
                  FORM_ID: form.FORM_ID
                }
              });
              console.log(`Updated existing field: ${createdField.FIELD_NAME}`);
            } else {
              // Create new field
              createdField = await prisma.FIELDS.create({
                data: {
                  ...field,
                  FORM_ID: form.FORM_ID
                }
              });
              console.log(`Created new field: ${createdField.FIELD_NAME}`);
            }
          } catch (error) {
            console.error(`Error creating/updating field ${field.FIELD_NAME}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error creating/updating form ${template.form.FORM_NAME}:`, error);
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
