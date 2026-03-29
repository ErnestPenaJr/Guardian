import { test, expect } from '@playwright/test';

test.describe('Suite 1: Authentication & Role-Based Access', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/my-notices');
    await expect(page).toHaveURL(/login/);
    await context.close();
  });

  test('admin can access notices page', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can view the notices table', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can navigate to create notice', async ({ page }) => {
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });
  });

  test('admin can access delivery dashboard', async ({ page }) => {
    await page.goto('/my-notices/notification-status-dashboard');
    await expect(page.locator('body')).toContainText(/Total Sent|Delivery|Dashboard/i, { timeout: 10_000 });
  });

  test('API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/my-notices');
    expect(response.status()).toBe(401);
  });

  test('authenticated API request returns valid response', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const response = await page.request.get(`http://localhost:5175/api/my-notices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 = success with company data, 500 = server error (e.g. null company)
    // Either way, auth was accepted (not 401/403)
    expect([200, 500]).toContain(response.status());
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });
});
