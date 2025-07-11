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

  const { LOGIN_URL, USERNAME, PASSWORD } = process.env;

  // Detect Razorpay login by URL pattern
  if (LOGIN_URL?.includes('dashboard.razorpay.com/signin')) {
    const page = await context.newPage();
    try {
      await page.goto(LOGIN_URL);

      // Step 1: Fill email/phone and click Continue
      const emailInput = page.getByPlaceholder('Enter your email or phone number');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(USERNAME!);
      await page.getByRole('button', { name: 'Continue' }).click();

      // Step 2: Fill password and click Sign In
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await passwordInput.fill(PASSWORD!);

      // Click the final submit and wait for the dashboard URL to load
      await page.getByRole('button', { name: 'Login' }).click();
      await page.waitForURL('**/dashboard**', { timeout: 15000 });

      await context.storageState({ path: 'auth.json' });
    } finally {
      await page.close();
    }
    return;
  }

  // Fallback to generic username/password login from .env
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