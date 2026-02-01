import { test, expect } from '@playwright/test';

test.describe('Swarm Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to swarm page from navbar', async ({ page }) => {
    // Click on Swarm button in navbar
    await page.click('a[href="/swarm"]');

    // Should be on swarm page
    await expect(page).toHaveURL('/swarm');
    await expect(page.locator('h1')).toContainText('Swarms');
  });

  test('should display swarm list', async ({ page }) => {
    await page.goto('/swarm');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should have swarm list or empty state
    const hasSwarms = await page.locator('[role="button"]').count() > 0;
    const hasEmptyState = await page.locator('text=No swarms yet').isVisible().catch(() => false);

    expect(hasSwarms || hasEmptyState).toBeTruthy();
  });

  test('should open create swarm dialog', async ({ page }) => {
    await page.goto('/swarm');

    // Click New Swarm button
    await page.click('button:has-text("New Swarm")');

    // Dialog should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Create New Swarm')).toBeVisible();
  });

  test('should create a new swarm', async ({ page }) => {
    await page.goto('/swarm');

    // Click New Swarm button
    await page.click('button:has-text("New Swarm")');

    // Fill the form
    await page.fill('input#swarm-name', 'Test Swarm E2E');
    await page.fill('textarea#swarm-description', 'Created by Playwright test');

    // Submit
    await page.click('button:has-text("Create Swarm")');

    // Should redirect to swarm detail page
    await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
  });

  test('should navigate to swarm detail page', async ({ page }) => {
    await page.goto('/swarm');

    // Wait for swarms to load
    await page.waitForLoadState('networkidle');

    // Click on first swarm card (if exists)
    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();

      // Should be on detail page
      await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);

      // Should have back button
      await expect(page.locator('text=Swarms')).toBeVisible();
    }
  });

  test('should show swarm detail components', async ({ page }) => {
    // First create or get a swarm
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();
      await page.waitForLoadState('networkidle');

      // Check for main components
      await expect(page.locator('text=Pending').first()).toBeVisible();
      await expect(page.locator('text=Running').first()).toBeVisible();
      await expect(page.locator('text=Completed').first()).toBeVisible();
    }
  });

  test('should pause and resume swarm', async ({ page }) => {
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();
      await page.waitForLoadState('networkidle');

      // Try to pause if active
      const pauseButton = page.locator('button:has-text("Pause")');
      const resumeButton = page.locator('button:has-text("Resume")');

      if (await pauseButton.isVisible()) {
        await pauseButton.click();
        await expect(resumeButton).toBeVisible({ timeout: 5000 });
      } else if (await resumeButton.isVisible()) {
        await resumeButton.click();
        await expect(pauseButton).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Projects Page', () => {
  test('should load projects page', async ({ page }) => {
    await page.goto('/projects');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should show projects or empty state
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Navigation', () => {
  test('should have working navbar links', async ({ page }) => {
    await page.goto('/');

    // Check navbar exists
    await expect(page.locator('nav, header')).toBeVisible();

    // Check Swarm link
    const swarmLink = page.locator('a[href="/swarm"]');
    await expect(swarmLink).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Start at projects
    await page.goto('/projects');
    await expect(page).toHaveURL('/projects');

    // Go to swarm
    await page.click('a[href="/swarm"]');
    await expect(page).toHaveURL('/swarm');

    // Go back to projects via menu
    await page.click('button[aria-label="Main navigation"]');
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL('/projects');
  });
});
