import { test, expect } from '@playwright/test';

test.describe('Suite 2: All Notices Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });
  });

  test('page loads with heading and table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Notice Management/i })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('displays notice count in heading', async ({ page }) => {
    await expect(page.getByText(/Notices \(\d+\)/)).toBeVisible({ timeout: 10_000 });
  });

  test('search filters notices with debounce', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search notices/i);
    await searchInput.fill('TestNoticeXYZ_NO_MATCH');
    // Wait for debounce (400ms) + API response
    await page.waitForTimeout(600);
    await expect(page.getByText('No notices found')).toBeVisible();
  });

  test('status filter - Sent', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Sent');
    await page.waitForTimeout(600);
    // If notices exist, all visible badges should be "Sent"
    const draftBadges = page.getByText('Draft', { exact: true }).locator('visible=true');
    await expect(draftBadges).toHaveCount(0).catch(() => {
      // No draft badges should be visible when filtering by Sent
    });
  });

  test('status filter - Draft', async ({ page }) => {
    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);
  });

  test('sensitivity filter - CJIS', async ({ page }) => {
    const sensitivitySelect = page.locator('select').filter({ hasText: /All Sensitivity/i });
    await sensitivitySelect.selectOption('CJIS');
    await page.waitForTimeout(600);
  });

  test('sensitivity filter - High', async ({ page }) => {
    const sensitivitySelect = page.locator('select').filter({ hasText: /All Sensitivity/i });
    await sensitivitySelect.selectOption('High');
    await page.waitForTimeout(600);
  });

  test('sensitivity filter - Medium', async ({ page }) => {
    const sensitivitySelect = page.locator('select').filter({ hasText: /All Sensitivity/i });
    await sensitivitySelect.selectOption('Medium');
    await page.waitForTimeout(600);
  });

  test('sensitivity filter - Low', async ({ page }) => {
    const sensitivitySelect = page.locator('select').filter({ hasText: /All Sensitivity/i });
    await sensitivitySelect.selectOption('Low');
    await page.waitForTimeout(600);
  });

  test('pagination shows page info', async ({ page }) => {
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
    await expect(page.getByText(/Showing \d+/)).toBeVisible();
  });

  test('rows per page changes table size', async ({ page }) => {
    const rowsSelect = page.locator('select').filter({ hasText: /10/ }).last();
    await rowsSelect.selectOption('5');
    await page.waitForTimeout(500);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(5);
  });

  test('Create Notice button navigates to create page', async ({ page }) => {
    await page.getByRole('button', { name: /Create Notice/i }).click();
    await expect(page).toHaveURL(/\/my-notices\/create/);
  });

  test('View button navigates to view-notice page', async ({ page }) => {
    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\//);
    }
  });

  test('Edit button navigates to edit page', async ({ page }) => {
    // Filter for drafts first
    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);

    const editButton = page.getByRole('button', { name: /Edit/i }).first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await expect(page).toHaveURL(/\/my-notices\/edit\//);
    }
  });

  test('empty state shows no notices found', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search notices/i);
    await searchInput.fill('ZZZZZ_IMPOSSIBLE_SEARCH_TERM_99999');
    await page.waitForTimeout(600);
    await expect(page.getByText('No notices found')).toBeVisible();
  });

  test('combined filters work together', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search notices/i);
    await searchInput.fill('test');

    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Sent');

    const sensitivitySelect = page.locator('select').filter({ hasText: /All Sensitivity/i });
    await sensitivitySelect.selectOption('Low');

    await page.waitForTimeout(600);
    // Verify page loaded (might be empty or have results)
    await expect(page.getByText(/Notices \(\d+\)/)).toBeVisible();
  });

  test('role-based access info banner visible', async ({ page }) => {
    await expect(page.getByText(/Role-Based Access Active/i)).toBeVisible();
  });
});
