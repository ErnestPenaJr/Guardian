import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_FORM_ID = 1091;

async function addMissingFields() {
  try {
    console.log('Adding missing fields to Fidelity-Subject form (FORM_ID=1091)...');

    // Get field types
    const fieldTypes = await prisma.$queryRaw<any[]>`
      SELECT FIELD_TYPE_ID, FIELD_TYPE_DESC FROM GUARDIAN.FIELD_TYPE ORDER BY SORT_ORDER
    `;

    const T  = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Text Input')?.FIELD_TYPE_ID;
    const DD = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Dropdown')?.FIELD_TYPE_ID;
    const RB = fieldTypes.find((ft: any) => ft.FIELD_TYPE_DESC === 'Radio Button')?.FIELD_TYPE_ID;

    if (!T || !DD || !RB) throw new Error('Missing required field types');

    const userId = 1000;

    // Check which fields already exist for this form
    const existingFields = await prisma.$queryRaw<any[]>`
      SELECT f.FIELD_NAME
      FROM GUARDIAN.FIELDS f
      JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
      WHERE ff.FORM_ID = ${TARGET_FORM_ID}
    `;
    const existingNames = new Set(existingFields.map((f: any) => f.FIELD_NAME));

    const missingFields = [
      { name: 'Fraud Type',              typeId: DD, sort: 2,  hasLookup: true },
      { name: 'Category',                typeId: DD, sort: 3,  hasLookup: true },
      { name: 'Dollar Loss Amount',      typeId: T,  sort: 4,  hasLookup: false },
      { name: 'Device Type',             typeId: DD, sort: 31, hasLookup: true },
      { name: 'Device Type Other',       typeId: T,  sort: 32, hasLookup: false },
      { name: 'Standing Instructions',   typeId: RB, sort: 57, hasLookup: true },
      { name: 'Restriction Codes',       typeId: RB, sort: 69, hasLookup: true },
      { name: 'Restriction Code Value',  typeId: T,  sort: 70, hasLookup: false },
      { name: 'Asset Recovery',          typeId: RB, sort: 71, hasLookup: true },
    ];

    let added = 0;
    for (const field of missingFields) {
      if (existingNames.has(field.name)) {
        console.log(`  ⏭️  '${field.name}' already exists — skipping.`);
        continue;
      }

      const fieldResults = await prisma.$queryRaw<any[]>`
        INSERT INTO GUARDIAN.FIELDS (
          FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP, IS_PUBLIC, IS_ACTIVE,
          IS_DELETED, IS_REQUIRED, IS_SENSITIVE, CAN_SELECT_MULIPLE, ORGANIZATION_ID,
          CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
        )
        OUTPUT INSERTED.FIELD_ID
        VALUES (
          ${field.name}, ${field.typeId}, ${null},
          ${field.hasLookup}, ${true}, ${true}, ${false},
          ${false}, ${false}, ${false},
          ${null}, ${userId}, ${userId},
          GETDATE(), GETDATE()
        )
      `;

      const fieldId = fieldResults?.[0]?.FIELD_ID;
      if (!fieldId) throw new Error(`Failed to create field '${field.name}'`);

      await prisma.$executeRaw`
        INSERT INTO GUARDIAN.FORMS_FIELDS (
          FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
          CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
        )
        VALUES (
          ${TARGET_FORM_ID}, ${fieldId}, ${false}, ${field.sort},
          ${userId}, ${userId}, GETDATE(), GETDATE()
        )
      `;

      console.log(`  ✅ Added '${field.name}' → FIELD_ID: ${fieldId}`);
      added++;
    }

    console.log(`\n🎉 Done. Added ${added} new fields to form ${TARGET_FORM_ID}.`);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addMissingFields()
  .then(() => console.log('Script completed.'))
  .catch((e) => { console.error('Script failed:', e); process.exit(1); });
