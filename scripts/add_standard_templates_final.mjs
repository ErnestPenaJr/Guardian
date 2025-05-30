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
    
    const userId = adminUser?.USER_ID || 1000; // Default to 1000 if no admin found
    const currentDate = new Date();
    
    // Get the organization ID
    const organization = await prisma.ORGANIZATIONS.findFirst();
    if (!organization) {
      throw new Error('No organization found in the database');
    }
    
    const organizationId = organization.ORGANIZATION_ID;
    console.log(`Using organization ID: ${organizationId}`);
    
    // Get existing field types
    const fieldTypes = await prisma.FIELD_TYPE.findMany();
    console.log('Found field types:', fieldTypes.map(ft => `${ft.FIELD_TYPE_ID}: ${ft.FIELD_TYPE_DESC}`).join(', '));
    
    // Map field types to their IDs
    const textFieldTypeId = fieldTypes.find(ft => ft.FIELD_TYPE_DESC === 'Text')?.FIELD_TYPE_ID;
    const numberFieldTypeId = fieldTypes.find(ft => ft.FIELD_TYPE_DESC === 'Number')?.FIELD_TYPE_ID;
    const dateFieldTypeId = fieldTypes.find(ft => ft.FIELD_TYPE_DESC === 'Date')?.FIELD_TYPE_ID;
    
    if (!textFieldTypeId || !dateFieldTypeId) {
      throw new Error('Required field types not found in the database');
    }
    
    // 2. Create the standard templates
    const templates = [
      {
        // SUBJECT Template
        form: {
          FORM_NAME: 'SUBJECT',
          FORM_DESCRIPTION: 'Personal information template',
          ORGANIZATION_ID: organizationId,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'First Name',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 1
          },
          {
            FIELD_NAME: 'Middle Name',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: false,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 2
          },
          {
            FIELD_NAME: 'Last Name',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 3
          },
          {
            FIELD_NAME: 'Date of Birth',
            FIELD_TYPE_ID: dateFieldTypeId,
            DISPLAY_FORMAT: 'MM/DD/YYYY',
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: true,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 4
          },
          {
            FIELD_NAME: 'SSN',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: 'XXX-XX-XXXX',
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: true,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 5
          }
        ]
      },
      {
        // FINANCIAL Template
        form: {
          FORM_NAME: 'FINANCIAL',
          FORM_DESCRIPTION: 'Banking information template',
          ORGANIZATION_ID: organizationId,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'Bank Name',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 1
          },
          {
            FIELD_NAME: 'Account Number',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: true,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 2
          },
          {
            FIELD_NAME: 'Routing Number',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: true,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 3
          }
        ]
      },
      {
        // ADDRESS Template
        form: {
          FORM_NAME: 'ADDRESS',
          FORM_DESCRIPTION: 'Address information template',
          ORGANIZATION_ID: organizationId,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'Address Line 1',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 1
          },
          {
            FIELD_NAME: 'Address Line 2',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: false,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 2
          },
          {
            FIELD_NAME: 'City',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 3
          },
          {
            FIELD_NAME: 'State',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 4
          },
          {
            FIELD_NAME: 'ZIP Code',
            FIELD_TYPE_ID: textFieldTypeId,
            DISPLAY_FORMAT: null,
            HAS_LOOKUP: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_REQUIRED: true,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            ORGANIZATION_ID: organizationId,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            sortOrder: 5
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
            // Create field
            const createdField = await prisma.FIELDS.create({
              data: field
            });
            
            console.log(`Created field: ${createdField.FIELD_NAME} with ID: ${createdField.FIELD_ID}`);
            
            // Create form-field relationship
            await prisma.$executeRaw`
              INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
              VALUES (${form.FORM_ID}, ${createdField.FIELD_ID}, ${field.IS_REQUIRED}, ${field.sortOrder}, ${userId}, ${userId}, GETDATE(), GETDATE())
            `;
            
            console.log(`Created form-field relationship for ${createdField.FIELD_NAME}`);
          } catch (error) {
            console.error(`Error creating field ${field.FIELD_NAME}:`, error);
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
