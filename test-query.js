// Test script to validate the fixed custom-templates query
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "sqlserver://guardian-dev-db.database.windows.net:1433;database=GUARDIAN-DEV;user=GUARDIAN;password=Sh13ldlyt1c$;encrypt=true;trustServerCertificate=false"
    }
  }
});

async function testQuery() {
  try {
    console.log('🔍 Testing fixed custom-templates query...');
    
    // Test the query we fixed (using template ID 1056 from the error)
    const templateId = 1056;
    
    console.log(`📋 Testing query for template ID: ${templateId}`);
    
    const fields = await prisma.$queryRaw`
        SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.IS_REQUIRED,
               ff.SORT_ORDER, ft.TYPE_NAME as fieldType, f.DISPLAY_FORMAT,
               f.HAS_LOOKUP, f.IS_SENSITIVE, f.CAN_SELECT_MULIPLE
        FROM GUARDIAN.FIELDS f
        INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
        LEFT JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
        WHERE ff.FORM_ID = ${templateId}
        AND f.IS_DELETED = 0
        ORDER BY ff.SORT_ORDER, f.FIELD_ID
    `;
    
    console.log(`✅ Query executed successfully! Found ${fields.length} fields`);
    
    if (fields.length > 0) {
      console.log('📊 Sample field data:', {
        FIELD_ID: fields[0].FIELD_ID,
        FIELD_NAME: fields[0].FIELD_NAME,
        FIELD_TYPE_ID: fields[0].FIELD_TYPE_ID,
        IS_REQUIRED: fields[0].IS_REQUIRED,
        SORT_ORDER: fields[0].SORT_ORDER,
        fieldType: fields[0].fieldType,
        DISPLAY_FORMAT: fields[0].DISPLAY_FORMAT,
        HAS_LOOKUP: fields[0].HAS_LOOKUP
      });
    }
    
    console.log('🎉 Database schema fix confirmed - no more OPTIONS column error!');
    
  } catch (error) {
    console.error('❌ Query test failed:', error.message);
    if (error.message.includes('OPTIONS')) {
      console.error('🚨 OPTIONS column error still present!');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
