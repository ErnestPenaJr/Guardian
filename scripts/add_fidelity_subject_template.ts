import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The canonical form ID that existing REQUEST records reference.
// Using SET IDENTITY_INSERT ensures production stays in sync with dev.
const TARGET_FORM_ID = 1091;

async function addFidelitySubjectTemplate() {
  try {
    console.log('Starting to add Fidelity-Subject form template...');
    console.log(`Target FORM_ID: ${TARGET_FORM_ID}`);

    // ── Guard: skip only if the form already has fields linked ──────
    const existing = await prisma.$queryRaw<any[]>`
      SELECT FORM_ID FROM GUARDIAN.FORMS
      WHERE FORM_ID = ${TARGET_FORM_ID}
    `;
    const formAlreadyExists = Array.isArray(existing) && existing.length > 0;

    if (formAlreadyExists) {
      // Check whether fields have already been seeded for this form
      const existingFields = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) AS cnt FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID = ${TARGET_FORM_ID}
      `;
      const fieldCount = Number(existingFields?.[0]?.cnt ?? 0);
      if (fieldCount > 0) {
        console.log(`Form ID ${TARGET_FORM_ID} (Fidelity-Subject) already exists with ${fieldCount} fields — skipping.`);
        return;
      }
      console.log(`Form ID ${TARGET_FORM_ID} exists but has 0 fields — seeding fields now...`);
    }

    // Get existing field types
    const fieldTypes = await prisma.$queryRaw<any[]>`
      SELECT FIELD_TYPE_ID, FIELD_TYPE_DESC
      FROM GUARDIAN.FIELD_TYPE
      ORDER BY SORT_ORDER
    `;

    console.log('Found field types:', fieldTypes);

    const textFieldType     = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Text Input');
    const textareaFieldType = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Textarea');
    const dateFieldType     = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Date');
    const dropdownFieldType = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Dropdown');
    const radioFieldType    = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Radio Button');
    const phoneFieldType    = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Phone');
    const urlFieldType      = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'URL');

    if (!textFieldType)     throw new Error('Field type not found: Text Input');
    if (!textareaFieldType) throw new Error('Field type not found: Textarea');
    if (!dateFieldType)     throw new Error('Field type not found: Date');
    if (!dropdownFieldType) throw new Error('Field type not found: Dropdown');
    if (!radioFieldType)    throw new Error('Field type not found: Radio Button');
    if (!phoneFieldType)    throw new Error('Field type not found: Phone');
    if (!urlFieldType)      throw new Error('Field type not found: URL');

    const userId = 1000; // System user ID

    // Helper to build a field definition
    const f = (
      name: string,
      typeId: number,
      sort: number,
      opts: {
        required?: boolean;
        sensitive?: boolean;
        hasLookup?: boolean;
        displayFormat?: string | null;
      } = {}
    ) => ({
      FIELD_NAME: name,
      FIELD_TYPE_ID: typeId,
      IS_REQUIRED: opts.required ?? false,
      IS_PUBLIC: true,
      IS_ACTIVE: true,
      IS_DELETED: false,
      IS_SENSITIVE: opts.sensitive ?? false,
      HAS_LOOKUP: opts.hasLookup ?? false,
      CAN_SELECT_MULIPLE: false,
      DISPLAY_FORMAT: opts.displayFormat ?? null,
      ORGANIZATION_ID: null,
      CREATE_USER_ID: userId,
      UPDATE_USER_ID: userId,
      SORT_ORDER: sort,
    });

    const T  = textFieldType.FIELD_TYPE_ID;
    const TA = textareaFieldType.FIELD_TYPE_ID;
    const D  = dateFieldType.FIELD_TYPE_ID;
    const DD = dropdownFieldType.FIELD_TYPE_ID;
    const RB = radioFieldType.FIELD_TYPE_ID;
    const PH = phoneFieldType.FIELD_TYPE_ID;
    const UR = urlFieldType.FIELD_TYPE_ID;

    const fields = [
      // --- HEADER ---
      f('Case #',                         T,  1,  { required: true }),
      f('Fraud Type',                     DD, 2,  { hasLookup: true }),
      f('Category',                       DD, 3,  { hasLookup: true }),
      f('Dollar Loss Amount',             T,  4),

      // --- SUBJECT IDENTIFICATION ---
      f('First Name',                     T,  5,  { required: true }),
      f('Middle Name',                    T,  6),
      f('Last Name',                      T,  7,  { required: true }),
      f('Suffix',                         T,  8),
      f('AKA(s)',                         T,  9),
      f('Date of Birth',                  D,  10, { sensitive: true, required: true, displayFormat: 'MM/DD/YYYY' }),
      f('Social Security Number',         T,  11, { sensitive: true, displayFormat: 'XXX-XX-####' }),
      f("State Driver's License",         T,  12),
      f('DL Issuing State',               T,  13),
      f('Account Number',                 T,  14, { sensitive: true }),
      f('FBI SID Number',                 T,  15),
      f('Other ID #',                     T,  16),

      // --- DEMOGRAPHICS ---
      f('Gender',                         DD, 17, { hasLookup: true }),
      f('Race',                           DD, 18, { hasLookup: true }),
      f('Place of Birth (City)',          T,  19),
      f('Place of Birth (State)',         T,  20),
      f('Place of Birth (Country)',       T,  21),
      f('Height',                         T,  22),
      f('Weight',                         T,  23),
      f('Eye Color',                      DD, 24, { hasLookup: true }),
      f('Hair Color',                     DD, 25, { hasLookup: true }),
      f('Tattoos / Marks',               DD, 26, { hasLookup: true }),
      f('Special Notes',                  T,  27),

      // --- CONTACT & DIGITAL IDENTIFIERS ---
      f('Address',                        TA, 28),
      f('Phone Number',                   PH, 29),
      f('IP Address',                     T,  30),
      f('Device Type',                    DD, 31, { hasLookup: true }),
      f('Device Type Other',              T,  32),
      f('Social Media Platform',          T,  33),
      f('Social Media Handle',            T,  34),
      f('Social Media URL',               UR, 35),

      // --- CRIMINAL HISTORY ---
      f('Criminal History',               TA, 36, { sensitive: true }),

      // --- OTHER SUBJECT NOTES ---
      f('Other Subject Notes',            TA, 37),

      // --- INVESTIGATIVE NOTES ---
      f('Investigative/Intel Notes',      TA, 38, { sensitive: true }),

      // --- MINIMUM COLLECTION CHECKLIST ---
      f('Account Statements',             RB, 39, { hasLookup: true }),
      f('FinCEN / SAR',                   RB, 40, { hasLookup: true }),
      f('Master OBI / TRAP Data',         RB, 41, { hasLookup: true }),
      f('Address Information',            RB, 42, { hasLookup: true }),
      f('Phone Numbers / Emails',         RB, 43, { hasLookup: true }),
      f('Phone Calls',                    RB, 44, { hasLookup: true }),
      f('Branch Video / Photographs',     RB, 45, { hasLookup: true }),
      f('Wire / ACH Activity',            RB, 46, { hasLookup: true }),
      f('Deposit Activity',               RB, 47, { hasLookup: true }),
      f('Withdrawal Activity',            RB, 48, { hasLookup: true }),
      f('Crypto Activity',                RB, 49, { hasLookup: true }),
      f('Securities Activity',            RB, 50, { hasLookup: true }),
      f('Debit Card / SMS Alerts',        RB, 51, { hasLookup: true }),
      f('AUTHLOGS / IP Data',             RB, 52, { hasLookup: true }),
      f('DOC V x2',                       RB, 53, { hasLookup: true }),
      f('Account Holder Interviewed',     RB, 54, { hasLookup: true }),
      f('Social Media (Checklist)',       RB, 55, { hasLookup: true }),
      f('Additional Contact Info',        RB, 56, { hasLookup: true }),
      f('Standing Instructions',          RB, 57, { hasLookup: true }),

      // --- SOURCES: SUBJECT IDENTIFICATION ---
      f('Flashpoint',                     RB, 58, { hasLookup: true }),
      f('Photo',                          RB, 59, { hasLookup: true }),
      f('Vehicle - Plate Number',         T,  60),
      f('Vehicle - State',                T,  61),
      f('Vehicle - Description',          T,  62),

      // --- PROPERTY DATA SOURCES ---
      f('Map Overlay',                    RB, 63, { hasLookup: true }),
      f('Street View',                    RB, 64, { hasLookup: true }),
      f('City / Town Tax Card',           RB, 65, { hasLookup: true }),

      // --- BACKGROUND DATABASES ---
      f('CLEAR / Lexis Nexis',            RB, 66, { hasLookup: true }),

      // --- OSINT / SOCMINT ---
      f('Social Media / CTI',             TA, 67),
      f('OSINT Notes',                    TA, 68),
      f('Restriction Codes',              RB, 69, { hasLookup: true }),
      f('Restriction Code Value',         T,  70),
      f('Asset Recovery',                 RB, 71, { hasLookup: true }),

      // --- ADDITIONAL DATA ---
      f('Additional Data Notes',          TA, 72),

      // --- HEADER ASSIGNMENT ---
      f('Analyst',                        DD, 73, { hasLookup: true }),
      f('Investigator',                   DD, 74, { hasLookup: true }),

      // --- PHOTO ---
      f('Subject Photo Image',            T,  75),
    ];

    // ── Insert form with forced ID via IDENTITY_INSERT ──────────────
    // Skip if the form record already exists (e.g. production — only fields are missing).
    if (!formAlreadyExists) {
      console.log(`Inserting form with IDENTITY_INSERT (FORM_ID=${TARGET_FORM_ID})...`);
      try {
        await prisma.$executeRaw`SET IDENTITY_INSERT GUARDIAN.FORMS ON`;
        await prisma.$executeRaw`
          INSERT INTO GUARDIAN.FORMS (
            FORM_ID, FORM_NAME, FORM_DESCRIPTION, ORGANIZATION_ID, COMPANY_ID,
            IS_PUBLIC, IS_ACTIVE, IS_DELETED, CREATE_USER_ID, UPDATE_USER_ID,
            CREATE_DATE, UPDATE_DATE
          )
          VALUES (
            ${TARGET_FORM_ID},
            'Fidelity-Subject',
            'Comprehensive subject workup template for authorized investigators and analysts (PII/SPII controlled)',
            ${null}, ${null},
            ${true}, ${true}, ${false},
            ${userId}, ${userId},
            GETDATE(), GETDATE()
          )
        `;
      } finally {
        await prisma.$executeRaw`SET IDENTITY_INSERT GUARDIAN.FORMS OFF`;
      }
    } else {
      console.log(`Form record already exists — skipping INSERT, seeding fields only.`);
    }

    const formId = TARGET_FORM_ID;
    console.log(`✅ Created form 'Fidelity-Subject' with ID: ${formId}`);

    // ── Insert each field and link to form ───────────────────────────
    for (const field of fields) {
      try {
        const fieldResults = await prisma.$queryRaw<any[]>`
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

        const fieldId = Array.isArray(fieldResults) && fieldResults.length > 0
          ? (fieldResults[0] as any).FIELD_ID
          : null;

        if (!fieldId) throw new Error(`Failed to create field '${field.FIELD_NAME}'`);

        console.log(`  ✅ Field [${field.SORT_ORDER}/${fields.length}] '${field.FIELD_NAME}' → FIELD_ID: ${fieldId}`);

        await prisma.$executeRaw`
          INSERT INTO GUARDIAN.FORMS_FIELDS (
            FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
            CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
          )
          VALUES (
            ${formId}, ${fieldId}, ${field.IS_REQUIRED}, ${field.SORT_ORDER},
            ${userId}, ${userId}, GETDATE(), GETDATE()
          )
        `;
      } catch (fieldErr) {
        console.error(`  ❌ Error creating field '${field.FIELD_NAME}':`, fieldErr);
      }
    }

    console.log(`\n🎉 Fidelity-Subject template seeded successfully with ${fields.length} fields (FORM_ID=${formId}).`);
  } catch (error) {
    console.error('Error adding Fidelity-Subject template:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addFidelitySubjectTemplate()
  .then(() => console.log('Script completed.'))
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });
