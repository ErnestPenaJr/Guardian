import { test, expect } from '@playwright/test';

/**
 * Phase 5 / US-SNT-05 — Manager approve / reject.
 *
 * Requires:
 *   - A PROCESSOR with a notice already in PENDING_APPROVAL.
 *   - A MANAGER (role 4) account in the same company.
 *   - Mock SMTP capture (or pollable manager + processor mailbox).
 */

test.describe('Securities Notice — manager approve (US-SNT-05)', () => {
  test('manager opens queue → approves → status SENT_AWAITING_RESPONSE', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded PENDING_APPROVAL notice + manager auth.');
    // Log in as MANAGER. Visit /securities-notices/approvals.
    // Click "Review" on the seeded row. Click "Approve and Send".
    // Expect success toast; via API NOTICE_STATUS now SENT_AWAITING_RESPONSE.
    // Assert audit rows: NOTICE_APPROVED + NOTICE_SENT for the same NOTICE_ID.
    await page.goto('/securities-notices/approvals');
    await expect(page.getByText(/Securities Notice Approval Queue/i)).toBeVisible();
  });
});

test.describe('Securities Notice — manager reject (US-SNT-05)', () => {
  test('manager rejects with reason → status RETURNED_FOR_REVISION + processor email', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded PENDING_APPROVAL notice + SMTP capture.');
    // Log in as MANAGER. Visit /securities-notices/approvals.
    // Click "Review" on the seeded row. Click "Reject and Return".
    // Modal opens; submit empty reason → expect inline validation.
    // Fill a reason and click "Return for Revision".
    // Via API NOTICE_STATUS now RETURNED_FOR_REVISION, REJECTION_REASON set,
    // REJECTED_BY = manager.USER_ID.
    // Verify the processor mailbox received a "returned for revision" email.
    await page.goto('/securities-notices/approvals');
    await expect(page.getByText(/Securities Notice Approval Queue/i)).toBeVisible();
  });

  test('rejected notice can be re-submitted by processor', async () => {
    test.fixme(true, 'Awaiting CI wiring.');
    // Log in as PROCESSOR. Open the rejected notice (ViewNotice).
    // Expect the "Submit for Approval" action panel to be visible.
    // Click it. Assert status returns to PENDING_APPROVAL.
  });
});
