import { test, expect, Page } from '@playwright/test';

const uniqueTitle = () => `CRUD Test ${Date.now()}`;

async function selectFirstRecipient(page: Page): Promise<boolean> {
  // Click the react-select control to open the dropdown
  const selectControl = page.locator('.css-13cymwt-control, [class*="control"]').first();
  await selectControl.click();
  await page.waitForTimeout(1_000);

  const menu = page.locator('[class*="menu"]').first();
  const menuVisible = await menu.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!menuVisible) return false;

  const menuText = await menu.textContent();
  if (menuText?.includes('No options')) return false;

  const option = menu.locator('[class*="option"]').first();
  if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await option.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

async function fillNoticeBody(page: Page, text: string) {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type(text);
}

test.describe('CRUD Lifecycle: Create, Edit, Delete a Notice', () => {
  test('create a draft notice, edit it, then delete it', async ({ page }) => {
    const title = uniqueTitle();
    const editedTitle = `${title} - EDITED`;

    // ═══════════════════════════════════════════════════
    // STEP 1: CREATE a draft notice
    // ═══════════════════════════════════════════════════
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/Enter notice title/i).fill(title);

    const hasRecipient = await selectFirstRecipient(page);
    expect(hasRecipient, 'Should be able to select a recipient').toBe(true);

    await fillNoticeBody(page, 'This is a CRUD lifecycle test notice. It will be created, edited, then deleted.');

    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.swal2-popup')).toContainText(/Draft Saved|saved/i);
    await page.locator('.swal2-confirm').click();
    await page.waitForTimeout(500);

    // ═══════════════════════════════════════════════════
    // STEP 2: VERIFY the draft appears in All Notices
    // ═══════════════════════════════════════════════════
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    // Filter for drafts
    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);

    // Search for our specific notice
    const searchInput = page.getByPlaceholder(/Search notices/i);
    await searchInput.fill(title);
    await page.waitForTimeout(600);

    // Verify it appears
    await expect(page.getByText(title)).toBeVisible({ timeout: 5_000 });
    // Verify it has Edit and Delete buttons
    await expect(page.getByRole('button', { name: /Edit/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/i }).first()).toBeVisible();

    // ═══════════════════════════════════════════════════
    // STEP 3: EDIT the notice
    // ═══════════════════════════════════════════════════
    await page.getByRole('button', { name: /Edit/i }).first().click();
    await expect(page).toHaveURL(/\/my-notices\/edit\/\d+/);

    // Wait for form to load with existing data
    const titleInput = page.getByPlaceholder(/Enter notice title/i);
    await expect(titleInput).not.toHaveValue('', { timeout: 10_000 });
    await expect(titleInput).toHaveValue(title);

    // Change the title
    await titleInput.clear();
    await titleInput.fill(editedTitle);

    // Save the edit
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();
    await page.waitForTimeout(500);

    // ═══════════════════════════════════════════════════
    // STEP 4: VERIFY the edit persisted
    // ═══════════════════════════════════════════════════
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    await page.locator('select').filter({ hasText: /All Status/i }).selectOption('Draft');
    await page.waitForTimeout(600);
    await page.getByPlaceholder(/Search notices/i).fill(editedTitle);
    await page.waitForTimeout(600);

    await expect(page.getByText(editedTitle)).toBeVisible({ timeout: 5_000 });

    // ═══════════════════════════════════════════════════
    // STEP 5: DELETE the notice
    // ═══════════════════════════════════════════════════
    await page.getByRole('button', { name: /Delete/i }).first().click();

    // Confirm the SweetAlert confirmation dialog
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.swal2-popup')).toContainText(/Delete Notice/i);
    await page.locator('.swal2-confirm').click();

    // Wait for success message
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.swal2-popup')).toContainText(/Deleted|deleted/i);
    // Auto-dismiss or click OK
    const confirmBtn = page.locator('.swal2-confirm');
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(500);

    // ═══════════════════════════════════════════════════
    // STEP 6: VERIFY the notice is gone
    // ═══════════════════════════════════════════════════
    await page.getByPlaceholder(/Search notices/i).fill(editedTitle);
    await page.waitForTimeout(600);

    await expect(page.getByText('No notices found')).toBeVisible({ timeout: 5_000 });
  });

  test('cannot delete a sent notice', async ({ page }) => {
    // Create and send a notice
    const title = uniqueTitle();
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/Enter notice title/i).fill(title);
    await selectFirstRecipient(page);
    await fillNoticeBody(page, 'This sent notice should not be deletable from the UI.');

    await page.getByRole('button', { name: /Send Notice/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();
    await page.waitForTimeout(500);

    // Go to All Notices and verify sent notice has View button (no Delete)
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    await page.locator('select').filter({ hasText: /All Status/i }).selectOption('Sent');
    await page.waitForTimeout(600);
    await page.getByPlaceholder(/Search notices/i).fill(title);
    await page.waitForTimeout(600);

    // Sent notices should have View button, NOT Delete
    const viewButton = page.getByRole('button', { name: /View/i }).first();
    await expect(viewButton).toBeVisible({ timeout: 5_000 });

    // No Delete button should be visible for sent notices
    const deleteButton = page.getByRole('button', { name: /Delete/i });
    await expect(deleteButton).toHaveCount(0);
  });
});
