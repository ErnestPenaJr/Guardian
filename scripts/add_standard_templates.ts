import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addStandardTemplates() {
  try {
    console.log('Starting to add standard form templates...');
    
    // Get existing field types to use proper IDs
    const fieldTypes = await prisma.$queryRaw`
      SELECT FIELD_TYPE_ID, FIELD_TYPE_DESC
      FROM GUARDIAN.FIELD_TYPE
      ORDER BY SORT_ORDER
    `;
    
    console.log('Found field types:', fieldTypes);
    
    // Find the Text Input field type (should be ID 1)
    const textFieldType = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Text Input');
    const dateFieldType = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Date');
    const numberFieldType = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Number');
    
    if (!textFieldType || !dateFieldType || !numberFieldType) {
      throw new Error('Required field types not found in database');
    }
    
    const userId = 1000; // Use a system user ID
    
    // 2. Create the standard templates as GLOBAL templates (no COMPANY_ID or ORGANIZATION_ID)
    const templates = [
      {
        // SUBJECT Template
        form: {
          FORM_NAME: 'Subject',
          FORM_DESCRIPTION: 'Personal information template for subject requests',
          ORGANIZATION_ID: null,
          COMPANY_ID: null,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'First Name',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 1
          },
          {
            FIELD_NAME: 'Middle Name',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 2
          },
          {
            FIELD_NAME: 'Last Name',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 3
          },
          {
            FIELD_NAME: 'Date of Birth',
            FIELD_TYPE_ID: dateFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'MM/DD/YYYY',
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 4
          },
          {
            FIELD_NAME: 'Social Security Number',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'XXX-XX-XXXX',
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 5
          }
        ]
      },
      {
        // FINANCIAL Template
        form: {
          FORM_NAME: 'Financial',
          FORM_DESCRIPTION: 'Banking and financial information template',
          ORGANIZATION_ID: null,
          COMPANY_ID: null,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'Bank Name',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 1
          },
          {
            FIELD_NAME: 'Account Number',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 2
          },
          {
            FIELD_NAME: 'Routing Number',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 3
          },
          {
            FIELD_NAME: 'Account Type',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: true,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 4
          }
        ]
      },
      {
        // VEHICLE Template
        form: {
          FORM_NAME: 'Vehicle',
          FORM_DESCRIPTION: 'Vehicle information template for transportation requests',
          ORGANIZATION_ID: null,
          COMPANY_ID: null,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'Make',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 1
          },
          {
            FIELD_NAME: 'Model',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 2
          },
          {
            FIELD_NAME: 'Year',
            FIELD_TYPE_ID: numberFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'YYYY',
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 3
          },
          {
            FIELD_NAME: 'License Plate',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 4
          },
          {
            FIELD_NAME: 'VIN',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: true,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 5
          }
        ]
      },
      {
        // ADDRESS Template
        form: {
          FORM_NAME: 'Address',
          FORM_DESCRIPTION: 'Address information template for location requests',
          ORGANIZATION_ID: null,
          COMPANY_ID: null,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          CREATE_USER_ID: userId,
          UPDATE_USER_ID: userId
        },
        fields: [
          {
            FIELD_NAME: 'Address Line 1',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 1
          },
          {
            FIELD_NAME: 'Address Line 2',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: false,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 2
          },
          {
            FIELD_NAME: 'City',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 3
          },
          {
            FIELD_NAME: 'State',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: true,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: null,
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 4
          },
          {
            FIELD_NAME: 'ZIP Code',
            FIELD_TYPE_ID: textFieldType.FIELD_TYPE_ID,
            IS_REQUIRED: true,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            HAS_LOOKUP: false,
            CAN_SELECT_MULIPLE: false,
            DISPLAY_FORMAT: 'XXXXX',
            ORGANIZATION_ID: null,
            CREATE_USER_ID: userId,
            UPDATE_USER_ID: userId,
            SORT_ORDER: 5
          }
        ]
      }
    ];
    
    // Create each template and its fields using raw SQL for better control
    for (const template of templates) {
      console.log(`Creating template: ${template.form.FORM_NAME}`);
      
      try {
        // Check if form already exists
        const existingForms = await prisma.$queryRaw`
          SELECT FORM_ID FROM GUARDIAN.FORMS 
          WHERE FORM_NAME = ${template.form.FORM_NAME}
          AND (COMPANY_ID IS NULL OR ORGANIZATION_ID IS NULL)
        `;
        
        if (Array.isArray(existingForms) && existingForms.length > 0) {
          console.log(`Form ${template.form.FORM_NAME} already exists, skipping...`);
          continue;
        }
        
        // Create the form using raw SQL
        const formResults = await prisma.$queryRaw`
          INSERT INTO GUARDIAN.FORMS (
            FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, COMPANY_ID, 
            IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID, 
            CREATE_DATE, UPDATE_DATE
          )
          OUTPUT INSERTED.FORM_ID
          VALUES (
            ${template.form.FORM_NAME}, ${template.form.FORM_DESCRIPTION}, 
            ${template.form.ORGANIZATION_ID}, ${template.form.COMPANY_ID},
            ${template.form.IS_PUBLIC}, ${template.form.IS_ACTIVE}, ${template.form.IS_DELETED},
            ${template.form.CREATE_USER_ID}, ${template.form.UPDATE_USER_ID},
            GETDATE(), GETDATE()
          )
        `;
        
        const formId = Array.isArray(formResults) && formResults.length > 0 ? 
          (formResults[0] as any).FORM_ID : null;
        
        if (!formId) {
          throw new Error(`Failed to create form ${template.form.FORM_NAME}`);
        }
        
        console.log(`Created form ${template.form.FORM_NAME} with ID: ${formId}`);
        
        // Create the fields for this form
        for (const field of template.fields) {
          try {
            // Create field using raw SQL
            const fieldResults = await prisma.$queryRaw`
              INSERT INTO GUARDIAN.FIELDS (
                FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP, IS_PUBLIC, IS_ACTIVE, 
                IS_DELETED, IS_REQUIRED, IS_SENSITIVE, CAN_SELECT_MULIPLE, ORGANIZATION_ID,
                CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
              )
              OUTPUT INSERTED.FIELD_ID
              VALUES (
                ${field.FIELD_NAME}, ${field.FIELD_TYPE_ID}, ${field.DISPLAY_FORMAT}, 
                ${field.HAS_LOOKUP}, ${field.IS_PUBLIC}, ${field.IS_ACTIVE}, ${field.IS_DELETED}, 
                ${field.IS_REQUIRED}, ${field.IS_SENSITIVE}, ${field.CAN_SELECT_MULIPLE}, 
                ${field.ORGANIZATION_ID}, ${field.CREATE_USER_ID}, ${field.UPDATE_USER_ID},
                GETDATE(), GETDATE()
              )
            `;
            
            const fieldId = Array.isArray(fieldResults) && fieldResults.length > 0 ? 
              (fieldResults[0] as any).FIELD_ID : null;
            
            if (!fieldId) {
              throw new Error(`Failed to create field ${field.FIELD_NAME}`);
            }
            
            console.log(`Created field: ${field.FIELD_NAME} with ID: ${fieldId}`);
            
            // Create form-field relationship
            await prisma.$queryRaw`
              INSERT INTO GUARDIAN.FORMS_FIELDS (
                FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, 
                CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
              )
              VALUES (
                ${formId}, ${fieldId}, ${field.IS_REQUIRED}, ${field.SORT_ORDER},
                ${userId}, ${userId}, GETDATE(), GETDATE()
              )
            `;
            
            console.log(`Created form-field relationship for ${field.FIELD_NAME}`);
          } catch (error) {
            console.error(`Error creating field ${field.FIELD_NAME}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error creating form ${template.form.FORM_NAME}:`, error);
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
