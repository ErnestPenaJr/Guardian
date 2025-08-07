const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
});

async function debugFields() {
  try {
    console.log('🔍 Connecting to database...');
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT COUNT(*) as total FROM GUARDIAN.FIELDS`;
    console.log('📊 Total fields in database:', result);

    // Get first 10 fields with all data
    console.log('\n📝 Getting first 10 fields...');
    const fields = await prisma.$queryRaw`
        SELECT TOP 10 
            f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, 
            f.HAS_LOOKUP, f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, 
            f.IS_REQUIRED, f.IS_SENSITIVE, f.CAN_SELECT_MULIPLE, 
            f.ORGANIZATION_ID, f.SORT_ORDER, f.CREATE_DATE, f.UPDATE_DATE,
            ft.FIELD_TYPE_DESC
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        ORDER BY f.FIELD_ID
    `;
    
    console.log('\n📋 Field data:', fields);
    
    // Check company filtering (assuming company ID 1 exists)
    console.log('\n🏢 Fields for company 1:');
    const companyFields = await prisma.$queryRaw`
        SELECT COUNT(*) as total 
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        WHERE (f.ORGANIZATION_ID = 1 OR f.ORGANIZATION_ID IS NULL)
    `;
    console.log('Fields for company 1:', companyFields);

    // Check different organization IDs
    console.log('\n🏢 Fields by organization:');
    const orgStats = await prisma.$queryRaw`
        SELECT 
            COALESCE(f.ORGANIZATION_ID, 0) as ORG_ID,
            COUNT(*) as FIELD_COUNT
        FROM GUARDIAN.FIELDS f
        GROUP BY f.ORGANIZATION_ID
        ORDER BY f.ORGANIZATION_ID
    `;
    console.log('Organization statistics:', orgStats);

    // Check field types
    console.log('\n🏷️ Available field types:');
    const fieldTypes = await prisma.$queryRaw`
        SELECT ft.FIELD_TYPE_ID, ft.FIELD_TYPE_DESC
        FROM GUARDIAN.FIELD_TYPE ft
        ORDER BY ft.FIELD_TYPE_ID
    `;
    console.log('Field types:', fieldTypes);

  } catch (error) {
    console.error('❌ Database error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Database connection closed');
  }
}

debugFields();