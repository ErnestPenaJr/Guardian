import { test, expect } from '@playwright/test';

/**
 * Phase 7 / US-SRB-04 — Records released UI gating.
 *
 * Skeleton spec. Stubbed until Ernest seeds a notice in
 * SUBPOENA_RECEIVED_PENDING_REVIEW status in CI.
 */

test.describe('Mark Records Released (US-SRB-04)', () => {
  test('processor sees Mark Records Released button only when status is SUBPOENA_RECEIVED_PENDING_REVIEW', async ({ page }) => {
    // Manual flow:
    //   1. Log in as PROCESSOR (role 3).
    //   2. Open a notice whose status is SUBPOENA_RECEIVED_PENDING_REVIEW.
    //   3. Expect "Mark Records Released" button visible.
    //   4. Open a different notice whose status is SENT_AWAITING_RESPONSE.
    //   5. Expect button NOT visible.
    test.fixme(true, 'Awaiting seeded notice in SUBPOENA_RECEIVED_PENDING_REVIEW.');
    await page.goto('/my-notices');
    await expect(page.getByText(/Mark Records Released/i)).toBeVisible();
  });

  test('general user (role 2) never sees the Mark Records Released button', async () => {
    // can('securitiesNotice.markRecordsReleased') is [P, M] only.
    test.fixme(true, 'Awaiting seeded role-2 user.');
  });

  test('general user (role 2) never sees the Download Executed Subpoena link', async () => {
    // can('securitiesNotice.view') is [A, P, M, S]; role 2 is excluded.
    test.fixme(true, 'Awaiting seeded role-2 user.');
  });

  test('processor clicks Mark Records Released → confirmation modal → success', async () => {
    // 1. Click "Mark Records Released" → SweetAlert confirmation modal.
    // 2. Click Confirm → PUT /api/securities-notices/:id/records-released.
    // 3. Expect success toast and page reload with new status badge.
    test.fixme(true, 'Awaiting CI wiring.');
  });
});
