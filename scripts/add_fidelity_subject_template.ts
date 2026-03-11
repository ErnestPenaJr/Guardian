import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The canonical form ID that existing REQUEST records reference.
// Using SET IDENTITY_INSERT ensures production stays in sync with dev.
const TARGET_FORM_ID = 1091;

async function addFidelitySubjectTemplate() {
  try {
    console.log('Starting to add Fidelity-Subject form template...');
    console.log(`Target FORM_ID: ${TARGET_FORM_ID}`);

    // ── Guard: skip if form already exists ──────────────────────────
    const existing = await prisma.$queryRaw<any[]>`
      SELECT FORM_ID FROM GUARDIAN.FORMS
      WHERE FORM_ID = ${TARGET_FORM_ID}
    `;
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`Form ID ${TARGET_FORM_ID} (Fidelity-Subject) already exists — skipping.`);
      return;
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

      // --- SUBJECT IDENTIFICATION ---
      f('First Name',                     T,  2,  { required: true }),
      f('Middle Name',                    T,  3),
      f('Last Name',                      T,  4,  { required: true }),
      f('Suffix',                         T,  5),
      f('AKA(s)',                         T,  6),
      f('Date of Birth',                  D,  7,  { sensitive: true, required: true, displayFormat: 'MM/DD/YYYY' }),
      f('Social Security Number',         T,  8,  { sensitive: true, displayFormat: 'XXX-XX-####' }),
      f("State Driver's License",         T,  9),
      f('DL Issuing State',               T,  10),
      f('Account Number',                 T,  11, { sensitive: true }),
      f('FBI SID Number',                 T,  12),
      f('Other ID #',                     T,  13),

      // --- DEMOGRAPHICS ---
      f('Gender',                         DD, 14, { hasLookup: true }),
      f('Race',                           DD, 15, { hasLookup: true }),
      f('Place of Birth (City)',          T,  16),
      f('Place of Birth (State)',         T,  17),
      f('Place of Birth (Country)',       T,  18),
      f('Height',                         T,  19),
      f('Weight',                         T,  20),
      f('Eye Color',                      DD, 21, { hasLookup: true }),
      f('Hair Color',                     DD, 22, { hasLookup: true }),
      f('Tattoos / Marks',               DD, 23, { hasLookup: true }),
      f('Special Notes',                  T,  24),

      // --- CONTACT & DIGITAL IDENTIFIERS ---
      f('Address',                        TA, 25),
      f('Phone Number',                   PH, 26),
      f('IP Address',                     T,  27),
      f('Social Media Platform',          T,  28),
      f('Social Media Handle',            T,  29),
      f('Social Media URL',               UR, 30),

      // --- CRIMINAL HISTORY ---
      f('Criminal History',               TA, 31, { sensitive: true }),

      // --- OTHER SUBJECT NOTES ---
      f('Other Subject Notes',            TA, 32),

      // --- INVESTIGATIVE NOTES ---
      f('Investigative/Intel Notes',      TA, 33, { sensitive: true }),

      // --- MINIMUM COLLECTION CHECKLIST ---
      f('Account Statements',             RB, 34, { hasLookup: true }),
      f('FinCEN / SAR',                   RB, 35, { hasLookup: true }),
      f('Master OBI / TRAP Data',         RB, 36, { hasLookup: true }),
      f('Address Information',            RB, 37, { hasLookup: true }),
      f('Phone Numbers / Emails',         RB, 38, { hasLookup: true }),
      f('Phone Calls',                    RB, 39, { hasLookup: true }),
      f('Branch Video / Photographs',     RB, 40, { hasLookup: true }),
      f('Wire / ACH Activity',            RB, 41, { hasLookup: true }),
      f('Deposit Activity',               RB, 42, { hasLookup: true }),
      f('Withdrawal Activity',            RB, 43, { hasLookup: true }),
      f('Crypto Activity',                RB, 44, { hasLookup: true }),
      f('Securities Activity',            RB, 45, { hasLookup: true }),
      f('Debit Card / SMS Alerts',        RB, 46, { hasLookup: true }),
      f('AUTHLOGS / IP Data',             RB, 47, { hasLookup: true }),
      f('DOC V x2',                       RB, 48, { hasLookup: true }),
      f('Account Holder Interviewed',     RB, 49, { hasLookup: true }),
      f('Social Media (Checklist)',       RB, 50, { hasLookup: true }),
      f('Additional Contact Info',        RB, 51, { hasLookup: true }),

      // --- SOURCES: SUBJECT IDENTIFICATION ---
      f('Flashpoint',                     RB, 52, { hasLookup: true }),
      f('Photo',                          RB, 53, { hasLookup: true }),
      f('Vehicle - Plate Number',         T,  54),
      f('Vehicle - State',                T,  55),
      f('Vehicle - Description',          T,  56),

      // --- PROPERTY DATA SOURCES ---
      f('Map Overlay',                    RB, 57, { hasLookup: true }),
      f('Street View',                    RB, 58, { hasLookup: true }),
      f('City / Town Tax Card',           RB, 59, { hasLookup: true }),

      // --- BACKGROUND DATABASES ---
      f('CLEAR / Lexis Nexis',            RB, 60, { hasLookup: true }),

      // --- OSINT / SOCMINT ---
      f('Social Media / CTI',             TA, 61),
      f('OSINT Notes',                    TA, 62),

      // --- ADDITIONAL DATA ---
      f('Additional Data Notes',          TA, 63),
    ];

    // ── Insert form with forced ID via IDENTITY_INSERT ──────────────
    // This preserves the ID that existing REQUEST records already reference.
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
