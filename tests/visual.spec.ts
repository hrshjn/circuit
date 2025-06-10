import { test, expect, chromium } from '@playwright/test';

test.describe('Visual regression – Razorpay happy path', () => {
  test('screens match golden refs', async ({ browserName }) => {
    // Use the same logic as linear crawler for reproducibility
    const browser  = await chromium.launch();
    const context  = await browser.newContext();
    const page     = await context.newPage();
    await page.goto('https://razorpay.com', { waitUntil: 'domcontentloaded' });

    // Page-level snapshot
    await expect(page).toHaveScreenshot('razorpay-home.png', {
      maxDiffPixelRatio: 0.03        // 3 % threshold
    });

    // Example element snapshot (hero section)
    const hero = page.locator('section:has-text("Power your finance")').first();
    await expect(hero).toHaveScreenshot('razorpay-hero.png', {
      maxDiffPixelRatio: 0.05
    });

    await browser.close();
  });
}); 