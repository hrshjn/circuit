import { chromium } from '@playwright/test';
import fs from 'fs';
import { addStep, init } from './storage';
import { injectAuth } from './auth';

init();

type CrawlOptions = {
  headless?: boolean;
};

/**
 * Crawls a single URL, takes a screenshot, and stores it as a step in a flow.
 * It handles authentication and applies any configured URL variants.
 *
 * @param name The name of the flow.
 * @param url The URL to crawl.
 * @param options Optional settings for the crawl, like headless mode.
 */
export async function crawl(
  name: string,
  url: string,
  options?: CrawlOptions,
) {
  const browser = await chromium.launch({ headless: options?.headless });
  // Pass storageState to load cookies and other session data.
  const context = await browser.newContext({ storageState: 'auth.json' });

  // injectAuth will log in and create auth.json if it's missing.
  await injectAuth(context);

  const page = await context.newPage();
  const variant = process.env.FORCE_VARIANT || '';
  await page.goto(url + variant);

  const screenshotsDir = 'screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }
  const screenshotPath = `${screenshotsDir}/${name}-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await addStep(name, { url: page.url(), screenshot: screenshotPath });

  await browser.close();
}