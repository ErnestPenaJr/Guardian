import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting migration: Add COMPANY_ID to MY_NOTICES tables...\n');

  try {
    // 1. Add COMPANY_ID to MY_NOTICES
    console.log('1️⃣  Adding COMPANY_ID to MY_NOTICES...');
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'MY_NOTICES' AND COLUMN_NAME = 'COMPANY_ID'
      )
      BEGIN
        ALTER TABLE GUARDIAN.MY_NOTICES ADD COMPANY_ID INT NULL;
      END
    `);
    console.log('   ✅ Column added (or already exists)');

    // Backfill MY_NOTICES
    console.log('   🔄 Backfilling COMPANY_ID from CREATE_USER_ID...');
    const backfilled1 = await prisma.$executeRawUnsafe(`
      UPDATE n
      SET n.COMPANY_ID = u.COMPANY_ID
      FROM GUARDIAN.MY_NOTICES n
      INNER JOIN GUARDIAN.USERS u ON n.CREATE_USER_ID = u.USER_ID
      WHERE n.COMPANY_ID IS NULL
    `);
    console.log(`   ✅ Backfilled ${backfilled1} rows`);

    // FK + Index on MY_NOTICES
    console.log('   🔄 Adding FK and index...');
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MY_NOTICES_COMPANY')
      BEGIN
        ALTER TABLE GUARDIAN.MY_NOTICES ADD CONSTRAINT FK_MY_NOTICES_COMPANY
          FOREIGN KEY (COMPANY_ID) REFERENCES GUARDIAN.COMPANY(COMPANY_ID);
      END
    `);
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MY_NOTICES_COMPANY_ID')
      BEGIN
        CREATE INDEX IX_MY_NOTICES_COMPANY_ID ON GUARDIAN.MY_NOTICES(COMPANY_ID);
      END
    `);
    console.log('   ✅ FK and index created\n');

    // 2. Add COMPANY_ID to NOTICE_RECIPIENTS
    console.log('2️⃣  Adding COMPANY_ID to NOTICE_RECIPIENTS...');
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'NOTICE_RECIPIENTS' AND COLUMN_NAME = 'COMPANY_ID'
      )
      BEGIN
        ALTER TABLE GUARDIAN.NOTICE_RECIPIENTS ADD COMPANY_ID INT NULL;
      END
    `);
    console.log('   ✅ Column added (or already exists)');

    // Backfill NOTICE_RECIPIENTS
    console.log('   🔄 Backfilling from parent notice...');
    const backfilled2 = await prisma.$executeRawUnsafe(`
      UPDATE nr
      SET nr.COMPANY_ID = n.COMPANY_ID
      FROM GUARDIAN.NOTICE_RECIPIENTS nr
      INNER JOIN GUARDIAN.MY_NOTICES n ON nr.NOTICE_ID = n.NOTICE_ID
      WHERE nr.COMPANY_ID IS NULL
    `);
    console.log(`   ✅ Backfilled ${backfilled2} rows`);

    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_NOTICE_RECIPIENTS_COMPANY')
      BEGIN
        ALTER TABLE GUARDIAN.NOTICE_RECIPIENTS ADD CONSTRAINT FK_NOTICE_RECIPIENTS_COMPANY
          FOREIGN KEY (COMPANY_ID) REFERENCES GUARDIAN.COMPANY(COMPANY_ID);
      END
    `);
    console.log('   ✅ FK created\n');

    // 3. Add COMPANY_ID to RESPONSE_MY_NOTICE
    console.log('3️⃣  Adding COMPANY_ID to RESPONSE_MY_NOTICE...');
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'RESPONSE_MY_NOTICE' AND COLUMN_NAME = 'COMPANY_ID'
      )
      BEGIN
        ALTER TABLE GUARDIAN.RESPONSE_MY_NOTICE ADD COMPANY_ID INT NULL;
      END
    `);
    console.log('   ✅ Column added (or already exists)');

    // Backfill RESPONSE_MY_NOTICE
    console.log('   🔄 Backfilling from parent notice...');
    const backfilled3 = await prisma.$executeRawUnsafe(`
      UPDATE r
      SET r.COMPANY_ID = n.COMPANY_ID
      FROM GUARDIAN.RESPONSE_MY_NOTICE r
      INNER JOIN GUARDIAN.MY_NOTICES n ON r.MY_NOTICE_ID = n.NOTICE_ID
      WHERE r.COMPANY_ID IS NULL
    `);
    console.log(`   ✅ Backfilled ${backfilled3} rows`);

    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RESPONSE_MY_NOTICE_COMPANY')
      BEGIN
        ALTER TABLE GUARDIAN.RESPONSE_MY_NOTICE ADD CONSTRAINT FK_RESPONSE_MY_NOTICE_COMPANY
          FOREIGN KEY (COMPANY_ID) REFERENCES GUARDIAN.COMPANY(COMPANY_ID);
      END
    `);
    console.log('   ✅ FK created\n');

    // Verify
    console.log('🔍 Verifying...');
    const nullCheck: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*) FROM GUARDIAN.MY_NOTICES WHERE COMPANY_ID IS NULL) AS notices_null,
        (SELECT COUNT(*) FROM GUARDIAN.MY_NOTICES) AS notices_total,
        (SELECT COUNT(*) FROM GUARDIAN.NOTICE_RECIPIENTS WHERE COMPANY_ID IS NULL) AS recipients_null,
        (SELECT COUNT(*) FROM GUARDIAN.NOTICE_RECIPIENTS) AS recipients_total,
        (SELECT COUNT(*) FROM GUARDIAN.RESPONSE_MY_NOTICE WHERE COMPANY_ID IS NULL) AS responses_null,
        (SELECT COUNT(*) FROM GUARDIAN.RESPONSE_MY_NOTICE) AS responses_total
    `);
    const r = nullCheck[0];
    console.log(`   MY_NOTICES:          ${r.notices_total} total, ${r.notices_null} with NULL COMPANY_ID`);
    console.log(`   NOTICE_RECIPIENTS:   ${r.recipients_total} total, ${r.recipients_null} with NULL COMPANY_ID`);
    console.log(`   RESPONSE_MY_NOTICE:  ${r.responses_total} total, ${r.responses_null} with NULL COMPANY_ID`);

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
