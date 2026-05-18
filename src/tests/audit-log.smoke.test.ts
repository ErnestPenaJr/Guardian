// src/tests/audit-log.smoke.test.ts
//
// Standalone smoke test for the writeAudit helper. Inserts a row, reads it
// back, asserts, and deletes. Requires Phase 0 AUDIT_LOG migration applied
// to the target database.
//
// Usage:
//   bun src/tests/audit-log.smoke.test.ts
//
// Exits 0 on success, 1 on failure.

import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { writeAudit } from '../../server/lib/audit';

dotenvConfig();
const prisma = new PrismaClient();

async function run() {
  const entry = await writeAudit({
    eventType: 'TEMPLATE_CREATED',
    actorUserId: 999999,
    actorRoleId: 1,
    targetType: 'TEMPLATE',
    targetId: 'test-template-id',
    companyId: 54,
    detail: { test: true },
  });
  if (!entry?.ENTRY_ID) throw new Error('writeAudit did not return ENTRY_ID');

  const found = await prisma.aUDIT_LOG.findUnique({ where: { ENTRY_ID: entry.ENTRY_ID } });
  if (!found || found.EVENT_TYPE !== 'TEMPLATE_CREATED') throw new Error('audit row missing');

  await prisma.aUDIT_LOG.delete({ where: { ENTRY_ID: entry.ENTRY_ID } });
  console.log('ok');
}
run().catch((e) => { console.error(e); process.exit(1); });
