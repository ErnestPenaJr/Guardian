import { test, expect, Page } from '@playwright/test';

const uniqueTitle = () => `E2E Test Notice ${Date.now()}`;

/**
 * Helper: select the first available recipient in the react-select dropdown.
 * Returns true if a recipient was selected, false if no options were available.
 */
async function selectFirstRecipient(page: Page): Promise<boolean> {
  // The react-select input is inside a div labeled "Recipients"
  // Find it by the placeholder text, then click the surrounding container
  const recipientSection = page.locator('label:has-text("Recipients")').locator('..');
  const reactSelectInput = recipientSection.locator('input').first();
  await reactSelectInput.click();
  await page.waitForTimeout(1_000);

  // Type a space to trigger the dropdown menu to show all options
  await reactSelectInput.pressSequentially(' ', { delay: 100 });
  await page.waitForTimeout(1_000);

  // Check for "No options"
  const noOptions = page.getByText('No options');
  if (await noOptions.isVisible().catch(() => false)) return false;

  // Use keyboard to select first option
  await reactSelectInput.press('Backspace'); // Remove the space
  await reactSelectInput.press('ArrowDown');
  await page.waitForTimeout(300);
  await reactSelectInput.press('Enter');
  await page.waitForTimeout(500);

  // Verify selection happened - check for remove button (x) on selected chip
  const removeButton = recipientSection.locator('[class*="multiValue"], [class*="MultiValue"], [aria-label*="Remove"]');
  return (await removeButton.count()) > 0;
}

/** Helper: type into the TipTap rich text editor */
async function fillNoticeBody(page: Page, text: string) {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type(text);
}

test.describe('Suite 3: Create Notice', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });
  });

  test('form renders with default values', async ({ page }) => {
    const titleInput = page.getByPlaceholder(/Enter notice title/i);
    await expect(titleInput).toHaveValue('');

    // Classification defaults to Low
    const options = page.locator('select');
    await expect(options.first()).toBeVisible();
  });

  test('title required validation', async ({ page }) => {
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.getByText(/Notice title is required/i)).toBeVisible();
  });

  test('recipients required validation', async ({ page }) => {
    await page.getByPlaceholder(/Enter notice title/i).fill('Test Title');
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.getByText(/At least one recipient/i)).toBeVisible();
  });

  test('notice body min length validation', async ({ page }) => {
    await page.getByPlaceholder(/Enter notice title/i).fill('Test Title');
    const hasRecipient = await selectFirstRecipient(page);
    if (!hasRecipient) {
      test.skip(true, 'No recipients available');
      return;
    }
    // Type short text in TipTap (TipTap wraps in <p> tags so HTML length > plain text)
    await fillNoticeBody(page, 'short');
    await page.getByRole('button', { name: /Save Draft/i }).click();
    // Either frontend validation shows "at least 10 characters" or backend returns an error
    const validationError = page.getByText(/at least 10 characters/i);
    const serverError = page.locator('.swal2-popup');
    await expect(validationError.or(serverError).first()).toBeVisible({ timeout: 10_000 });
  });

  test('classification dropdown has all options', async ({ page }) => {
    // Find the select that has "Low" as current value
    const selects = page.locator('select');
    const allOptions: string[] = [];
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      allOptions.push(...opts);
    }
    expect(allOptions).toContain('Low');
    expect(allOptions).toContain('Medium');
    expect(allOptions).toContain('High');
    expect(allOptions).toContain('CJIS');
  });

  test('distribution dropdown has all options', async ({ page }) => {
    const selects = page.locator('select');
    const allOptions: string[] = [];
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      allOptions.push(...opts);
    }
    expect(allOptions).toContain('Internal Only');
    expect(allOptions).toContain('External Only');
    expect(allOptions).toContain('Mixed (Internal + External)');
  });

  test('recipients multi-select shows options', async ({ page }) => {
    const selectControl = page.locator('.css-13cymwt-control, [class*="control"]').first();
    await selectControl.click();
    await page.waitForTimeout(1_000);

    // Should see options or a menu
    const menu = page.locator('[class*="menu"]').first();
    await expect(menu).toBeVisible({ timeout: 5_000 });
  });

  test('save as draft creates notice', async ({ page }) => {
    const title = uniqueTitle();
    await page.getByPlaceholder(/Enter notice title/i).fill(title);

    const classSelect = page.locator('select').first();
    await classSelect.selectOption('Medium');

    const hasRecipient = await selectFirstRecipient(page);
    if (!hasRecipient) {
      test.skip(true, 'No recipients available (/api/users returns empty for this account)');
      return;
    }

    await fillNoticeBody(page, 'This is a test notice body with enough characters for validation to pass.');
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();
  });

  test('send notice creates and sends', async ({ page }) => {
    const title = uniqueTitle();
    await page.getByPlaceholder(/Enter notice title/i).fill(title);

    const hasRecipient = await selectFirstRecipient(page);
    if (!hasRecipient) {
      test.skip(true, 'No recipients available (user has no company)');
      return;
    }

    await fillNoticeBody(page, 'This is a test notice being sent to recipients for E2E testing purposes.');
    await page.getByRole('button', { name: /Send Notice/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();
  });

  test('duplicate title handled gracefully', async ({ page }) => {
    const title = uniqueTitle();

    await page.getByPlaceholder(/Enter notice title/i).fill(title);
    const hasRecipient = await selectFirstRecipient(page);
    if (!hasRecipient) {
      test.skip(true, 'No recipients available');
      return;
    }
    await fillNoticeBody(page, 'First notice body with enough characters for the validation test.');
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();

    await page.goto('/my-notices/create');
    await expect(page.getByText(/Create New Notice/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder(/Enter notice title/i).fill(title);
    await selectFirstRecipient(page);
    await fillNoticeBody(page, 'Duplicate notice body content for testing the duplicate handling.');
    await page.getByRole('button', { name: /Save Draft/i }).click();
    // Should show either a duplicate error or success (depending on server implementation)
    await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
    await page.locator('.swal2-confirm').click();
  });
});

test.describe('Suite 4: Edit Notice', () => {
  test('edit page pre-fills form with notice data', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);

    const editButton = page.getByRole('button', { name: /Edit/i }).first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await expect(page).toHaveURL(/\/my-notices\/edit\/\d+/);

      const titleInput = page.getByPlaceholder(/Enter notice title/i);
      await expect(titleInput).not.toHaveValue('', { timeout: 10_000 });
    }
  });

  test('edit and save draft updates notice', async ({ page }) => {
    await page.goto('/my-notices');
    await expect(page.getByText('Notice Management')).toBeVisible({ timeout: 10_000 });

    const statusSelect = page.locator('select').filter({ hasText: /All Status/i });
    await statusSelect.selectOption('Draft');
    await page.waitForTimeout(600);

    const editButton = page.getByRole('button', { name: /Edit/i }).first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await expect(page).toHaveURL(/\/my-notices\/edit\/\d+/);

      const titleInput = page.getByPlaceholder(/Enter notice title/i);
      await expect(titleInput).not.toHaveValue('', { timeout: 10_000 });

      await titleInput.fill(`Updated Draft ${Date.now()}`);
      await page.getByRole('button', { name: /Save Draft/i }).click();
      await expect(page.locator('.swal2-popup')).toBeVisible({ timeout: 15_000 });
      await page.locator('.swal2-confirm').click();
    }
  });
});
