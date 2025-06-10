import { BrowserContext } from '@playwright/test';
import fs from 'fs';

/**
 * Injects authentication into the browser context.
 * It first checks if an auth file exists. If it does, it assumes Playwright's
 * `storageState` has already loaded it. If not, it performs a login using
 * credentials from environment variables and saves the session to `auth.json`.
 *
 * @param context The browser context to authenticate.
 */
export async function injectAuth(context: BrowserContext) {
  // If auth.json exists, we assume Playwright has loaded it via storageState.
  // We only intervene if the file is missing.
  if (fs.existsSync('auth.json')) {
    return;
  }

  // Fallback to username/password login from .env
  const { LOGIN_URL, USERNAME, PASSWORD } = process.env;
  if (LOGIN_URL && USERNAME && PASSWORD) {
    const page = await context.newPage();
    try {
      await page.goto(LOGIN_URL);
      await page.fill('input[name="email"]', USERNAME);
      await page.fill('input[type="password"]', PASSWORD);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('button[type="submit"]'),
      ]);
      await context.storageState({ path: 'auth.json' });
    } finally {
      await page.close();
    }
  }
} 