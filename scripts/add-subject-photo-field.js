/**
 * One-time script: adds 'Subject Photo Image' field to the Fidelity-Subject form
 * and widens FORMS_INSTANCE_VALUES.VALUE to NVARCHAR(MAX).
 * Safe to run multiple times (idempotent).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // ── 1. Widen VALUE column ──────────────────────────────────────
    await prisma.$executeRaw`
        IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'GUARDIAN'
              AND TABLE_NAME   = 'FORMS_INSTANCE_VALUES'
              AND COLUMN_NAME  = 'VALUE'
              AND CHARACTER_MAXIMUM_LENGTH <> -1
        )
        BEGIN
            ALTER TABLE GUARDIAN.FORMS_INSTANCE_VALUES
                ALTER COLUMN VALUE NVARCHAR(MAX) NOT NULL;
        END
    `;
    console.log('✅ VALUE column is NVARCHAR(MAX)');

    // ── 2. Locate the Fidelity-Subject form ───────────────────────
    const forms = await prisma.$queryRaw`
        SELECT FORM_ID FROM GUARDIAN.FORMS
        WHERE FORM_NAME = 'Fidelity-Subject' AND IS_DELETED = 0
    `;
    if (!forms.length) { console.error('❌ Fidelity-Subject form not found'); return; }
    const formId = forms[0].FORM_ID;
    console.log(`✅ Found Fidelity-Subject form: FORM_ID = ${formId}`);

    // ── 3. Ensure Subject Photo Image field exists ─────────────────
    const existing = await prisma.$queryRaw`
        SELECT FIELD_ID FROM GUARDIAN.FIELDS
        WHERE FIELD_NAME = 'Subject Photo Image' AND IS_DELETED = 0
    `;

    let fieldId;
    if (existing.length > 0) {
        fieldId = existing[0].FIELD_ID;
        console.log(`ℹ️  Field already exists: FIELD_ID = ${fieldId}`);
    } else {
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.FIELDS (
                FIELD_NAME, FIELD_TYPE_ID, HAS_LOOKUP,
                IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_REQUIRED,
                IS_SENSITIVE, CAN_SELECT_MULIPLE, ORGANIZATION_ID,
                CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
            )
            OUTPUT INSERTED.FIELD_ID
            VALUES (
                'Subject Photo Image', 1, 0, 1, 1, 0, 0, 1, 0, NULL,
                1036, 1036, GETDATE(), GETDATE()
            )
        `;
        fieldId = result[0].FIELD_ID;
        console.log(`✅ Created 'Subject Photo Image' field: FIELD_ID = ${fieldId}`);
    }

    // ── 4. Link field to form ──────────────────────────────────────
    const linked = await prisma.$queryRaw`
        SELECT 1 AS FOUND FROM GUARDIAN.FORMS_FIELDS
        WHERE FORM_ID = ${formId} AND FIELD_ID = ${fieldId}
    `;
    if (linked.length > 0) {
        console.log('ℹ️  Field already linked to form');
    } else {
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, SORT_ORDER, CREATE_DATE, UPDATE_DATE)
            VALUES (${formId}, ${fieldId}, 66, GETDATE(), GETDATE())
        `;
        console.log(`✅ Linked 'Subject Photo Image' (FIELD_ID=${fieldId}) to form ${formId}`);
    }

    console.log('\n🎉 Done — Subject Photo Image field is ready and VALUE column is NVARCHAR(MAX).');
}

main()
    .catch(e => { console.error('❌ Script failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
