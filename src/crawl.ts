import { addStep } from './storage';
import { getAuthenticatedContext, closeBrowser } from './browser';
import fs from 'fs';

type CrawlOptions = {
  headless?: boolean;
};

/**
 * Crawls a single URL, takes a screenshot, and stores it as a step in a flow.
 * It uses the shared, authenticated browser context.
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
  const context = await getAuthenticatedContext(options);
  const page = await context.newPage();
  try {
    const variant = process.env.FORCE_VARIANT || '';
    const fullUrl = url + variant;
    await page.goto(fullUrl);

    const screenshotsDir = 'screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    const screenshotPath = `${screenshotsDir}/${name}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await addStep(name, { url: fullUrl, screenshot: screenshotPath });
  } finally {
    await page.close();
    await closeBrowser();
  }
}