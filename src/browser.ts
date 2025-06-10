import { chromium, Browser, BrowserContext } from '@playwright/test';
import fs from 'fs';
import { injectAuth } from './auth';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function getAuthenticatedContext(
  options: { headless?: boolean } = {},
): Promise<BrowserContext> {
  if (context) {
    return context;
  }

  browser = await chromium.launch({ headless: options.headless });
  const storageState = fs.existsSync('auth.json') ? 'auth.json' : undefined;
  context = await browser.newContext({ storageState });

  await injectAuth(context);

  return context;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
} 