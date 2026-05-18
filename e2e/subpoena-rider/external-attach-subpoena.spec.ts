import { test, expect } from '@playwright/test';

/**
 * Phase 7 / US-SRB-03 — External user attach executed subpoena.
 *
 * Skeleton spec. Stubbed until Ernest seeds an external-user (role 5)
 * with an EXTERNAL_NOTICE_ASSIGNMENTS row in CI.
 */

test.describe('External User Portal (US-SRB-03)', () => {
  test('external user (role 5) cannot reach /home — redirect/403', async ({ page }) => {
    // requireAuth passes (token valid) but role-5 should be blocked from
    // internal pages. The portal-only experience is /external/inbox.
    test.fixme(true, 'Awaiting role-5 seed.');
    await page.goto('/home');
    await expect(page).toHaveURL(/external|login/);
  });

  test('external user → /external/notices/:id renders read-only notice', async ({ page }) => {
    // Manual flow:
    //   1. Log in as EXTERNAL_USER (role 5).
    //   2. Navigate to /external/notices/:assignedId.
    //   3. Expect notice title, body, and status badge to render.
    //   4. Expect Attach Executed Subpoena + Request a Call panels.
    test.fixme(true, 'Awaiting role-5 seed + EXTERNAL_NOTICE_ASSIGNMENTS row.');
  });

  test('upload PDF → notice transitions to SUBPOENA_RECEIVED_PENDING_REVIEW', async () => {
    // 1. Pick a PDF in the file picker.
    // 2. Click "Attach Subpoena".
    // 3. Expect success toast.
    // 4. Server-side: notice.NOTICE_STATUS becomes SUBPOENA_RECEIVED_PENDING_REVIEW
    //    and an ATTACHED_SUBPOENA_ATTACHMENT_ID is set.
    // 5. Processor receives email via the existing notification path.
    test.fixme(true, 'Awaiting role-5 seed + file fixture.');
  });

  test('upload an unsupported file type → 400 with the spec message', async () => {
    // Pick a .exe → expect "File type not permitted. Please upload a PDF, TIFF, or DOCX file."
    test.fixme(true, 'Awaiting role-5 seed.');
  });

  test('Request a Call with two proposed datetimes → 201', async () => {
    test.fixme(true, 'Awaiting role-5 seed.');
  });
});
