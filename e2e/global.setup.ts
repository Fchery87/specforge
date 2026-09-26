import { test as setup } from '@playwright/test';
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

setup('global setup', async ({ page }) => {
  await clerkSetup();

  const username = process.env.E2E_CLERK_USER_USERNAME?.trim();
  const password = process.env.E2E_CLERK_USER_PASSWORD?.trim();

  if (!username || !password) {
    setup.skip(!username || !password, 'Clerk test credentials not provided');
    return;
  }

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: username,
      password,
    },
  });

  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const authFile = path.join(authDir, 'user.json');
  await page.context().storageState({ path: authFile });
});
