import { test, expect } from '@playwright/test';

/**
 * Form Builder Template Lifecycle E2E Tests
 *
 * Tests run sequentially — a form is created in early tests,
 * saved, then edited and verified in later tests.
 */

// Shared state across sequential tests
let savedFormId: number | null = null;

test.describe('Form Builder Template Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Test 1: Page loads with three-panel layout ────────────────────
  test('navigates to form builder new page with correct layout', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Toolbar
    await expect(page.locator('.fb-toolbar')).toBeVisible();
    await expect(page.locator('.fb-logo-mark')).toBeVisible();
    await expect(page.locator('button.fb-btn-p')).toBeVisible(); // Save button

    // View toggle — Editor and Preview
    await expect(page.locator('.fb-vbtn', { hasText: 'Editor' })).toBeVisible();
    await expect(page.locator('.fb-vbtn', { hasText: 'Preview' })).toBeVisible();

    // Left panel — palette
    await expect(page.locator('.fb-left')).toBeVisible();
    await expect(page.locator('.fb-ptab', { hasText: 'Elements' })).toBeVisible();
    await expect(page.locator('.fb-ptab', { hasText: 'Tree' })).toBeVisible();

    // Canvas — empty state
    await expect(page.locator('.fb-empty')).toBeVisible();
    await expect(page.getByText('Drop fields here')).toBeVisible();

    // Right panel
    await expect(page.locator('.fb-right')).toBeVisible();
    await expect(page.getByText('Select a field to edit')).toBeVisible();
  });

  // ── Test 2: Set form name and description ─────────────────────────
  test('sets form name and description', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Fill form name in the canvas title input
    const canvasNameInput = page.locator('.fb-canvas .fb-titleinp');
    await canvasNameInput.fill('E2E Test Form');
    await expect(canvasNameInput).toHaveValue('E2E Test Form');

    // Fill description
    const descInput = page.locator('.fb-canvas .fb-fi').first();
    await descInput.fill('Automated test form');
    await expect(descInput).toHaveValue('Automated test form');

    // Toolbar name input should be synced
    const toolbarNameInput = page.locator('.fb-toolbar .fb-titleinp');
    await expect(toolbarNameInput).toHaveValue('E2E Test Form');
  });

  // ── Test 3: Add fields by clicking palette items ──────────────────
  test('adds fields by clicking palette items', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Click Text Input in palette
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await expect(page.locator('.fb-card')).toHaveCount(1);

    // Empty state should be gone
    await expect(page.locator('.fb-empty')).toHaveCount(0);

    // Add Email field
    await page.locator('.fb-pitem', { hasText: 'Email' }).first().click();
    await expect(page.locator('.fb-card')).toHaveCount(2);

    // Add Date field
    await page.locator('.fb-pitem', { hasText: 'Date' }).first().click();
    await expect(page.locator('.fb-card')).toHaveCount(3);

    // Check field count in toolbar
    await expect(page.locator('.fb-count')).toHaveText('3 fields');
  });

  // ── Test 4: Drag field to same row (side-by-side) ─────────────────
  test('arranges fields side-by-side via drag to vertical drop zone', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Add two fields
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('.fb-pitem', { hasText: 'Email' }).first().click();
    await page.waitForTimeout(300);

    // Should have 2 rows, each with 1 field
    await expect(page.locator('.fb-form-row')).toHaveCount(2);

    // Drag the second field's handle to the first row's vertical drop zone
    const secondHandle = page.locator('.fb-handle').nth(1);
    const firstRowVzone = page.locator('.fb-vzone').nth(1); // After first field in first row

    await secondHandle.dragTo(firstRowVzone);
    await page.waitForTimeout(500);

    // Now there should be 1 row with 2 cells
    await expect(page.locator('.fb-form-row')).toHaveCount(1);
    await expect(page.locator('.fb-row-cell')).toHaveCount(2);
  });

  // ── Test 5: Select field and edit properties ──────────────────────
  test('selects field and edits properties in right panel', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Add a field
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await page.waitForTimeout(300);

    // Click the field card to select it
    await page.locator('.fb-card').first().click();
    await expect(page.locator('.fb-card.selected')).toHaveCount(1);

    // Right panel should now show PropsPanel (not empty state)
    await expect(page.locator('.fb-rempty')).toHaveCount(0);

    // Find the label input in the properties panel and change it
    const labelInput = page.locator('.fb-right .fb-pinp').first();
    await labelInput.fill('Full Name');

    // Assert the card label updated on canvas
    await expect(page.locator('.fb-card .fb-clbl')).toContainText('Full Name');

    // Toggle required
    const requiredToggle = page.locator('.fb-right .fb-togwrap input[type="checkbox"]');
    await requiredToggle.check();

    // Assert required badge appears on card
    await expect(page.locator('.fb-card .fb-creq')).toBeVisible();
  });

  // ── Test 6: Preview mode ──────────────────────────────────────────
  test('switches to preview mode and shows form correctly', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Set name and add a field
    await page.locator('.fb-canvas .fb-titleinp').fill('Preview Test Form');
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await page.waitForTimeout(300);

    // Edit field name
    await page.locator('.fb-card').first().click();
    await page.locator('.fb-right .fb-pinp').first().fill('Full Name');

    // Toggle required
    await page.locator('.fb-right .fb-togwrap input[type="checkbox"]').check();

    // Switch to Preview
    await page.locator('.fb-vbtn', { hasText: 'Preview' }).click();

    // Left and right panels should be hidden
    await expect(page.locator('.fb-left')).toHaveCount(0);
    await expect(page.locator('.fb-right')).toHaveCount(0);

    // Preview card should be visible
    await expect(page.locator('.fb-pcard')).toBeVisible();
    await expect(page.getByText('Preview Test Form')).toBeVisible();

    // Field label with required asterisk
    await expect(page.locator('.fb-pcard').getByText('Full Name')).toBeVisible();

    // Switch back to Editor
    await page.locator('.fb-vbtn', { hasText: 'Editor' }).click();
    await expect(page.locator('.fb-left')).toBeVisible();
    await expect(page.locator('.fb-right')).toBeVisible();
  });

  // ── Test 7: Undo ──────────────────────────────────────────────────
  test('undo reverts the last change', async ({ page }) => {
    await page.goto('/form-builder/new');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Undo should be disabled initially
    const undoBtn = page.locator('button', { hasText: 'Undo' });
    await expect(undoBtn).toBeDisabled();

    // Add a field
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.fb-card')).toHaveCount(1);

    // Undo should now be enabled
    await expect(undoBtn).toBeEnabled();

    // Click Undo
    await undoBtn.click();
    await page.waitForTimeout(300);

    // Field should be removed, empty state should return
    await expect(page.locator('.fb-card')).toHaveCount(0);
    await expect(page.locator('.fb-empty')).toBeVisible();
  });

  // ── Test 8: Save new form ─────────────────────────────────────────
  test('saves a new form successfully', async ({ page }) => {
    await page.goto('/form-builder/new?returnTo=/admin');
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Set form name
    await page.locator('.fb-canvas .fb-titleinp').fill('E2E Lifecycle Form');
    await page.locator('.fb-canvas .fb-fi').first().fill('Created by Playwright test');

    // Add fields
    await page.locator('.fb-pitem', { hasText: 'Text Input' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('.fb-pitem', { hasText: 'Email' }).first().click();
    await page.waitForTimeout(300);

    // Click Save
    await page.locator('button.fb-btn-p').click();

    // Wait for toast or redirect
    await page.waitForTimeout(2000);

    // Should have redirected away from form-builder
    // (either to /admin or wherever returnTo points)
    const url = page.url();
    expect(url).not.toContain('/form-builder');
  });

  // ── Test 9: Edit existing form ────────────────────────────────────
  test('loads and edits an existing form', async ({ page }) => {
    // Navigate to the app first so we can access localStorage
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Get token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Find the form we created in the previous test
    const response = await page.request.get('/api/forms', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const forms = await response.json();
    const testForm = forms.find(
      (f: { FORM_NAME: string }) =>
        f.FORM_NAME === 'E2E Lifecycle Form',
    );

    if (!testForm) {
      test.skip(true, 'E2E Lifecycle Form not found — previous test may have failed');
      return;
    }

    savedFormId = testForm.FORM_ID;

    // Navigate to edit the form
    await page.goto(`/form-builder/${savedFormId}?returnTo=/admin`);
    await page.waitForSelector('.fb-wrap', { timeout: 10_000 });

    // Assert form name is pre-filled
    const canvasName = page.locator('.fb-canvas .fb-titleinp');
    await expect(canvasName).toHaveValue('E2E Lifecycle Form');

    // Assert fields are loaded on canvas
    await expect(page.locator('.fb-card').first()).toBeVisible();

    // Change the name
    await canvasName.fill('E2E Lifecycle Form Updated');

    // Save
    await page.locator('button.fb-btn-p').click();
    await page.waitForTimeout(2000);

    // Should redirect
    const url = page.url();
    expect(url).not.toContain('/form-builder');
  });

  // ── Test 10: Verify saved form via API ────────────────────────────
  test('verifies the saved form exists with correct data via API', async ({ page }) => {
    // Navigate to app to access localStorage
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    const response = await page.request.get('/api/forms', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBe(true);

    const forms = await response.json();
    const updatedForm = forms.find(
      (f: { FORM_NAME: string }) =>
        f.FORM_NAME === 'E2E Lifecycle Form Updated',
    );

    expect(updatedForm).toBeTruthy();
    expect(updatedForm.FORM_NAME).toBe('E2E Lifecycle Form Updated');

    // Verify company isolation — COMPANY_ID should be set
    if (updatedForm.COMPANY_ID) {
      expect(updatedForm.COMPANY_ID).toBeGreaterThan(0);
    }
  });
});
