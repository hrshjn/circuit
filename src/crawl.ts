import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = 'auth.json';
const TRACES_DIR = path.resolve(process.cwd(), 'traces');

async function main() {
  const url = process.argv[2] ?? 'https://example.com';
  console.log(`Starting crawl of: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
  });

  const page = await context.newPage();
  let navigationFailed = false;

  try {
    const response = await page.goto(url);
    if (!response || !response.ok()) {
      console.error(`Navigation failed with status: ${response?.status()}`);
      navigationFailed = true;
    } else {
      await page.waitForLoadState('networkidle');
    }
  } catch (e) {
    console.error(`Error during navigation:`, e);
    navigationFailed = true;
  } finally {
    fs.mkdirSync(TRACES_DIR, { recursive: true });
    const tracePath = path.join(TRACES_DIR, `trace-${Date.now()}.zip`);
    
    await context.tracing.stop({ path: tracePath });
    console.log(`Trace file saved to: ${path.resolve(tracePath)}`);

    await context.close();
    await browser.close();

    if (navigationFailed) {
      process.exitCode = 1;
    }
  }
}

main(); 