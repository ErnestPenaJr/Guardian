import { test, expect } from '@playwright/test';

/**
 * Phase 5 / US-SNT-04 — Submit for Manager Approval.
 *
 * Requires a SECURITIES_FRAUD template with REQUIRES_MANAGER_APPROVAL=true
 * and a mock SMTP capture (or a manager mailbox that we can poll).
 */

test.describe('Securities Notice — submit for approval (US-SNT-04)', () => {
  test('processor submits → status PENDING_APPROVAL + manager notification', async ({ page }) => {
    test.fixme(true, 'Needs approval-template seed + SMTP capture.');
    // Log in as PROCESSOR. Visit /securities-notices/new?templateId=<approval-template>.
    // Fill fields, pick recipient, click "Submit for Approval".
    // Expect success toast + redirect.
    // Then via API: GET /api/securities-notices/<id> and assert
    // NOTICE_STATUS === 'PENDING_APPROVAL', SUBMITTED_BY === processor.USER_ID.
    // Verify the manager mailbox received "A Securities Fraud Notice is
    // pending your approval" (subject match).
    await page.goto('/securities-notices/new');
    await expect(page.getByText(/Send Securities Fraud Notice/i)).toBeVisible();
  });

  test('attempting POST / on an approval template → 403 forbid', async () => {
    test.fixme(true, 'Awaiting CI wiring.');
    // POST /api/securities-notices with an approval-required templateId.
    // Server returns 403 reminding to use /submit instead.
  });
});
