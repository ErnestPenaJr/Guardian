import { test, expect } from '@playwright/test';

/**
 * Phase 5 / US-SNT-06 — User read-only view.
 *
 * Requires a GENERAL_USER (role 2) account in the same company as a
 * SENT_AWAITING_RESPONSE notice that lists them as a recipient.
 */

test.describe('Securities Notice — user read-only (US-SNT-06)', () => {
  test('GENERAL_USER sees notice list scoped to recipient-only rows', async ({ page }) => {
    test.fixme(true, 'Needs role-2 seed + recipient row.');
    // Log in as GENERAL_USER. Visit /my-notices.
    // Expect the seeded notice in the list. Notices not addressed to this
    // user must NOT appear.
    await page.goto('/my-notices');
    await expect(page.getByText(/Notice Management/i)).toBeVisible();
  });

  test('GENERAL_USER opens notice → no Send / Submit / Approve buttons', async ({ page }) => {
    test.fixme(true, 'Needs role-2 seed.');
    // Open the seeded notice. Assert the Securities Notice action panel
    // shows neither "Send", "Submit for Approval", nor "Review for Approval".
    // The response form (Submit Response) remains visible — that's a
    // different permission (notices.respond).
    await page.goto('/my-notices');
  });

  test('GENERAL_USER direct URL /securities-notices/new → 403 / redirect', async ({ page }) => {
    test.fixme(true, 'Needs role-2 seed.');
    await page.goto('/securities-notices/new');
    // Expect redirect to /home (Navigate replace) because securitiesNotice.send
    // is not in the matrix for role 2.
  });

  test('GENERAL_USER direct URL /securities-notices/approvals → 403 / redirect', async ({ page }) => {
    test.fixme(true, 'Needs role-2 seed.');
    await page.goto('/securities-notices/approvals');
    // Expect redirect to /home.
  });
});
