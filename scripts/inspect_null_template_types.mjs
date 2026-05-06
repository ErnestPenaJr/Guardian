// One-shot inspection script. Lists every GUARDIAN.FORMS row with a NULL or
// non-canonical TEMPLATE_TYPE so we can decide which should be backfilled to
// 'request' vs 'notice' before running the UPDATE.
//
// Usage:
//   DATABASE_URL="..." bun scripts/inspect_null_template_types.mjs
//
// Read-only — does NOT modify any rows.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION,
           COMPANY_ID, ORGANIZATION_ID,
           TEMPLATE_TYPE, STATUS, IS_DELETED, IS_ACTIVE,
           CREATE_DATE
    FROM GUARDIAN.FORMS
    WHERE IS_DELETED = 0
      AND (TEMPLATE_TYPE IS NULL OR TEMPLATE_TYPE NOT IN ('notice', 'request'))
    ORDER BY COMPANY_ID, CREATE_DATE
  `);

  console.log(`Found ${rows.length} forms with NULL or non-canonical TEMPLATE_TYPE:\n`);
  for (const r of rows) {
    console.log(
      `  [#${r.FORM_ID}] company=${r.COMPANY_ID} org=${r.ORGANIZATION_ID} ` +
      `type=${JSON.stringify(r.TEMPLATE_TYPE)} status=${r.STATUS} active=${r.IS_ACTIVE} ` +
      `created=${r.CREATE_DATE?.toISOString?.() || r.CREATE_DATE}\n` +
      `      name="${r.FORM_NAME}"\n` +
      `      desc="${(r.FORM_DESCRIPTION || '').slice(0, 100)}"`
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
