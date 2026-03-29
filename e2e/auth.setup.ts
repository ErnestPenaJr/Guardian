import { test as setup, expect } from '@playwright/test';

const ADMIN_EMAIL = 'ernest@shieldlytics.com';
const ADMIN_PASSWORD = 'MDA268RedDragon$';

setup('authenticate as admin', async ({ page }) => {
  // Retry login up to 3 times (cold DB connections can be slow)
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/login');
    await page.waitForTimeout(1_000);
    await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    try {
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20_000 },
      );
      break; // Success
    } catch {
      if (attempt === 3) throw new Error('Login failed after 3 attempts');
      console.log(`Login attempt ${attempt} timed out, retrying...`);
    }
  }

  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  await page.context().storageState({ path: '.auth/admin.json' });
});
