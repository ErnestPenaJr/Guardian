import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  console.log('Testing request creation...');
  const result = await prisma.$queryRaw`
    INSERT INTO GUARDIAN.REQUESTS (REQUEST_NAME, STATUS, CREATE_DATE, COMPANY_ID, REQUESTOR_ID)
    VALUES ('TEST', 'P', GETDATE(), 1, 1);
    SELECT SCOPE_IDENTITY() as id;
  `;
  console.log('Insert result:', result);
  const check = await prisma.$queryRaw`
    SELECT TOP 1 REQUEST_ID, REQUEST_NAME, STATUS FROM GUARDIAN.REQUESTS 
    ORDER BY REQUEST_ID DESC
  `;
  console.log('Actual status:', check[0]);
  await prisma.$disconnect();
}
test();
