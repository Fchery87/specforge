import { test, expect } from '@playwright/test';

test('landing loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SpecForge|specforge/i);
});

test('unauthenticated dashboard redirects to sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/sign-in/);
});

test('sign-in renders the Clerk component', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('body')).toContainText(/sign in|welcome back/i);
});

test('protected project creation route redirects to sign-in', async ({ page }) => {
  await page.goto('/dashboard/new');
  await expect(page).toHaveURL(/sign-in/);
});
