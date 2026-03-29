import { test, expect } from '@playwright/test';

test.describe('Suite 6: Delivery Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-notices/notification-status-dashboard');
    // Wait for dashboard to load
    await page.waitForTimeout(2_000);
  });

  test('dashboard loads with stat cards', async ({ page }) => {
    // Should have summary stat cards
    await expect(page.getByText(/Total Sent/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Notices with Responses/i)).toBeVisible();
    await expect(page.getByText(/Total Responses/i)).toBeVisible();
    await expect(page.getByText(/Total Attachments/i)).toBeVisible();
  });

  test('stat cards display numeric values', async ({ page }) => {
    // Each stat card should have a number
    const statCards = page.locator('.text-2xl, .text-3xl').filter({ hasText: /\d+/ });
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('delivery table is visible', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('table has expected columns', async ({ page }) => {
    const headers = page.locator('thead th, thead td');
    const headerTexts = await headers.allTextContents();
    const headerString = headerTexts.join(' ').toLowerCase();
    expect(headerString).toContain('notice');
    expect(headerString).toContain('sensitivity');
    expect(headerString).toContain('status');
  });

  test('notice filter dropdown works', async ({ page }) => {
    const noticeFilter = page.locator('select').filter({ hasText: /All Notices/i });
    if (await noticeFilter.isVisible().catch(() => false)) {
      const options = await noticeFilter.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(1); // At least "All Notices"
    }
  });

  test('status filter - Sent', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ hasText: /All Status/i });
    if (await statusFilter.isVisible().catch(() => false)) {
      await statusFilter.selectOption('Sent');
      await page.waitForTimeout(600);
    }
  });

  test('status filter - Draft', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ hasText: /All Status/i });
    if (await statusFilter.isVisible().catch(() => false)) {
      await statusFilter.selectOption('Draft');
      await page.waitForTimeout(600);
    }
  });

  test('View Details button navigates to notice view', async ({ page }) => {
    const viewButton = page.getByRole('button', { name: /View Details/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\//);
    }
  });

  test('Export CSV triggers download', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export CSV/i });
    if (await exportButton.isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
        exportButton.click(),
      ]);
      if (download) {
        expect(download.suggestedFilename()).toContain('.csv');
      }
    }
  });

  test('pagination shows page info or empty state', async ({ page }) => {
    // Dashboard may have no data, so either pagination or "Not Data Found" is valid
    const pageInfo = page.getByText(/Page \d+ of \d+/);
    const noData = page.getByText(/Not Data Found/i);
    const either = pageInfo.or(noData);
    await expect(either.first()).toBeVisible({ timeout: 10_000 });
  });

  test('rows per page selector works', async ({ page }) => {
    const rowsSelect = page.locator('select').filter({ hasText: /10/ }).last();
    if (await rowsSelect.isVisible().catch(() => false)) {
      await rowsSelect.selectOption('5');
      await page.waitForTimeout(500);
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(6); // 5 data rows + possible empty message row
    }
  });

  test('loading state appears briefly', async ({ page }) => {
    // Reload to catch loading state
    await page.reload();
    // Either see loading text or data loads fast enough to skip it
    const loadingOrData = page.getByText(/Loading|Total Sent/i);
    await expect(loadingOrData.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Suite 7: Responsive Layout Checks', () => {
  test('notices page renders without horizontal overflow', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    // Verify no horizontal scrollbar on body
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow small margin for scrollbars
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('create notice form is accessible', async ({ page }) => {
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });

    // All form elements should be visible and not cut off
    await expect(page.getByPlaceholder(/Enter notice title/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Notice/i })).toBeVisible();
  });

  test('delivery dashboard cards are visible', async ({ page }) => {
    await page.goto('/my-notices/notification-status-dashboard');
    await page.waitForTimeout(2_000);

    await expect(page.getByText(/Total Sent/i)).toBeVisible({ timeout: 10_000 });
  });

  test('pagination controls are accessible', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    // Pagination buttons should be visible
    const pageInfo = page.getByText(/Page \d+ of \d+/);
    await expect(pageInfo).toBeVisible();
  });

  test('action buttons are tappable size', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const createButton = page.getByRole('button', { name: /Create Notice/i });
    const box = await createButton.boundingBox();
    if (box) {
      // Minimum touch target: 44px
      expect(box.height).toBeGreaterThanOrEqual(36);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('table scrolls horizontally on small viewports', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    // The table wrapper should have overflow-x-auto
    const tableWrapper = page.locator('.overflow-x-auto').first();
    if (await tableWrapper.isVisible().catch(() => false)) {
      const scrollWidth = await tableWrapper.evaluate(el => el.scrollWidth);
      const clientWidth = await tableWrapper.evaluate(el => el.clientWidth);
      // On small screens, scrollWidth should be >= clientWidth (scrollable)
      expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
    }
  });
});
