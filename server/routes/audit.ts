// server/routes/audit.ts
//
// Phase 8 / US-CCL-04 — Audit log API.
//
// GET    /api/audit              — filterable list (role-gated).
//   Admin (role 1 or 6)  → sees the full company audit log.
//   Manager (role 4)     → sees same-company log (MVP scope; spec calls
//                          out proper "team scope" as a follow-up since
//                          team membership isn't formally modeled yet).
//   Others               → 403.
//
// GET    /api/audit/export?format=csv|pdf
//                               — gated by audit.export permission key
//                                 (roles 1, 6). Streams CSV via json2csv or
//                                 a PDF via pdfkit.
//
// AUDIT_LOG.ENTRY_ID is BigInt — Express JSON serialization chokes on BigInt,
// so we always coerce ENTRY_ID to a string in API responses (same pattern
// used by server/routes/platform-admin.ts).
import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import { requireAuth } from '../auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
const prisma = new PrismaClient();

const FilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  eventType: z.string().optional(),
  actorRoleId: z.coerce.number().optional(),
  actorUserId: z.coerce.number().optional(),
  targetId: z.string().optional(),
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(50),
});

/** Coerce a single Prisma audit row into a JSON-safe shape (BigInt → string). */
function serializeAuditRow(row: {
  ENTRY_ID: bigint | number;
  EVENT_TYPE: string;
  ACTOR_USER_ID: number | null;
  ACTOR_ROLE_ID: number | null;
  TARGET_TYPE: string;
  TARGET_ID: string | null;
  EVENT_DETAIL: string | null;
  COMPANY_ID: number | null;
  FIRST_TIME_FLAG: boolean | null;
  DISCLAIMER_STATE: boolean | null;
  CREATED_AT: Date;
}) {
  return {
    ENTRY_ID: typeof row.ENTRY_ID === 'bigint' ? row.ENTRY_ID.toString() : row.ENTRY_ID,
    EVENT_TYPE: row.EVENT_TYPE,
    ACTOR_USER_ID: row.ACTOR_USER_ID,
    ACTOR_ROLE_ID: row.ACTOR_ROLE_ID,
    TARGET_TYPE: row.TARGET_TYPE,
    TARGET_ID: row.TARGET_ID,
    EVENT_DETAIL: row.EVENT_DETAIL,
    COMPANY_ID: row.COMPANY_ID,
    FIRST_TIME_FLAG: row.FIRST_TIME_FLAG,
    DISCLAIMER_STATE: row.DISCLAIMER_STATE,
    CREATED_AT: row.CREATED_AT.toISOString(),
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const f = FilterSchema.parse(req.query);
    const u = req.user as { id?: number; userId?: number; COMPANY_ID?: number | null } | undefined;
    const userId = Number(u?.id ?? u?.userId);
    const companyId = u?.COMPANY_ID ?? null;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userRoles = await prisma.uSER_ROLES.findMany({
      where: { USER_ID: userId, STATUS: 'P' },
      select: { ROLE_ID: true },
    });
    const isAdmin = userRoles.some((r) => r.ROLE_ID === 1 || r.ROLE_ID === 6);
    const isManager = userRoles.some((r) => r.ROLE_ID === 4);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to view the audit log.' });
    }

    // Manager MVP simplification — same-company scope. The spec calls for
    // proper "team" filtering but team membership isn't modeled yet. Tracked
    // as a follow-up; for now Manager === company-wide read like Admin.
    const where: {
      COMPANY_ID: number | null;
      CREATED_AT?: { gte?: Date; lte?: Date };
      EVENT_TYPE?: string;
      ACTOR_ROLE_ID?: number;
      ACTOR_USER_ID?: number;
      TARGET_ID?: string;
    } = { COMPANY_ID: companyId };
    if (f.from) where.CREATED_AT = { ...(where.CREATED_AT ?? {}), gte: new Date(f.from) };
    if (f.to) where.CREATED_AT = { ...(where.CREATED_AT ?? {}), lte: new Date(f.to) };
    if (f.eventType) where.EVENT_TYPE = f.eventType;
    if (f.actorRoleId) where.ACTOR_ROLE_ID = f.actorRoleId;
    if (f.actorUserId) where.ACTOR_USER_ID = f.actorUserId;
    if (f.targetId) where.TARGET_ID = f.targetId;

    const [rows, total] = await Promise.all([
      prisma.aUDIT_LOG.findMany({
        where,
        orderBy: { CREATED_AT: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      prisma.aUDIT_LOG.count({ where }),
    ]);

    res.json({
      rows: rows.map(serializeAuditRow),
      total,
      page: f.page,
      pageSize: f.pageSize,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid filter', details: err.errors });
    }
    console.error('[AUDIT LOG] list failed:', err);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

router.get(
  '/export',
  requireAuth,
  requireRole('audit.export', 'export the audit log'),
  async (req, res) => {
    try {
      const format = String(req.query.format ?? 'csv').toLowerCase();
      const u = req.user as { id?: number; userId?: number; COMPANY_ID?: number | null } | undefined;
      const companyId = u?.COMPANY_ID ?? null;

      const rows = await prisma.aUDIT_LOG.findMany({
        where: { COMPANY_ID: companyId },
        orderBy: { CREATED_AT: 'desc' },
      });
      const serialized = rows.map(serializeAuditRow);

      if (format === 'csv') {
        const fields = [
          'ENTRY_ID',
          'EVENT_TYPE',
          'ACTOR_USER_ID',
          'ACTOR_ROLE_ID',
          'TARGET_TYPE',
          'TARGET_ID',
          'EVENT_DETAIL',
          'COMPANY_ID',
          'FIRST_TIME_FLAG',
          'DISCLAIMER_STATE',
          'CREATED_AT',
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(
          serialized.map((r) => ({ ...r, EVENT_DETAIL: r.EVENT_DETAIL ?? '' })),
        );
        // Reset the Content-Type that the /api middleware forced to JSON.
        res.setHeader('Content-Type', 'text/csv');
        res.attachment('audit-log.csv');
        return res.send(csv);
      }

      if (format === 'pdf') {
        // pdfkit is a CommonJS module; dynamic import gives us the default export.
        const PDFDocumentMod = await import('pdfkit');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PDFDocument: any = (PDFDocumentMod as { default?: unknown }).default ?? PDFDocumentMod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc: any = new PDFDocument({ size: 'LETTER', margin: 48 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-log.pdf"');
        doc.pipe(res);
        doc.fontSize(16).text('Audit Log', { underline: true });
        doc.moveDown(0.5).fontSize(9).text(`Generated: ${new Date().toISOString()}`);
        doc.moveDown(0.5).text(`Company ID: ${companyId ?? '—'}    Rows: ${serialized.length}`);
        doc.moveDown(0.8);
        serialized.forEach((r) => {
          doc
            .fontSize(9)
            .text(
              `${r.CREATED_AT}  ${r.EVENT_TYPE}  actor=${r.ACTOR_USER_ID ?? '—'} (role ${r.ACTOR_ROLE_ID ?? '—'})  target=${r.TARGET_TYPE}:${r.TARGET_ID ?? '—'}`,
            );
          if (r.EVENT_DETAIL) {
            doc.fontSize(8).fillColor('#555').text(r.EVENT_DETAIL, { indent: 12 });
            doc.fillColor('#000');
          }
          doc.moveDown(0.25);
        });
        doc.end();
        return;
      }

      return res.status(400).json({ error: 'format must be csv or pdf' });
    } catch (err) {
      console.error('[AUDIT LOG] export failed:', err);
      // If we already started streaming a PDF/CSV we can't send JSON.
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to export audit log' });
      } else {
        try {
          res.end();
        } catch {
          /* swallow */
        }
      }
    }
  },
);

export default router;
