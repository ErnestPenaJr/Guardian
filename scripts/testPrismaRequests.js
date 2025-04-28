// Minimal Prisma test script for /api/requests query
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const requests = await prisma.rEQUESTS.findMany({
      select: {
        TRACKINGID: true,
        REQUEST_NAME: true,
        EXTERNAL_USER: true,
        SUBMITTED_DATE: true,
        STATUS: true,
        CREATE_DATE: true,
        UPDATE_DATE: true,
        CREATE_USER_ID: true,
        UPDATE_USER_ID: true,
        requestor: { select: { FIRST_NAME: true, LAST_NAME: true } },
        assigned: { select: { FIRST_NAME: true, LAST_NAME: true } },
      }
    });
    console.log('Sample requests:', requests);
  } catch (error) {
    console.error('Prisma query error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
