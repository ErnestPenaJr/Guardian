import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Define User type to extend Express.Request
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
    }
  }
}

// Define field type schema
const FieldTypeSchema = z.object({
  FIELD_TYPE_ID: z.number(),
  FIELD_TYPE_NAME: z.string(),
  FIELD_TYPE_DESCRIPTION: z.string().nullable(),
  IS_ACTIVE: z.boolean(),
  IS_DELETED: z.boolean(),
  SORT_ORDER: z.number().nullable(),
  CREATE_DATE: z.date().nullable(),
  CREATE_USER_ID: z.number().nullable(),
  UPDATE_DATE: z.date().nullable(),
  UPDATE_USER_ID: z.number().nullable(),
});

// Define field schema
const FieldSchema = z.object({
  FIELD_ID: z.number().optional(),
  FIELD_NAME: z.string(),
  FIELD_TYPE_ID: z.number(),
  IS_REQUIRED: z.boolean(),
  OPTIONS: z.string().nullable().optional(),
  SEQUENCE: z.number().optional(),
});

// Define form schema
const FormSchema = z.object({
  FORM_ID: z.number().optional(),
  FORM_NAME: z.string(),
  FORM_DESCRIPTION: z.string().nullable().optional(),
  IS_PUBLIC: z.boolean(),
  IS_ACTIVE: z.boolean(),
  IS_DELETED: z.boolean(),
});

// Get all forms
router.get('/', async (req, res) => {
  try {
    const forms = await prisma.fORMS.findMany({
      where: {
        IS_DELETED: false,
      },
    });
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get a specific form
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const form = await prisma.fORMS.findUnique({
      where: {
        FORM_ID: parseInt(id),
      },
    });
    
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Get the fields associated with this form
    const formFields = await prisma.$queryRaw`
      SELECT f.* 
      FROM FIELDS f
      JOIN FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
      WHERE ff.FORM_ID = ${parseInt(id)}
      ORDER BY ff.SORT_ORDER
    `;
    
    // Type assertion for formFields
    const typedFormFields = formFields as Array<{
      FIELD_ID: number;
      FIELD_NAME: string;
      FIELD_TYPE_ID: number;
      HAS_LOOKUP: boolean;
      IS_REQUIRED: boolean;
      DISPLAY_FORMAT: string | null;
      OPTIONS?: string;
    }>;
    
    // For fields with lookups, get their lookup values
    for (const field of typedFormFields) {
      if (field.HAS_LOOKUP) {
        const lookups = await prisma.fIELDS_LOOKUP.findMany({
          where: {
            FIELD_ID: field.FIELD_ID,
          },
          orderBy: {
            SORT_ORDER: 'asc',
          },
        });
        
        // Convert lookups to comma-separated string for frontend
        field.OPTIONS = lookups.map((lookup: any) => lookup.LOOKUP_DESCRIPTION).join(',');
      }
    }
    
    res.json({ form, fields: typedFormFields });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create a new form
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { form, fields } = req.body as { 
      form: { 
        FORM_NAME: string;
        FORM_DESCRIPTION?: string;
        IS_PUBLIC: boolean;
        IS_ACTIVE: boolean;
        IS_DELETED: boolean;
      },
      fields: Array<{
        FIELD_NAME: string;
        FIELD_TYPE_ID: number;
        IS_REQUIRED: boolean;
        OPTIONS?: string;
        SEQUENCE: number;
      }>
    };

    // Create the form
    const createdForm = await prisma.fORMS.create({
      data: {
        FORM_NAME: form.FORM_NAME,
        FORM_DESCRIPTION: form.FORM_DESCRIPTION || "",
        IS_PUBLIC: form.IS_PUBLIC,
        IS_ACTIVE: form.IS_ACTIVE,
        IS_DELETED: form.IS_DELETED,
        CREATE_USER_ID: req.user?.id || undefined,
        UPDATE_USER_ID: req.user?.id || undefined,
      },
    });

    // Create the fields
    const createdFields: any[] = [];
    for (const field of fields) {
      // Create the field
      const createdField = await prisma.fIELDS.create({
        data: {
          FIELD_NAME: field.FIELD_NAME,
          FIELD_TYPE_ID: field.FIELD_TYPE_ID,
          IS_REQUIRED: field.IS_REQUIRED,
          // Store options in a format compatible with the database schema
          DISPLAY_FORMAT: field.OPTIONS || undefined,
          HAS_LOOKUP: field.OPTIONS ? true : false,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          IS_SENSITIVE: false,
          CAN_SELECT_MULIPLE: false,
          CREATE_USER_ID: req.user?.id || undefined,
          UPDATE_USER_ID: req.user?.id || undefined,
        },
      });
      
      // Create the form-field association
      await prisma.$executeRaw`
        INSERT INTO FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, UPDATE_USER_ID)
        VALUES (${createdForm.FORM_ID}, ${createdField.FIELD_ID}, ${field.IS_REQUIRED}, ${field.SEQUENCE}, ${req.user?.id || undefined}, ${req.user?.id || undefined})
      `;
      
      // If the field has lookup values (dropdown/radio options), create them
      if (field.OPTIONS) {
        const options = field.OPTIONS.split(',').map((option: string) => option.trim()).filter(Boolean);
        
        for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
          const option = options[optionIndex];
          await prisma.fIELDS_LOOKUP.create({
            data: {
              FIELD_ID: createdField.FIELD_ID,
              LOOKUP_CODE: `${optionIndex + 1}`,
              LOOKUP_DESCRIPTION: option,
              SORT_ORDER: optionIndex,
              CREATE_USER_ID: req.user?.id || undefined,
              UPDATE_USER_ID: req.user?.id || undefined,
            },
          });
        }
      }
      
      createdFields.push(createdField);
    }
    
    res.status(201).json({ form: createdForm, fields: createdFields });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Update a form
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Validate request body
    const { form, fields } = req.body;
    const validatedForm = FormSchema.parse(form);
    
    // Update the form
    const updatedForm = await prisma.fORMS.update({
      where: {
        FORM_ID: parseInt(id),
      },
      data: {
        FORM_NAME: validatedForm.FORM_NAME,
        FORM_DESCRIPTION: validatedForm.FORM_DESCRIPTION || "",
        IS_PUBLIC: validatedForm.IS_PUBLIC,
        IS_ACTIVE: validatedForm.IS_ACTIVE,
        IS_DELETED: validatedForm.IS_DELETED,
        UPDATE_USER_ID: req.user?.id || undefined,
      },
    });
    
    // Update or create fields
    const updatedFields: any[] = [];
    for (const field of fields) {
      const validatedField = FieldSchema.parse(field);
      
      let fieldId;
      if (field.FIELD_ID) {
        // Update existing field
        const updatedField = await prisma.fIELDS.update({
          where: {
            FIELD_ID: field.FIELD_ID,
          },
          data: {
            FIELD_NAME: validatedField.FIELD_NAME,
            FIELD_TYPE_ID: validatedField.FIELD_TYPE_ID,
            IS_REQUIRED: validatedField.IS_REQUIRED,
            UPDATE_USER_ID: req.user?.id || undefined,
          },
        });
        fieldId = updatedField.FIELD_ID;
      } else {
        // Create new field
        const createdField = await prisma.fIELDS.create({
          data: {
            FIELD_NAME: validatedField.FIELD_NAME,
            FIELD_TYPE_ID: validatedField.FIELD_TYPE_ID,
            IS_REQUIRED: validatedField.IS_REQUIRED,
            IS_PUBLIC: true,
            IS_ACTIVE: true,
            IS_DELETED: false,
            IS_SENSITIVE: false,
            CAN_SELECT_MULIPLE: false,
            CREATE_USER_ID: req.user?.id || undefined,
            UPDATE_USER_ID: req.user?.id || undefined,
          },
        });
        fieldId = createdField.FIELD_ID;
      }
      
      // If the field has lookup values, update them
      if (field.OPTIONS) {
        // Delete existing lookup values
        if (field.FIELD_ID) {
          await prisma.$executeRaw`DELETE FROM FIELDS_LOOKUP WHERE FIELD_ID = ${fieldId}`;
        }
        
        const options = field.OPTIONS.split(',').map((option: string) => option.trim()).filter(Boolean);
        
        for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
          const option = options[optionIndex];
          await prisma.fIELDS_LOOKUP.create({
            data: {
              FIELD_ID: fieldId,
              LOOKUP_CODE: `${optionIndex + 1}`,
              LOOKUP_DESCRIPTION: option,
              SORT_ORDER: optionIndex,
              CREATE_USER_ID: req.user?.id || undefined,
              UPDATE_USER_ID: req.user?.id || undefined,
            },
          });
        }
      }
      
      updatedFields.push({
        ...validatedField,
        FIELD_ID: fieldId
      });
    }
    
    res.json({ form: updatedForm, fields: updatedFields });
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Delete a form (soft delete)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updatedForm = await prisma.fORMS.update({
      where: {
        FORM_ID: parseInt(id),
      },
      data: {
        IS_DELETED: true,
        UPDATE_USER_ID: req.user?.id || undefined,
      },
    });
    
    res.json(updatedForm);
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

export default router;
