const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function debugFieldsExtended() {
  try {
    console.log('🔍 Looking for field 1039 and similar...');
    
    // Look for fields with higher IDs (like 1039)
    const highIdFields = await prisma.$queryRaw`
        SELECT 
            f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, 
            f.ORGANIZATION_ID, f.IS_ACTIVE, f.IS_DELETED,
            ft.FIELD_TYPE_DESC
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        WHERE f.FIELD_ID >= 1039
        ORDER BY f.FIELD_ID
    `;
    
    console.log('\n📋 High ID fields (1039+):', highIdFields);
    
    // Check if there are fields with non-null organization IDs
    const orgFields = await prisma.$queryRaw`
        SELECT 
            f.FIELD_ID, f.FIELD_NAME, f.ORGANIZATION_ID,
            ft.FIELD_TYPE_DESC
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        WHERE f.ORGANIZATION_ID IS NOT NULL
        ORDER BY f.ORGANIZATION_ID, f.FIELD_ID
    `;
    
    console.log('\n🏢 Fields with specific organization IDs:', orgFields);

    // Test the exact query used by the API
    console.log('\n🔧 Testing API query format for company 1...');
    const apiSimulation = await prisma.$queryRaw`
        SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
               f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
               f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
               ft.FIELD_TYPE_DESC
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        WHERE (f.ORGANIZATION_ID = 1 OR f.ORGANIZATION_ID IS NULL)
        ORDER BY f.SORT_ORDER, f.FIELD_NAME
    `;
    
    console.log('API simulation result count:', apiSimulation.length);
    console.log('First 3 fields from API simulation:', apiSimulation.slice(0, 3));
    console.log('Last 3 fields from API simulation:', apiSimulation.slice(-3));

    // Format the data exactly like the API does
    const formattedFields = apiSimulation.map(field => ({
        FIELD_ID: field.FIELD_ID,
        FIELD_NAME: field.FIELD_NAME,
        FIELD_TYPE_ID: field.FIELD_TYPE_ID,
        DISPLAY_FORMAT: field.DISPLAY_FORMAT,
        HAS_LOOKUP: field.HAS_LOOKUP,
        IS_PUBLIC: field.IS_PUBLIC,
        IS_ACTIVE: field.IS_ACTIVE,
        IS_DELETED: field.IS_DELETED,
        IS_REQUIRED: field.IS_REQUIRED,
        IS_SENSITIVE: field.IS_SENSITIVE,
        CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE,
        ORGANIZATION_ID: field.ORGANIZATION_ID,
        SORT_ORDER: field.SORT_ORDER,
        FIELD_TYPE: {
            FIELD_TYPE_DESC: field.FIELD_TYPE_DESC,
            FIELD_TYPE_ID: field.FIELD_TYPE_ID
        }
    }));

    console.log('\n📤 Formatted field example (like API response):', formattedFields[0]);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFieldsExtended();