import { test as setup } from '@playwright/test';
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

setup('global setup', async ({ page }) => {
  await clerkSetup();

  const username = process.env.E2E_CLERK_USER_USERNAME;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!username) {
    throw new Error('E2E_CLERK_USER_USERNAME is not set in environment');
  }
  if (!password) {
    throw new Error('E2E_CLERK_USER_PASSWORD is not set in environment');
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
