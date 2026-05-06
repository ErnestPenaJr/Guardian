// Read-only: counts forms by TEMPLATE_TYPE across the whole table, then lists
// every row so we can spot what's leaking into the request templates list.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.$queryRawUnsafe(`
    SELECT
      ISNULL(TEMPLATE_TYPE, '<NULL>') AS TEMPLATE_TYPE,
      IS_DELETED,
      COUNT(*) AS n
    FROM GUARDIAN.FORMS
    GROUP BY TEMPLATE_TYPE, IS_DELETED
    ORDER BY TEMPLATE_TYPE
  `);
  console.log('Counts by TEMPLATE_TYPE / IS_DELETED:');
  for (const c of counts) {
    console.log(`  ${c.TEMPLATE_TYPE.padEnd(10)} deleted=${c.IS_DELETED} → ${c.n}`);
  }

  console.log('\nAll non-deleted forms:');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT FORM_ID, FORM_NAME, COMPANY_ID, ORGANIZATION_ID,
           TEMPLATE_TYPE, STATUS, IS_ACTIVE, CREATE_DATE
    FROM GUARDIAN.FORMS
    WHERE IS_DELETED = 0
    ORDER BY COMPANY_ID, CREATE_DATE
  `);
  for (const r of rows) {
    console.log(
      `  [#${r.FORM_ID}] company=${r.COMPANY_ID} org=${r.ORGANIZATION_ID} ` +
      `type=${JSON.stringify(r.TEMPLATE_TYPE)} status=${r.STATUS} active=${r.IS_ACTIVE}  "${r.FORM_NAME}"`
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
