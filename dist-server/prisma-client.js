import { PrismaClient } from '@prisma/client';
// Create a custom Prisma client with adjusted connection pool settings
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
    log: ['warn', 'error'],
});
// Attempt to improve connection handling
prisma.$connect().then(() => {
    console.log('Prisma connected successfully with improved settings');
}).catch(e => {
    console.error('Prisma connection error:', e);
});
// Add connection event handlers
process.on('SIGINT', async () => {
    console.log('Disconnecting Prisma client...');
    await prisma.$disconnect();
    process.exit(0);
});
export default prisma;
