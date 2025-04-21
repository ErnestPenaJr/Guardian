// Simple test to check Prisma-MySQL connection
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('Prisma connected to MySQL successfully!');
  } catch (e) {
    console.error('Prisma failed to connect:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
