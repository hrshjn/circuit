import { chromium } from '@playwright/test';
import * as storage from './storage';
import path from 'path';
import fs from 'fs';

storage.init();

export interface State {
  url: string;
  depth: number;
}

export async function runGraph(
  startUrl: string,
  { maxDepth = 3, headless = true } = {},
): Promise<void> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  let depth = 0;
  let currentUrl = startUrl;
  const flowName = `graph-${new URL(startUrl).hostname}`;

  const screenshotsDir = 'screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  while (depth < maxDepth) {
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });

    const screenshotPath = `${screenshotsDir}/${flowName}-step-${depth}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await storage.addStep(flowName, {
      url: currentUrl,
      screenshot: screenshotPath,
    });

    const nextUrl = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('a[href]');
      return a ? a.href : null;
    });

    if (!nextUrl || nextUrl === currentUrl) break;

    currentUrl = nextUrl;
    depth += 1;
  }

  await browser.close();
} 