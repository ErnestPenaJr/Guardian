import { test, expect, type Page } from '@playwright/test';

/**
 * Create New Template Modal E2E
 *
 * Exercises the redesigned metadata modal reached from:
 *   Admin Dashboard → Workflow card → "Create New Template" button
 *
 * Covers: modal opens, Name validation gates Continue, description counter
 * clamps at 500, and audience → URL `isPublic` contract handed to the
 * Field Builder.
 */

async function openNewTemplateModal(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  // Open the Custom Workflow Templates modal via the Workflow card.
  await page.getByRole('heading', { name: 'Workflow' }).click();

  // Inside the Custom modal, click the top-right "Create New Template" button.
  // Empty states also render a button with the same label — .first() resolves it.
  await page
    .getByRole('button', { name: /create new template/i })
    .first()
    .click();

  // The new modal should render.
  await expect(page.locator('.ctm-card')).toBeVisible();
}

test.describe('Create New Template Modal', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens from Admin Dashboard via Workflow card', async ({ page }) => {
    await openNewTemplateModal(page);

    await expect(page.locator('#create-template-title')).toHaveText('Create New Template');
    await expect(page.getByLabel(/template name/i)).toBeVisible();
    await expect(page.getByLabel(/template type/i)).toBeVisible();
    await expect(page.getByLabel(/^description$/i)).toBeVisible();
    await expect(
      page.locator('.ctm-audience-card').filter({ hasText: 'Internal' })
    ).toBeVisible();
    await expect(
      page.locator('.ctm-audience-card').filter({ hasText: 'External' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue to field builder/i })
    ).toBeVisible();
  });

  test('Name is required — Continue disabled until typed', async ({ page }) => {
    await openNewTemplateModal(page);

    const continueBtn = page.getByRole('button', { name: /continue to field builder/i });
    await expect(continueBtn).toBeDisabled();

    await page.getByLabel(/template name/i).fill('My Test Template');
    await expect(continueBtn).toBeEnabled();

    // Whitespace-only should still be treated as empty.
    await page.getByLabel(/template name/i).fill('   ');
    await expect(continueBtn).toBeDisabled();
  });

  test('Description counter updates and clamps at 500 characters', async ({ page }) => {
    await openNewTemplateModal(page);

    const desc = page.getByLabel(/^description$/i);
    const counter = page.locator('.ctm-counter');

    await desc.fill('Hello');
    await expect(counter).toHaveText('5/500');

    // maxLength on the textarea should clamp input to 500 chars.
    await desc.fill('x'.repeat(600));
    await expect(desc).toHaveValue('x'.repeat(500));
    await expect(counter).toHaveText('500/500');
  });

  test('External-only audience → navigates with isInternal=false, isExternal=true', async ({ page }) => {
    await openNewTemplateModal(page);

    await page.getByLabel(/template name/i).fill('External Form');
    await page.getByLabel(/template type/i).selectOption('Survey');
    await page.getByLabel(/^description$/i).fill('A test form for external users');

    const externalCard = page.locator('.ctm-audience-card').filter({ hasText: 'External' });
    await externalCard.click();
    await expect(externalCard).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /continue to field builder/i }).click();
    await page.waitForURL(/\/form-builder\/new/);

    const url = new URL(page.url());
    expect(url.searchParams.get('name')).toBe('External Form');
    expect(url.searchParams.get('type')).toBe('Survey');
    expect(url.searchParams.get('description')).toBe('A test form for external users');
    expect(url.searchParams.get('isInternal')).toBe('false');
    expect(url.searchParams.get('isExternal')).toBe('true');
  });

  test('Internal-only audience → navigates with isInternal=true, isExternal=false', async ({ page }) => {
    await openNewTemplateModal(page);

    await page.getByLabel(/template name/i).fill('Internal Form');

    const internalCard = page.locator('.ctm-audience-card').filter({ hasText: 'Internal' });
    await internalCard.click();
    await expect(internalCard).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /continue to field builder/i }).click();
    await page.waitForURL(/\/form-builder\/new/);

    const url = new URL(page.url());
    expect(url.searchParams.get('name')).toBe('Internal Form');
    expect(url.searchParams.get('isInternal')).toBe('true');
    expect(url.searchParams.get('isExternal')).toBe('false');
  });

  test('Both audiences → navigates with isInternal=true, isExternal=true', async ({ page }) => {
    await openNewTemplateModal(page);

    await page.getByLabel(/template name/i).fill('Shared Form');

    const internalCard = page.locator('.ctm-audience-card').filter({ hasText: 'Internal' });
    const externalCard = page.locator('.ctm-audience-card').filter({ hasText: 'External' });
    await internalCard.click();
    await externalCard.click();
    await expect(internalCard).toHaveAttribute('aria-pressed', 'true');
    await expect(externalCard).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /continue to field builder/i }).click();
    await page.waitForURL(/\/form-builder\/new/);

    const url = new URL(page.url());
    expect(url.searchParams.get('name')).toBe('Shared Form');
    expect(url.searchParams.get('isInternal')).toBe('true');
    expect(url.searchParams.get('isExternal')).toBe('true');
  });
});
