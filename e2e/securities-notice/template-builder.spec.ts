import { test, expect } from '@playwright/test';

/**
 * Phase 5 / US-SNT-01 + US-SNT-02 — Securities Fraud Notice Template Builder.
 *
 * Skeleton spec. The implementation calls are stubbed as `test.fixme` until
 * Ernest provides credentials and a stable seeded company in CI.
 */

test.describe('Securities Notice Template Builder (US-SNT-01)', () => {
  test('admin can navigate to /securities-notice-templates/new and see builder', async ({ page }) => {
    // Manual flow:
    //   1. Log in as ADMIN (role 1).
    //   2. Visit /securities-notice-templates/new.
    //   3. Expect "Securities Fraud Notice Template" card to be visible.
    //   4. Expect SECURITY_SYMBOL row to be disabled-but-on with a lock tooltip.
    test.fixme(true, 'Needs seeded admin user — wire up in CI after auth.setup.');
    await page.goto('/securities-notice-templates/new');
    await expect(page.getByText(/Securities Fraud Notice Template/i)).toBeVisible();
  });

  test('disable SECURITY_SYMBOL → save → expect inline error', async () => {
    // SECURITY_SYMBOL is rendered disabled, so this validates server-side
    // 400 with the exact message: "Security Symbol is a required field..."
    test.fixme(true, 'Awaiting CI wiring.');
  });

  test('toggling disclaimer OFF on SECURITIES_FRAUD opens confirmation modal', async () => {
    // Click the disclaimer switch (it defaults ON for SECURITIES_FRAUD).
    // Expect the "Confirm Disclaimer Removal" modal. Click Cancel and
    // assert the toggle remains ON.
    test.fixme(true, 'Awaiting CI wiring.');
  });

  test('save valid template → success toast + redirect', async () => {
    test.fixme(true, 'Awaiting CI wiring.');
  });

  test('manager (role 4) direct URL → 403 / redirect to /home', async () => {
    test.fixme(true, 'Awaiting CI wiring.');
  });
});

test.describe('Securities Notice Manager Approval toggle (US-SNT-02)', () => {
  test('toggle ON → save → DB row has REQUIRES_MANAGER_APPROVAL=1', async () => {
    // After save, hit GET /api/forms/:id and assert REQUIRES_MANAGER_APPROVAL true,
    // and audit row MANAGER_APPROVAL_CONFIG_CHANGED is present.
    test.fixme(true, 'Awaiting CI wiring + DB assertion helper.');
  });

  test('solo-role company → toggle disabled with tooltip', async () => {
    // Seed company with only role=ADMIN. Visit builder. Assert the toggle
    // is disabled and the tooltip mentions "more than one role".
    test.fixme(true, 'Awaiting seeded solo-role company.');
  });
});
