// server/routes/platform-admin.ts
//
// JAFAR platform admin endpoints for US-CCL-05 (compliance disclaimer text,
// field lock list, and permitted subpoena file types). All routes are
// guarded by requireAuth + requireJafar, and every mutation writes an audit
// row (COMPANY_ID = null, EVENT_TYPE starts with `JAFAR_`).
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { requireJafar } from '../middleware/requireJafar.js';
import {
  getDisclaimerText,
  getLockedFields,
  getPermittedSubpoenaFileTypes,
  setJafarConfig,
} from '../lib/jafarConfig.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireJafar);

const getUserId = (req: any): number => {
  return Number(req.user?.id ?? req.user?.userId ?? req.user?.USER_ID);
};

router.put('/disclaimer', async (req, res) => {
  try {
    const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
    const prev = await getDisclaimerText();
    const userId = getUserId(req);
    await setJafarConfig('COMPLIANCE_DISCLAIMER_TEXT', text, userId);
    await writeAudit({
      eventType: 'JAFAR_DISCLAIMER_UPDATED',
      actorUserId: userId,
      actorRoleId: 6,
      targetType: 'PLATFORM',
      targetId: 'COMPLIANCE_DISCLAIMER_TEXT',
      companyId: null,
      detail: { prevText: prev, newText: text, tenantScope: 'ALL' },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('[PLATFORM ADMIN] disclaimer update failed:', err);
    res.status(500).json({ error: 'Failed to update disclaimer' });
  }
});

router.put('/fields/:name/lock', async (req, res) => {
  try {
    const { name } = req.params;
    const { locked } = z.object({ locked: z.boolean() }).parse(req.body);
    const current = await getLockedFields();
    const next = locked
      ? Array.from(new Set([...current, name]))
      : current.filter((f) => f !== name);
    const userId = getUserId(req);
    await setJafarConfig('LOCKED_FIELDS', JSON.stringify(next), userId);
    await writeAudit({
      eventType: 'JAFAR_FIELD_LOCKED',
      actorUserId: userId,
      actorRoleId: 6,
      targetType: 'PLATFORM',
      targetId: `LOCKED_FIELDS:${name}`,
      companyId: null,
      detail: { fieldName: name, locked, tenantScope: 'ALL' },
    });
    res.json({ ok: true, lockedFields: next });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('[PLATFORM ADMIN] field lock toggle failed:', err);
    res.status(500).json({ error: 'Failed to toggle field lock' });
  }
});

router.put('/file-types', async (req, res) => {
  try {
    const { types } = z.object({ types: z.array(z.string().min(1)) }).parse(req.body);
    const prev = await getPermittedSubpoenaFileTypes();
    const userId = getUserId(req);
    await setJafarConfig('PERMITTED_SUBPOENA_FILE_TYPES', JSON.stringify(types), userId);
    await writeAudit({
      eventType: 'JAFAR_FILE_TYPES_UPDATED',
      actorUserId: userId,
      actorRoleId: 6,
      targetType: 'PLATFORM',
      targetId: 'PERMITTED_SUBPOENA_FILE_TYPES',
      companyId: null,
      detail: { prev, next: types, tenantScope: 'ALL' },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    console.error('[PLATFORM ADMIN] file types update failed:', err);
    res.status(500).json({ error: 'Failed to update permitted file types' });
  }
});

router.get('/audit', async (_req, res) => {
  try {
    const rows = await prisma.aUDIT_LOG.findMany({
      where: { COMPANY_ID: null, EVENT_TYPE: { startsWith: 'JAFAR_' } },
      orderBy: { CREATED_AT: 'desc' },
      take: 500,
    });
    // BigInt ENTRY_ID values must be serialized to string for JSON.
    const entries = rows.map((r) => ({
      ...r,
      ENTRY_ID: typeof r.ENTRY_ID === 'bigint' ? r.ENTRY_ID.toString() : r.ENTRY_ID,
    }));
    res.json({ entries });
  } catch (err) {
    console.error('[PLATFORM ADMIN] audit fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch platform audit log' });
  }
});

export default router;
