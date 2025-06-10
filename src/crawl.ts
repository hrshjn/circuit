import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { upsertStep } from './storage.js';

const AUTH_FILE = 'auth.json';
const TRACES_DIR = path.resolve(process.cwd(), 'traces');

export async function crawl(url: string, { headless } = { headless: true }) {
  console.log(`Starting crawl of: ${url}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });

  const page = await context.newPage();
  let navigationFailed = false;

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      console.error(`Navigation failed with status: ${response?.status()}`);
      navigationFailed = true;
    } else {
      await page.waitForLoadState('networkidle');

      const depth = 0; // Simple crawl is always at depth 0
      const screenshotPath = `traces/step-${depth}.png`;
      fs.mkdirSync(TRACES_DIR, { recursive: true });
      await page.screenshot({ path: screenshotPath });

      const dom = await page.content();
      const outcome = upsertStep({
        pathId: url, // For single-page crawl, pathId is the URL
        seq: depth,
        url: page.url(),
        dom,
        screenshot: screenshotPath,
      });
      console.info(`[storage] step ${depth}:`, outcome);
    }
  } catch (e) {
    console.error(`Error during navigation:`, e);
    navigationFailed = true;
  } finally {
    await context.close();
    await browser.close();

    if (navigationFailed) {
      process.exitCode = 1;
    }
  }
}

// Allow direct execution
if (process.argv[1] && (process.argv[1].endsWith('crawl.ts') || process.argv[1].endsWith('crawl.js'))) {
  const url = process.argv[2] ?? 'https://example.com';
  crawl(url);
} 