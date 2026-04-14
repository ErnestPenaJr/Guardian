/**
 * One-shot migration runner. Reads a .sql file, splits it into IF NOT EXISTS
 * batches (T-SQL doesn't allow nested CREATE TABLE / CREATE INDEX inside
 * the same Prisma raw call without batch separators), and executes each
 * via $executeRawUnsafe. Idempotent if the migration is.
 *
 * Usage: bun scripts/run-migration.cjs prisma/migrations/<file>.sql
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: bun scripts/run-migration.cjs <path-to-sql>');
    process.exit(1);
  }
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(fullPath, 'utf8');

  // Split on "END;" terminating an IF NOT EXISTS block, keeping the END;
  // attached to its block. Anything outside such a block is sent as a single
  // trailing batch.
  const parts = sql.split(/(END;\s*\n)/g);
  const blocks = [];
  let current = '';
  for (const p of parts) {
    current += p;
    if (/END;\s*\n/.test(p)) {
      blocks.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) blocks.push(current.trim());

  const batches = blocks.filter((b) => b.length > 0);
  console.log(`Running ${batches.length} batches from ${path.basename(fullPath)}`);

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('✅ Connected');
  try {
    for (let i = 0; i < batches.length; i++) {
      const head = batches[i].split('\n').slice(0, 2).join(' | ').slice(0, 100);
      console.log(`  [${i + 1}/${batches.length}] ${head}…`);
      await prisma.$executeRawUnsafe(batches[i]);
    }
    console.log('✅ Migration complete');
  } finally {
    await prisma.$disconnect();
  }
})().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
