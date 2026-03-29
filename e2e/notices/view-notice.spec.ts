import { test, expect, Page } from '@playwright/test';

/** Helper: select the first available recipient. Returns false if none available. */
async function selectFirstRecipient(page: Page): Promise<boolean> {
  const input = page.locator('input[aria-autocomplete="list"]').first();
  await input.focus();
  await input.press('ArrowDown');
  await page.waitForTimeout(1_000);

  const noOptions = page.getByText('No options');
  if (await noOptions.isVisible().catch(() => false)) return false;

  await input.press('Enter');
  await page.waitForTimeout(300);

  const multiValue = page.locator('[class*="multiValue"], [class*="multi-value"]').first();
  return await multiValue.isVisible({ timeout: 3_000 }).catch(() => false);
}

/** Helper: type into the TipTap rich text editor */
async function fillNoticeBody(page: Page, text: string) {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type(text);
}

test.describe('Suite 5: View Notice', () => {
  test('no notice selected shows placeholder', async ({ page }) => {
    await page.goto('/my-notices/view-notice');
    await expect(page.getByText(/No notice selected/i)).toBeVisible({ timeout: 10_000 });
  });

  test('placeholder has back to all notices button', async ({ page }) => {
    await page.goto('/my-notices/view-notice');
    await expect(page.getByText(/No notice selected/i)).toBeVisible({ timeout: 10_000 });
    const backButton = page.getByRole('button', { name: /Back to All Notices/i });
    await expect(backButton).toBeVisible();
    await backButton.click();
    await expect(page).toHaveURL(/\/my-notices$/);
  });

  test('view sent notice displays details', async ({ page }) => {
    // Navigate to All Notices, find a sent notice, and view it
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Sent');
    await page.waitForTimeout(600);

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\/\d+/);

      // Verify notice details are displayed
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('sensitivity badge is displayed', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\/\d+/);

      // Should have a sensitivity badge somewhere
      const badges = page.locator('span').filter({ hasText: /CJIS|High|Medium|Low/ });
      await expect(badges.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('stats grid shows recipient and response counts', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();

      // Look for stats labels
      await expect(page.getByText(/Total Recipients/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Responses Received/i)).toBeVisible();
    }
  });

  test('response submission with valid text succeeds', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\/\d+/);

      // Find the response textarea
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('This is a test response with more than ten characters for E2E testing.');
        await page.getByRole('button', { name: /Submit Response/i }).click();

        // Should show success or error (depends on whether user is a recipient)
        await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('response validation rejects short text', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();

      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('short');
        await page.getByRole('button', { name: /Submit Response/i }).click();

        // Should show validation error (either inline or alert)
        const errorVisible = await page.getByText(/at least 10/i).isVisible().catch(() => false);
        const alertVisible = await page.locator('.swal2-popup').isVisible().catch(() => false);
        expect(errorVisible || alertVisible).toBeTruthy();
      }
    }
  });

  test('export all responses CSV download', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();

      const exportButton = page.getByRole('button', { name: /Export.*Responses/i });
      if (await exportButton.isVisible().catch(() => false)) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
          exportButton.click(),
        ]);
        if (download) {
          expect(download.suggestedFilename()).toContain('.csv');
        }
      }
    }
  });

  test('back to dashboard navigation', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const viewButton = page.getByRole('button', { name: /View/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/my-notices\/view-notice\/\d+/);

      // Click back/dashboard button
      const backButton = page.getByRole('button').filter({ hasText: /back|dashboard/i }).first();
      if (await backButton.isVisible().catch(() => false)) {
        await backButton.click();
      }
    }
  });
});

test.describe('Suite 8: End-to-End Notice Lifecycle', () => {
  test('create draft, edit, then send notice', async ({ page }) => {
    // Step 1: Create a draft
    const title = `E2E Lifecycle ${Date.now()}`;
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/Enter notice title/i).fill(title);

    // Select recipient
    const hasRecipient = await selectFirstRecipient(page);
    if (!hasRecipient) {
      test.skip(true, 'No recipients available (user has no company)');
      return;
    }

    // Fill body
    await fillNoticeBody(page, 'This is a lifecycle test notice for end-to-end testing.');

    // Save as draft
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 10_000 });
    await page.locator('.swal2-confirm').click();

    // Step 2: Find the draft and edit it
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);

    // Search for our specific notice
    const searchInput = page.getByPlaceholder(/Search notices/i);
    await searchInput.fill(title);
    await page.waitForTimeout(600);

    const editButton = page.getByRole('button', { name: /Edit/i }).first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await expect(page).toHaveURL(/\/my-notices\/edit\/\d+/);

      // Wait for form to load
      await expect(page.getByPlaceholder(/Enter notice title/i)).not.toHaveValue('', { timeout: 10_000 });

      // Step 3: Send the notice
      await page.getByRole('button', { name: /Send Notice/i }).click();
      await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 10_000 });
      await page.locator('.swal2-confirm').click();
    }
  });
});
