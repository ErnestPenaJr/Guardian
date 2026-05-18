// server/lib/securitiesNoticeMail.ts
//
// Phase 5 (US-SNT-04 / US-SNT-05) — Manager notification + processor rejection
// emails for the Securities Fraud Notice workflow.
//
// Mirrors the Resend integration in server/routes/my-notices.ts. Kept local to
// avoid invasive refactors of the existing notice route while still sharing the
// same RESEND_API_KEY / EMAIL_FROM env contract used everywhere else.
//
// All helpers are best-effort: failures are caught and logged, never thrown.
// Callers should treat email send failures as non-blocking — the audit row and
// the workflow state transition are the system of record.

import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const prisma = new PrismaClient();

const RESEND_API_KEY = process.env.SMTP_PASSWORD; // matches other route files
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const resend = new Resend(RESEND_API_KEY);

// Manager role ID is 4 in the RBAC matrix (see src/utils/permissions.ts).
const MANAGER_ROLE_ID = 4;

/**
 * Notify all active managers (role ID 4) in a company that a securities notice
 * is pending their approval.
 */
export async function notifyManagersOfPending(
  companyId: number,
  noticeId: number,
  processorName: string,
): Promise<void> {
  try {
    const managerRoleRows = await prisma.uSER_ROLES.findMany({
      where: { ROLE_ID: MANAGER_ROLE_ID, STATUS: 'P' },
      select: { USER_ID: true },
    });
    const managerUserIds = managerRoleRows.map((r) => r.USER_ID);
    if (managerUserIds.length === 0) {
      console.log('[SECURITIES NOTICE MAIL] No managers to notify (no role-4 users).');
      return;
    }

    const managers = await prisma.uSERS.findMany({
      where: {
        USER_ID: { in: managerUserIds },
        COMPANY_ID: companyId,
        STATUS: 'A',
      },
      select: { EMAIL: true, FIRST_NAME: true },
    });
    const emails = managers.map((m) => m.EMAIL).filter((e): e is string => Boolean(e));
    if (emails.length === 0) {
      console.log(
        `[SECURITIES NOTICE MAIL] No active managers found for company ${companyId}.`,
      );
      return;
    }

    const noticeUrl = `${FRONTEND_URL}/securities-notices/approvals?id=${noticeId}`;
    await resend.emails.send({
      from: `Shieldlytics <${EMAIL_FROM}>`,
      to: emails,
      subject: 'A Securities Fraud Notice is pending your approval',
      text:
        `A Securities Fraud Notice submitted by ${processorName} is pending your approval.\n\n` +
        `Review and approve or return it for revision:\n${noticeUrl}\n\n` +
        `This message was generated automatically by the Guardian platform.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #1f2937;">Securities Fraud Notice — Pending Approval</h2>
          <p>A Securities Fraud Notice submitted by <strong>${escapeHtml(processorName)}</strong> is pending your approval.</p>
          <p style="margin: 24px 0;">
            <a href="${noticeUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: 600;">
              Open Approval Queue
            </a>
          </p>
          <p style="font-size: 12px; color: #6b7280;">Notice ID: ${noticeId}</p>
        </div>
      `,
    });
    console.log(
      `[SECURITIES NOTICE MAIL] notifyManagersOfPending → ${emails.length} manager(s) for notice ${noticeId}`,
    );
  } catch (err) {
    console.error('[SECURITIES NOTICE MAIL] notifyManagersOfPending failed:', err);
  }
}

/**
 * Notify the processor (submitter) that their notice was returned for revision.
 */
export async function notifyProcessorOfRejection(
  processorUserId: number,
  noticeId: number,
  reason: string,
): Promise<void> {
  try {
    const user = await prisma.uSERS.findUnique({
      where: { USER_ID: processorUserId },
      select: { EMAIL: true, FIRST_NAME: true },
    });
    if (!user?.EMAIL) {
      console.log(
        `[SECURITIES NOTICE MAIL] notifyProcessorOfRejection — no email for user ${processorUserId}.`,
      );
      return;
    }

    const noticeUrl = `${FRONTEND_URL}/my-notices/view-notice/${noticeId}`;
    await resend.emails.send({
      from: `Shieldlytics <${EMAIL_FROM}>`,
      to: user.EMAIL,
      subject: 'Your Securities Fraud Notice was returned for revision',
      text:
        `Your Securities Fraud Notice (ID ${noticeId}) was returned for revision by a manager.\n\n` +
        `Reason: ${reason}\n\n` +
        `Open the notice to make the requested changes and resubmit:\n${noticeUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #b45309;">Notice Returned for Revision</h2>
          <p>Your Securities Fraud Notice (ID <strong>${noticeId}</strong>) was returned for revision by a manager.</p>
          <p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;">
            <strong>Reason:</strong><br>${escapeHtml(reason)}
          </p>
          <p style="margin: 24px 0;">
            <a href="${noticeUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: 600;">
              Open Notice
            </a>
          </p>
        </div>
      `,
    });
    console.log(
      `[SECURITIES NOTICE MAIL] notifyProcessorOfRejection → user ${processorUserId} for notice ${noticeId}`,
    );
  } catch (err) {
    console.error('[SECURITIES NOTICE MAIL] notifyProcessorOfRejection failed:', err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
