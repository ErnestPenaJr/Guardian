/**
 * One-time script: adds ANALYST_ID and INVESTIGATOR_ID columns to GUARDIAN.REQUESTS.
 * Safe to run multiple times (idempotent).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Add ANALYST_ID
    await prisma.$executeRaw`
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'REQUESTS' AND COLUMN_NAME = 'ANALYST_ID'
        )
        BEGIN
            ALTER TABLE GUARDIAN.REQUESTS ADD ANALYST_ID INT NULL;
        END
    `;
    console.log('✅ ANALYST_ID column ready');

    // Add INVESTIGATOR_ID
    await prisma.$executeRaw`
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN' AND TABLE_NAME = 'REQUESTS' AND COLUMN_NAME = 'INVESTIGATOR_ID'
        )
        BEGIN
            ALTER TABLE GUARDIAN.REQUESTS ADD INVESTIGATOR_ID INT NULL;
        END
    `;
    console.log('✅ INVESTIGATOR_ID column ready');

    console.log('\n🎉 Done — REQUESTS table updated.');
}

main()
    .catch(e => { console.error('❌ Script failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
