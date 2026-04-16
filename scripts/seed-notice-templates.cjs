/**
 * Seeds the three baseline notice templates into GUARDIAN.FORMS +
 * GUARDIAN.FIELDS + GUARDIAN.FORMS_FIELDS for a given company.
 *
 * Idempotent on (COMPANY_ID, FORM_NAME).
 *
 * Usage:
 *   DATABASE_URL="..." bun scripts/seed-notice-templates.cjs <companyId> [<createdByUserId>]
 *   # or
 *   node scripts/seed-notice-templates.cjs <companyId> [<createdByUserId>]
 */
const { PrismaClient } = require('@prisma/client');

const TEMPLATES = [
  {
    name: 'Intel dissemination notice',
    description: 'Standard template for distributing finished intelligence',
    fields: [
      { name: 'Subject / intel ID', type: 1, required: true },
      { name: 'Classification level', type: 1, required: true },
      { name: 'Source summary', type: 2, required: true },
      { name: 'Key findings', type: 2, required: true },
      { name: 'Handling caveats', type: 1, required: false },
    ],
  },
  {
    name: 'Threat advisory',
    description: 'Urgent template for time-sensitive threat notifications',
    fields: [
      { name: 'Threat actor / group', type: 1, required: true },
      { name: 'Threat type', type: 1, required: true },
      { name: 'Affected systems / areas', type: 1, required: true },
      { name: 'Severity', type: 1, required: true },
      { name: 'Immediate actions required', type: 2, required: true },
      { name: 'Reporting point of contact', type: 1, required: false },
    ],
  },
  {
    name: 'Situational awareness brief',
    description: 'Periodic updates for leadership stakeholders',
    fields: [
      { name: 'Reporting period', type: 1, required: true },
      { name: 'Area of focus', type: 1, required: true },
      { name: 'Current situation summary', type: 2, required: true },
      { name: 'Key developments', type: 2, required: true },
      { name: 'Outlook / forecast', type: 2, required: false },
      { name: 'Recommended leadership actions', type: 2, required: false },
    ],
  },
];

(async () => {
  const companyId = parseInt(process.argv[2], 10);
  const createdBy = parseInt(process.argv[3] || '1', 10);
  if (!companyId || Number.isNaN(companyId)) {
    console.error('Usage: bun scripts/seed-notice-templates.cjs <companyId> [<createdByUserId>]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log(`✅ Connected. Seeding ${TEMPLATES.length} templates for company ${companyId}`);

  try {
    for (const tpl of TEMPLATES) {
      const existing = await prisma.$queryRaw`
        SELECT FORM_ID FROM GUARDIAN.FORMS
        WHERE COMPANY_ID = ${companyId} AND FORM_NAME = ${tpl.name} AND IS_DELETED = 0
      `;
      if (existing.length > 0) {
        console.log(`  = Skipping "${tpl.name}" — already exists (FORM_ID ${existing[0].FORM_ID})`);
        continue;
      }

      const inserted = await prisma.$queryRaw`
        INSERT INTO GUARDIAN.FORMS (
          FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED,
          TEMPLATE_TYPE, STATUS,
          COMPANY_ID, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
        )
        OUTPUT INSERTED.FORM_ID
        VALUES (
          ${tpl.name}, ${tpl.description}, 1, 1, 0,
          'notice', 'active',
          ${companyId}, ${createdBy}, ${createdBy}, GETDATE(), GETDATE()
        )
      `;
      const formId = inserted[0].FORM_ID;
      console.log(`  + Created "${tpl.name}" (FORM_ID ${formId})`);

      let order = 1;
      for (const f of tpl.fields) {
        const newField = await prisma.$queryRaw`
          INSERT INTO GUARDIAN.FIELDS (
            FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED,
            ORGANIZATION_ID, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
          )
          OUTPUT INSERTED.FIELD_ID
          VALUES (
            ${f.name}, ${f.type}, ${f.required}, 1, 0,
            ${companyId}, ${createdBy}, ${createdBy}, GETDATE(), GETDATE()
          )
        `;
        const fieldId = newField[0].FIELD_ID;
        await prisma.$executeRaw`
          INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER, CREATE_USER_ID, CREATE_DATE)
          VALUES (${formId}, ${fieldId}, ${f.required}, ${order}, ${createdBy}, GETDATE())
        `;
        order++;
      }
      console.log(`    + Added ${tpl.fields.length} fields`);
    }
    console.log('✅ Done.');
  } finally {
    await prisma.$disconnect();
  }
})().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
