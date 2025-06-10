import { chromium } from '@playwright/test';

export interface State { url: string; depth: number }

export async function runGraph(startUrl: string, maxDepth = 3): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  let depth = 0;
  let current = startUrl;

  while (depth < maxDepth) {
    await page.goto(current, { waitUntil: 'domcontentloaded' });

    // take a screenshot so later phases have an artefact
    await page.screenshot({ path: `traces/step-${depth}.png` });

    const next = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('a[href]');
      return a ? a.href : null;
    });
    if (!next) break;

    current = next;
    depth  += 1;
  }

  await browser.close();
} 