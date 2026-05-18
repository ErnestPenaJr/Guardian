import { test, expect } from '@playwright/test';

/**
 * Phase 8 / US-CCL-04 — Audit Log UI + export.
 *
 * Skeleton. Wired against:
 *   - GET /api/audit                       (role-gated, paginated)
 *   - GET /api/audit/export?format=csv     (requires audit.export → roles 1, 6)
 *   - GET /api/audit/export?format=pdf     (requires audit.export → roles 1, 6)
 *   - /audit-log                           (frontend route)
 *
 * Run independently of the bun smoke tests — Playwright fixtures need a
 * running dev server + seeded company log.
 */

test.describe('Compliance — Audit Log (US-CCL-04)', () => {
  test('admin sees all company audit events', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded admin login + at least one audit row in the company log.');

    // 1. Log in as ADMIN (role 1) for the test company.
    // 2. Navigate to /audit-log.
    await page.goto('/audit-log');

    // 3. Assert page heading is visible.
    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible();

    // 4. Assert at least one event row is visible (table populated).
    //    Pick the first row, expand its detail, and verify the JSON pane is rendered.
    //
    // 5. Filter to a specific EVENT_TYPE (e.g. TEMPLATE_CREATED) via the dropdown,
    //    assert the table refreshes and every visible row has EVENT_TYPE === TEMPLATE_CREATED.
  });

  test('manager sees same-company scope only (MVP)', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded manager + at least one cross-company audit row.');

    // 1. Log in as MANAGER (role 4) for the test company.
    // 2. Navigate to /audit-log.
    await page.goto('/audit-log');

    // 3. Page loads (audit.viewScoped grants access).
    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible();

    // 4. Assert every visible row's COMPANY_ID === manager's company ID
    //    (server enforces this; UI just renders what comes back).
    //
    // 5. Assert the Export CSV / Export PDF buttons are NOT visible
    //    (audit.export only includes roles 1, 6).
    await expect(page.getByRole('button', { name: /Export CSV/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Export PDF/i })).toHaveCount(0);
  });

  test('processor is redirected away from /audit-log', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded processor login fixture.');

    // 1. Log in as PROCESSOR (role 3).
    // 2. Navigate to /audit-log.
    await page.goto('/audit-log');

    // 3. Expect redirect to /home (client-side gate via can()).
    await expect(page).toHaveURL(/\/home$/);
  });

  test('CSV export downloads a non-empty file', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded admin + at least one audit row.');

    // 1. Log in as ADMIN.
    // 2. Navigate to /audit-log.
    // 3. Click "Export CSV", wait for the download event.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export CSV/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('audit-log.csv');
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    // 4. Read the stream and assert non-empty + contains the header row
    //    (e.g. "ENTRY_ID,EVENT_TYPE,...").
  });

  test('PDF export downloads and starts with %PDF', async ({ page }) => {
    test.fixme(true, 'Awaiting seeded admin + at least one audit row.');

    // 1. Log in as ADMIN.
    // 2. Navigate to /audit-log.
    // 3. Click "Export PDF", wait for the download.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export PDF/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('audit-log.pdf');
    // 4. Read first 4 bytes and assert "%PDF" magic header.
  });
});
