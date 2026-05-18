import { test, expect } from '@playwright/test';

/**
 * Phase 6 / US-CCL-03 — First-Time Recipient intercept.
 *
 * Skeleton: requires a seeded SECURITIES_FRAUD template with
 * REQUIRES_MANAGER_APPROVAL=false and at least one recipient with NO row in
 * RECIPIENT_VERIFICATIONS for the test company (i.e., guaranteed FIRST_TIME).
 *
 * Wired against:
 *   - GET  /api/recipients/:id/verification           (FIRST_TIME default)
 *   - POST /api/securities-notices  (409 requiresFirstTimeConfirmation → 201 on confirmFirstTime=true)
 *   - GET  /api/audit-log filtered by FIRST_TIME_RECIPIENT_CONFIRMED + NOTICE_SENT
 */

test.describe('Compliance — First-Time Recipient intercept (US-CCL-03)', () => {
  test('cancel → no notice created, no audit row written', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded FIRST_TIME recipient + audit-log assertion helper.');

    // 1. Log in as PROCESSOR. Visit /securities-notices/new?templateId=<X>.
    await page.goto('/securities-notices/new');
    await expect(page.getByText(/Send Securities Fraud Notice/i)).toBeVisible();

    // 2. Pick the first-time recipient. Confirm the amber
    //    "First-Time Recipient" badge appears next to their name in the
    //    RecipientPicker (RecipientPicker badges read from
    //    /api/recipients/:id/verification).
    //
    // 3. Fill required template fields.
    //
    // 4. Click "Send Notice".  Server returns 409
    //    { requiresFirstTimeConfirmation: true }.  Frontend shows
    //    FirstTimeRecipientModal.
    //
    // 5. Click the modal's Cancel button.
    //
    // 6. Assert no MY_NOTICES row was created in the last minute for this
    //    template + recipient pair.
    //
    // 7. Assert GET /api/audit-log filtered by NOTICE_SENT and
    //    FIRST_TIME_RECIPIENT_CONFIRMED in the last minute returns zero rows.
  });

  test('confirm → audit rows written + notice send proceeds', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded FIRST_TIME recipient + audit-log assertion helper.');

    // 1. Log in as PROCESSOR. Visit /securities-notices/new?templateId=<X>.
    await page.goto('/securities-notices/new');

    // 2. Pick the first-time recipient. Fill required template fields.
    //
    // 3. Click "Send Notice".  Server returns 409 → modal opens.
    //
    // 4. Click the modal's "Confirm Send" button.  Frontend resubmits with
    //    confirmFirstTime=true.  Server returns 201.
    //
    // 5. Assert success toast + redirect to /my-notices.
    //
    // 6. Assert audit rows exist:
    //      - FIRST_TIME_RECIPIENT_CONFIRMED { targetType:'NOTICE', targetId:<new NOTICE_ID> }
    //      - NOTICE_SENT { detail.firstTimeFlag: true,    targetId:<new NOTICE_ID> }
    //
    // 7. Subsequent GET /api/recipients/<recipientUserId>/verification still
    //    returns FIRST_TIME until the recipient actually responds — the
    //    upgrade to PREVIOUSLY_VERIFIED happens on acknowledgement, not on
    //    send. (Wired in server/routes/my-notices.ts PATCH /:id.)
  });
});
