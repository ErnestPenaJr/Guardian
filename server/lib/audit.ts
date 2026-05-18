// server/lib/audit.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Canonical list of audit event types. Kept as a runtime array (not a
 * raw type union) so the frontend can render this list in dropdowns
 * without hard-coding a parallel copy.
 */
export const AUDIT_EVENT_TYPES = [
  'TEMPLATE_CREATED',
  'TEMPLATE_MODIFIED',
  'FIELD_RESTRICTION_CHANGED',
  'DISCLAIMER_TOGGLED',
  'MANAGER_APPROVAL_CONFIG_CHANGED',
  'NOTICE_SUBMITTED_FOR_APPROVAL',
  'NOTICE_APPROVED',
  'NOTICE_REJECTED',
  'NOTICE_SENT',
  'SUBPOENA_RIDER_GENERATED',
  'SUBPOENA_RECEIVED',
  'RECORDS_RELEASED',
  'FIRST_TIME_RECIPIENT_CONFIRMED',
  'JAFAR_FIELD_LOCKED',
  'JAFAR_DISCLAIMER_UPDATED',
  'JAFAR_FILE_TYPES_UPDATED',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface WriteAuditParams {
  eventType: AuditEventType;
  actorUserId: number | null;
  actorRoleId: number | null;
  targetType: 'NOTICE' | 'TEMPLATE' | 'SUBPOENA_RIDER' | 'PLATFORM';
  targetId: string | number | null;
  companyId: number | null;
  detail?: Record<string, unknown>;
  firstTimeFlag?: boolean;
  disclaimerState?: boolean;
}

export async function writeAudit(p: WriteAuditParams) {
  return prisma.aUDIT_LOG.create({
    data: {
      EVENT_TYPE: p.eventType,
      ACTOR_USER_ID: p.actorUserId,
      ACTOR_ROLE_ID: p.actorRoleId,
      TARGET_TYPE: p.targetType,
      TARGET_ID: p.targetId == null ? null : String(p.targetId),
      EVENT_DETAIL: p.detail ? JSON.stringify(p.detail) : null,
      COMPANY_ID: p.companyId,
      FIRST_TIME_FLAG: p.firstTimeFlag ?? null,
      DISCLAIMER_STATE: p.disclaimerState ?? null,
    },
  });
}
