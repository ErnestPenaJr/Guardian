/**
 * One-time script: adds Analyst + Investigator fields to the Fidelity-Subject form.
 * Safe to run multiple times (idempotent).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const forms = await prisma.$queryRaw`
        SELECT FORM_ID FROM GUARDIAN.FORMS
        WHERE FORM_NAME = 'Fidelity-Subject' AND IS_DELETED = 0
    `;
    if (!forms.length) { console.error('❌ Fidelity-Subject form not found'); return; }
    const formId = forms[0].FORM_ID;
    console.log(`✅ Found Fidelity-Subject form: FORM_ID = ${formId}`);

    const fieldsToAdd = [
        { name: 'Analyst',      sortOrder: 64 },
        { name: 'Investigator', sortOrder: 65 },
    ];

    for (const { name, sortOrder } of fieldsToAdd) {
        // 1. Ensure the field record exists
        const existing = await prisma.$queryRaw`
            SELECT FIELD_ID FROM GUARDIAN.FIELDS
            WHERE FIELD_NAME = ${name} AND IS_DELETED = 0
        `;

        let fieldId;
        if (existing.length > 0) {
            fieldId = existing[0].FIELD_ID;
            console.log(`ℹ️  Field '${name}' already exists: FIELD_ID = ${fieldId}`);
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
                    ${name}, 5, 1, 1, 1, 0, 0, 0, 0, NULL,
                    1036, 1036, GETDATE(), GETDATE()
                )
            `;
            fieldId = result[0].FIELD_ID;
            console.log(`✅ Created field '${name}': FIELD_ID = ${fieldId}`);
        }

        // 2. Link field to the form if not already linked
        const linked = await prisma.$queryRaw`
            SELECT 1 as FOUND FROM GUARDIAN.FORMS_FIELDS
            WHERE FORM_ID = ${formId} AND FIELD_ID = ${fieldId}
        `;
        if (linked.length > 0) {
            console.log(`ℹ️  Field '${name}' already linked to form`);
        } else {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, SORT_ORDER, CREATE_DATE, UPDATE_DATE)
                VALUES (${formId}, ${fieldId}, ${sortOrder}, GETDATE(), GETDATE())
            `;
            console.log(`✅ Linked field '${name}' (FIELD_ID=${fieldId}) to form ${formId}`);
        }
    }

    console.log('\n🎉 Done — Analyst and Investigator fields are ready.');
}

main()
    .catch(e => { console.error('❌ Script failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
