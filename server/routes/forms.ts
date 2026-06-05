import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getLockedFields } from '../lib/jafarConfig.js';
import { writeAudit } from '../lib/audit.js';

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

// Define field schema (with compliance flags — all new flags optional for backward compatibility)
const FieldSchema = z.object({
  FIELD_ID: z.number().optional(),
  FIELD_NAME: z.string(),
  FIELD_TYPE_ID: z.number(),
  IS_REQUIRED: z.boolean(),
  OPTIONS: z.string().nullable().optional(),
  SEQUENCE: z.number().optional(),
  VALIDATION: z.string().nullable().optional(),
  // Compliance Control Layer additions (Phase 4 / US-CCL-01)
  IS_PII: z.boolean().optional(),
  IS_ENABLED: z.boolean().optional(),
  IS_READ_ONLY: z.boolean().optional(),
});

// Define form schema (with notice-subtype + compliance additions — all new fields optional)
const FormSchema = z.object({
  FORM_ID: z.number().optional(),
  FORM_NAME: z.string(),
  FORM_DESCRIPTION: z.string().nullable().optional(),
  IS_PUBLIC: z.boolean(),
  IS_ACTIVE: z.boolean(),
  IS_DELETED: z.boolean(),
  // Compliance Control Layer additions (Phase 4 / US-CCL-02)
  NOTICE_SUBTYPE: z.enum(['SECURITIES_FRAUD', 'SUBPOENA_RIDER']).optional(),
  FRAUD_TYPE: z.enum(['SECURITIES_MANIPULATION', 'ATO', 'CHECK_FRAUD', 'WIRE_FRAUD']).optional(),
  REQUIRES_MANAGER_APPROVAL: z.boolean().optional(),
  COMPLIANCE_DISCLAIMER_ENABLED: z.boolean().optional(),
  TITLE_FORMAT: z.string().optional(),
  // Notice Type picker (Create New Template modal). NULL for non-notice templates.
  NOTICE_CATEGORY: z.enum(['ANCM', 'SEC', 'GEN', 'TRGT']).optional(),
});

type ComplianceFieldFlags = {
  IS_PII?: boolean;
  IS_ENABLED?: boolean;
  IS_READ_ONLY?: boolean;
  IS_LOCKED_BY_JAFAR?: boolean;
};

type FormsFieldRow = {
  FORM_ID: number;
  FIELD_ID: number;
  IS_REQUIRED: boolean;
  SORT_ORDER: number | null;
  IS_PII: boolean;
  IS_ENABLED: boolean;
  IS_LOCKED_BY_JAFAR: boolean;
  IS_READ_ONLY: boolean;
};

/**
 * Apply JAFAR locked-field intersection to an incoming field payload.
 * If a field's name appears in the platform-wide locked list, force
 * IS_ENABLED = false and IS_LOCKED_BY_JAFAR = true.
 */
function applyJafarLock(
  fieldName: string,
  flags: ComplianceFieldFlags,
  lockedFieldNames: string[],
): ComplianceFieldFlags {
  const out: ComplianceFieldFlags = { ...flags };
  if (lockedFieldNames.includes(fieldName)) {
    out.IS_ENABLED = false;
    out.IS_LOCKED_BY_JAFAR = true;
  } else if (out.IS_LOCKED_BY_JAFAR === undefined) {
    out.IS_LOCKED_BY_JAFAR = false;
  }
  return out;
}

/**
 * Fetch the existing FORMS_FIELDS row(s) for prev-state comparison during audits.
 * FORMS_FIELDS is @@ignore in Prisma so we use $queryRaw.
 */
async function fetchExistingFormFields(formId: number): Promise<Array<FormsFieldRow & { FIELD_NAME: string }>> {
  const rows = (await prisma.$queryRaw`
    SELECT ff."FORM_ID", ff."FIELD_ID", ff."IS_REQUIRED", ff."SORT_ORDER",
           ff."IS_PII", ff."IS_ENABLED", ff."IS_LOCKED_BY_JAFAR", ff."IS_READ_ONLY",
           f."FIELD_NAME"
    FROM "GUARDIAN"."FORMS_FIELDS" ff
    JOIN "GUARDIAN"."FIELDS" f ON f."FIELD_ID" = ff."FIELD_ID"
    WHERE ff."FORM_ID" = ${formId}
  `) as Array<FormsFieldRow & { FIELD_NAME: string }>;
  return rows;
}

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
    console.log(`[FORMS GET] Fetching form with ID: ${id}`);

    const form = await prisma.fORMS.findUnique({
      where: {
        FORM_ID: parseInt(id),
      },
    });

    console.log(`[FORMS GET] Form ${id} found:`, form ? 'YES' : 'NO');

    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    console.log(`[FORMS GET] Fetching fields for form ${id}...`);

    // Get the fields associated with this form
    let formFields: any[] = [];
    try {
      const result = await prisma.$queryRaw`
        SELECT f.*
        FROM "GUARDIAN"."FIELDS" f
        JOIN "GUARDIAN"."FORMS_FIELDS" ff ON f."FIELD_ID" = ff."FIELD_ID"
        WHERE ff."FORM_ID" = ${parseInt(id)}
        ORDER BY ff."SORT_ORDER"
      `;
      formFields = result as any[];
    } catch (queryError) {
      console.log(`[FORMS GET] No fields found for form ${id} or query error:`, queryError);
      // Continue with empty fields array
      formFields = [];
    }

    console.log(`[FORMS GET] Fields query result for form ${id}: ${Array.isArray(formFields) ? formFields.length : 'ERROR'} fields`);

    // Type assertion for formFields
    const typedFormFields = formFields as Array<{
      FIELD_ID: number;
      FIELD_NAME: string;
      FIELD_TYPE_ID: number;
      HAS_LOOKUP: boolean;
      IS_REQUIRED: boolean;
      DISPLAY_FORMAT: string | null;
      OPTIONS?: string;
      VALIDATION?: string | null;
    }>;

    console.log(`[FORMS GET] Processing ${typedFormFields.length} fields for lookups...`);

    // For fields with lookups, get their lookup values
    for (const field of typedFormFields) {
      console.log(`[FORMS GET] Processing field ${field.FIELD_ID}, HAS_LOOKUP: ${field.HAS_LOOKUP}`);

      if (field.HAS_LOOKUP) {
        console.log(`[FORMS GET] Fetching lookups for field ${field.FIELD_ID}...`);

        const lookups = await prisma.fIELDS_LOOKUP.findMany({
          where: {
            FIELD_ID: field.FIELD_ID,
          },
          orderBy: {
            SORT_ORDER: 'asc',
          },
        });

        console.log(`[FORMS GET] Found ${lookups.length} lookups for field ${field.FIELD_ID}`);

        // Convert lookups to comma-separated string for frontend
        field.OPTIONS = lookups.map((lookup: any) => lookup.LOOKUP_DESCRIPTION).join(',');
      }
    }

    console.log(`[FORMS GET] Successfully returning form ${id} with ${typedFormFields.length} fields`);
    res.json({ form, fields: typedFormFields });
  } catch (error) {
    console.error(`[FORMS GET] Error fetching form ${id}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    res.status(500).json({
      error: 'Failed to fetch form',
      details: errorMessage,
      stack: errorStack,
      formId: id
    });
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
        // Phase 4 / US-CCL-02 — all optional
        NOTICE_SUBTYPE?: 'SECURITIES_FRAUD' | 'SUBPOENA_RIDER';
        FRAUD_TYPE?: 'SECURITIES_MANIPULATION' | 'ATO' | 'CHECK_FRAUD' | 'WIRE_FRAUD';
        REQUIRES_MANAGER_APPROVAL?: boolean;
        COMPLIANCE_DISCLAIMER_ENABLED?: boolean;
        TITLE_FORMAT?: string;
        // Notice Type picker (Create New Template modal)
        NOTICE_CATEGORY?: 'ANCM' | 'SEC' | 'GEN' | 'TRGT';
      },
      fields: Array<{
        FIELD_NAME: string;
        FIELD_TYPE_ID: number;
        IS_REQUIRED: boolean;
        OPTIONS?: string;
        SEQUENCE: number;
        VALIDATION?: string | null;
        // Phase 4 / US-CCL-01 — all optional
        IS_PII?: boolean;
        IS_ENABLED?: boolean;
        IS_READ_ONLY?: boolean;
      }>
    };

    const actorUserId = req.user?.id ?? null;
    const actorRoleId = (req as any).actorRoleId ?? null;

    // Pre-resolve JAFAR locked fields (Phase 4 / Task 4.1 Step 2)
    const lockedFieldNames = await getLockedFields();

    // Default disclaimer ON for SECURITIES_FRAUD if undefined (Phase 4 / Task 4.2 Step 2)
    const notice_subtype = form.NOTICE_SUBTYPE;
    let complianceDisclaimerEnabled = form.COMPLIANCE_DISCLAIMER_ENABLED;
    if (notice_subtype === 'SECURITIES_FRAUD' && complianceDisclaimerEnabled === undefined) {
      complianceDisclaimerEnabled = true;
    }

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
        // Compliance fields (only persisted if provided)
        NOTICE_SUBTYPE: notice_subtype ?? undefined,
        FRAUD_TYPE: form.FRAUD_TYPE ?? undefined,
        REQUIRES_MANAGER_APPROVAL: form.REQUIRES_MANAGER_APPROVAL ?? undefined,
        COMPLIANCE_DISCLAIMER_ENABLED: complianceDisclaimerEnabled ?? undefined,
        TITLE_FORMAT: form.TITLE_FORMAT ?? undefined,
        NOTICE_CATEGORY: form.NOTICE_CATEGORY ?? undefined,
      },
    });

    const companyId = (createdForm as any).COMPANY_ID ?? null;

    // Audit: disclaimer + manager-approval initial state on creation
    // (compare against undefined prior-state; "DISCLAIMER_TOGGLED" on create only when explicitly set or defaulted)
    if (complianceDisclaimerEnabled !== undefined) {
      await writeAudit({
        eventType: 'DISCLAIMER_TOGGLED',
        actorUserId,
        actorRoleId,
        targetType: 'TEMPLATE',
        targetId: createdForm.FORM_ID,
        companyId,
        disclaimerState: complianceDisclaimerEnabled,
        detail: {
          prevState: null,
          newState: complianceDisclaimerEnabled,
          direction: complianceDisclaimerEnabled ? 'OFF_TO_ON' : 'ON_TO_OFF',
        },
      });
    }
    if (form.REQUIRES_MANAGER_APPROVAL !== undefined) {
      await writeAudit({
        eventType: 'MANAGER_APPROVAL_CONFIG_CHANGED',
        actorUserId,
        actorRoleId,
        targetType: 'TEMPLATE',
        targetId: createdForm.FORM_ID,
        companyId,
        detail: { toggleState: form.REQUIRES_MANAGER_APPROVAL, prevState: null },
      });
    }

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
          VALIDATION: field.VALIDATION ?? null,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          IS_SENSITIVE: false,
          CAN_SELECT_MULIPLE: false,
          CREATE_USER_ID: req.user?.id || undefined,
          UPDATE_USER_ID: req.user?.id || undefined,
        },
      });

      // Resolve compliance flags with JAFAR-lock intersection (Phase 4 / Task 4.1)
      const incomingFlags: ComplianceFieldFlags = {
        IS_PII: field.IS_PII ?? false,
        IS_ENABLED: field.IS_ENABLED ?? true,
        IS_READ_ONLY: field.IS_READ_ONLY ?? false,
      };
      const resolvedFlags = applyJafarLock(field.FIELD_NAME, incomingFlags, lockedFieldNames);

      // Create the form-field association (now persisting compliance flags)
      await prisma.$executeRaw`
        INSERT INTO "GUARDIAN"."FORMS_FIELDS"
          ("FORM_ID", "FIELD_ID", "IS_REQUIRED", "SORT_ORDER",
           "IS_PII", "IS_ENABLED", "IS_LOCKED_BY_JAFAR", "IS_READ_ONLY",
           "CREATE_USER_ID", "UPDATE_USER_ID")
        VALUES
          (${createdForm.FORM_ID}, ${createdField.FIELD_ID},
           ${field.IS_REQUIRED}, ${field.SEQUENCE || 0},
           ${resolvedFlags.IS_PII ?? false},
           ${resolvedFlags.IS_ENABLED ?? true},
           ${resolvedFlags.IS_LOCKED_BY_JAFAR ?? false},
           ${resolvedFlags.IS_READ_ONLY ?? false},
           ${req.user?.id || null}, ${req.user?.id || null})
      `;

      // Audit: field restriction change on creation (prevState is null since this is brand new)
      await writeAudit({
        eventType: 'FIELD_RESTRICTION_CHANGED',
        actorUserId,
        actorRoleId,
        targetType: 'TEMPLATE',
        targetId: createdForm.FORM_ID,
        companyId,
        detail: {
          fieldName: field.FIELD_NAME,
          prevState: null,
          newState: {
            IS_PII: resolvedFlags.IS_PII ?? false,
            IS_ENABLED: resolvedFlags.IS_ENABLED ?? true,
            IS_LOCKED_BY_JAFAR: resolvedFlags.IS_LOCKED_BY_JAFAR ?? false,
            IS_READ_ONLY: resolvedFlags.IS_READ_ONLY ?? false,
          },
        },
      });

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
  const formId = parseInt(id);

  try {
    // Validate request body
    const { form, fields } = req.body;
    const validatedForm = FormSchema.parse(form);

    const actorUserId = req.user?.id ?? null;
    const actorRoleId = (req as any).actorRoleId ?? null;

    // Load prior FORMS row for compliance diff (Phase 4 / Task 4.2 Step 3-4)
    const priorForm = await prisma.fORMS.findUnique({ where: { FORM_ID: formId } });

    // Default disclaimer ON for SECURITIES_FRAUD if undefined (Phase 4 / Task 4.2 Step 2)
    const notice_subtype = validatedForm.NOTICE_SUBTYPE;
    let complianceDisclaimerEnabled = validatedForm.COMPLIANCE_DISCLAIMER_ENABLED;
    if (notice_subtype === 'SECURITIES_FRAUD' && complianceDisclaimerEnabled === undefined) {
      complianceDisclaimerEnabled = true;
    }

    // Update the form
    const updatedForm = await prisma.fORMS.update({
      where: {
        FORM_ID: formId,
      },
      data: {
        FORM_NAME: validatedForm.FORM_NAME,
        FORM_DESCRIPTION: validatedForm.FORM_DESCRIPTION || "",
        IS_PUBLIC: validatedForm.IS_PUBLIC,
        IS_ACTIVE: validatedForm.IS_ACTIVE,
        IS_DELETED: validatedForm.IS_DELETED,
        UPDATE_USER_ID: req.user?.id || undefined,
        // Compliance fields — only update when present in payload
        NOTICE_SUBTYPE: validatedForm.NOTICE_SUBTYPE ?? undefined,
        FRAUD_TYPE: validatedForm.FRAUD_TYPE ?? undefined,
        REQUIRES_MANAGER_APPROVAL: validatedForm.REQUIRES_MANAGER_APPROVAL ?? undefined,
        COMPLIANCE_DISCLAIMER_ENABLED: complianceDisclaimerEnabled ?? undefined,
        TITLE_FORMAT: validatedForm.TITLE_FORMAT ?? undefined,
      },
    });

    const companyId = (updatedForm as any).COMPANY_ID ?? (priorForm as any)?.COMPANY_ID ?? null;

    // Audit: DISCLAIMER_TOGGLED if changed (Phase 4 / Task 4.2 Step 3)
    if (
      complianceDisclaimerEnabled !== undefined &&
      priorForm &&
      Boolean(priorForm.COMPLIANCE_DISCLAIMER_ENABLED) !== Boolean(complianceDisclaimerEnabled)
    ) {
      const prevState = Boolean(priorForm.COMPLIANCE_DISCLAIMER_ENABLED);
      const newState = Boolean(complianceDisclaimerEnabled);
      await writeAudit({
        eventType: 'DISCLAIMER_TOGGLED',
        actorUserId,
        actorRoleId,
        targetType: 'TEMPLATE',
        targetId: formId,
        companyId,
        disclaimerState: newState,
        detail: {
          prevState,
          newState,
          direction: !prevState && newState ? 'OFF_TO_ON' : 'ON_TO_OFF',
        },
      });
    }

    // Audit: MANAGER_APPROVAL_CONFIG_CHANGED if changed (Phase 4 / Task 4.2 Step 4)
    if (
      validatedForm.REQUIRES_MANAGER_APPROVAL !== undefined &&
      priorForm &&
      Boolean(priorForm.REQUIRES_MANAGER_APPROVAL) !== Boolean(validatedForm.REQUIRES_MANAGER_APPROVAL)
    ) {
      await writeAudit({
        eventType: 'MANAGER_APPROVAL_CONFIG_CHANGED',
        actorUserId,
        actorRoleId,
        targetType: 'TEMPLATE',
        targetId: formId,
        companyId,
        detail: {
          prevState: Boolean(priorForm.REQUIRES_MANAGER_APPROVAL),
          toggleState: Boolean(validatedForm.REQUIRES_MANAGER_APPROVAL),
        },
      });
    }

    // Pre-resolve JAFAR locked fields once (Phase 4 / Task 4.1 Step 2)
    const lockedFieldNames = await getLockedFields();

    // Snapshot prior FORMS_FIELDS state keyed by FIELD_ID for audit diff (Phase 4 / Task 4.1 Step 3)
    const priorFormFields = await fetchExistingFormFields(formId);
    const priorByFieldId = new Map<number, FormsFieldRow & { FIELD_NAME: string }>();
    for (const r of priorFormFields) priorByFieldId.set(r.FIELD_ID, r);

    // Update or create fields
    const updatedFields: any[] = [];
    for (const field of fields) {
      const validatedField = FieldSchema.parse(field);

      let fieldId: number;
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
            VALIDATION: validatedField.VALIDATION ?? null,
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
            VALIDATION: validatedField.VALIDATION ?? null,
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

      // Resolve compliance flags with JAFAR-lock intersection (Phase 4 / Task 4.1)
      const incomingFlags: ComplianceFieldFlags = {
        IS_PII: validatedField.IS_PII,
        IS_ENABLED: validatedField.IS_ENABLED,
        IS_READ_ONLY: validatedField.IS_READ_ONLY,
      };
      const resolvedFlags = applyJafarLock(validatedField.FIELD_NAME, incomingFlags, lockedFieldNames);

      const prior = priorByFieldId.get(fieldId);
      const newState = {
        IS_PII: resolvedFlags.IS_PII ?? prior?.IS_PII ?? false,
        IS_ENABLED: resolvedFlags.IS_ENABLED ?? prior?.IS_ENABLED ?? true,
        IS_LOCKED_BY_JAFAR: resolvedFlags.IS_LOCKED_BY_JAFAR ?? prior?.IS_LOCKED_BY_JAFAR ?? false,
        IS_READ_ONLY: resolvedFlags.IS_READ_ONLY ?? prior?.IS_READ_ONLY ?? false,
      };

      // Upsert FORMS_FIELDS row (FORMS_FIELDS is @@ignore in Prisma)
      if (prior) {
        await prisma.$executeRaw`
          UPDATE "GUARDIAN"."FORMS_FIELDS"
          SET "IS_REQUIRED"       = ${validatedField.IS_REQUIRED},
              "SORT_ORDER"        = ${validatedField.SEQUENCE ?? prior.SORT_ORDER ?? 0},
              "IS_PII"             = ${newState.IS_PII},
              "IS_ENABLED"         = ${newState.IS_ENABLED},
              "IS_LOCKED_BY_JAFAR" = ${newState.IS_LOCKED_BY_JAFAR},
              "IS_READ_ONLY"       = ${newState.IS_READ_ONLY},
              "UPDATE_USER_ID"     = ${req.user?.id || null},
              "UPDATE_DATE"        = ${new Date()}
          WHERE "FORM_ID" = ${formId} AND "FIELD_ID" = ${fieldId}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "GUARDIAN"."FORMS_FIELDS"
            ("FORM_ID", "FIELD_ID", "IS_REQUIRED", "SORT_ORDER",
             "IS_PII", "IS_ENABLED", "IS_LOCKED_BY_JAFAR", "IS_READ_ONLY",
             "CREATE_USER_ID", "UPDATE_USER_ID")
          VALUES
            (${formId}, ${fieldId},
             ${validatedField.IS_REQUIRED}, ${validatedField.SEQUENCE ?? 0},
             ${newState.IS_PII}, ${newState.IS_ENABLED},
             ${newState.IS_LOCKED_BY_JAFAR}, ${newState.IS_READ_ONLY},
             ${req.user?.id || null}, ${req.user?.id || null})
        `;
      }

      // Audit: FIELD_RESTRICTION_CHANGED if any of IS_PII/IS_ENABLED/IS_LOCKED_BY_JAFAR/IS_READ_ONLY changed
      const restrictionChanged =
        !prior ||
        Boolean(prior.IS_PII) !== Boolean(newState.IS_PII) ||
        Boolean(prior.IS_ENABLED) !== Boolean(newState.IS_ENABLED) ||
        Boolean(prior.IS_LOCKED_BY_JAFAR) !== Boolean(newState.IS_LOCKED_BY_JAFAR) ||
        Boolean(prior.IS_READ_ONLY) !== Boolean(newState.IS_READ_ONLY);
      if (restrictionChanged) {
        const prevState = prior
          ? {
              IS_PII: Boolean(prior.IS_PII),
              IS_ENABLED: Boolean(prior.IS_ENABLED),
              IS_LOCKED_BY_JAFAR: Boolean(prior.IS_LOCKED_BY_JAFAR),
              IS_READ_ONLY: Boolean(prior.IS_READ_ONLY),
            }
          : null;
        await writeAudit({
          eventType: 'FIELD_RESTRICTION_CHANGED',
          actorUserId,
          actorRoleId,
          targetType: 'TEMPLATE',
          targetId: formId,
          companyId,
          detail: {
            fieldName: validatedField.FIELD_NAME,
            prevState,
            newState,
          },
        });
      }

      // If the field has lookup values, update them
      if (field.OPTIONS) {
        // Delete existing lookup values
        if (field.FIELD_ID) {
          await prisma.$executeRaw`DELETE FROM "GUARDIAN"."FIELDS_LOOKUP" WHERE "FIELD_ID" = ${fieldId}`;
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
