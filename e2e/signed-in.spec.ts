import { test, expect } from '@playwright/test';

test('dashboard loads heading when signed in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
