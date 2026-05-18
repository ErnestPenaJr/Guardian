import { test, expect } from '@playwright/test';

/**
 * Phase 5 / US-SNT-03 — Processor direct-send flow.
 *
 * Skeleton: requires a seeded SECURITIES_FRAUD template with
 * REQUIRES_MANAGER_APPROVAL=false and at least one each of a
 * PREVIOUSLY_VERIFIED and a FIRST_TIME recipient in the test company.
 */

test.describe('Securities Notice — direct send (US-SNT-03)', () => {
  test('processor sends to previously-verified recipient → no modal → success', async ({ page }) => {
    test.fixme(true, 'Needs seeded verified recipient.');
    // Log in as PROCESSOR. Visit /securities-notices/new?templateId=<X>.
    // Fill required fields, pick the verified recipient, click "Send Notice".
    // Expect success toast + redirect to /my-notices.
    await page.goto('/securities-notices/new');
    await expect(page.getByText(/Send Securities Fraud Notice/i)).toBeVisible();
  });

  test('processor sends to first-time recipient → modal → cancel → no audit row created', async () => {
    test.fixme(true, 'Awaiting CI wiring + audit-log assertion helper.');
    // After cancel, GET /api/audit-log filtered by NOTICE_SENT in the last
    // minute and assert zero rows for this run.
  });

  test('processor sends to first-time recipient → modal → confirm → audit rows present', async () => {
    test.fixme(true, 'Awaiting CI wiring + audit-log assertion helper.');
    // After confirm, expect audit rows FIRST_TIME_RECIPIENT_CONFIRMED +
    // NOTICE_SENT (firstTimeFlag=true) for the new NOTICE_ID.
  });

  test('user (role 2) direct URL → 403 / redirect to /home', async ({ page }) => {
    test.fixme(true, 'Needs seeded role-2 user.');
    await page.goto('/securities-notices/new');
    // Expect either a 403 page or redirect to /home.
  });
});
