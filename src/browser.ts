import { chromium, Browser, BrowserContext } from '@playwright/test';
import fs from 'fs';
import { injectAuth } from './auth';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let isTracing = false;

export async function getAuthenticatedContext(
  options: { 
    headless?: boolean;
    recordTrace?: boolean;
    recordVideo?: boolean;
  } = {},
): Promise<BrowserContext> {
  if (!browser) {
    const launchOptions: any = {
      headless: options.headless ?? true,
    };
    
    // Add video recording options
    if (options.recordVideo || options.recordTrace) {
      launchOptions.args = ['--disable-blink-features=AutomationControlled'];
    }
    
    browser = await chromium.launch(launchOptions);
  }

  const contextOptions: any = {};
  
  // Load authentication if available
  if (fs.existsSync('auth.json')) {
    contextOptions.storageState = 'auth.json';
  }
  
  // Configure video recording with better settings
  if (options.recordVideo) {
    contextOptions.recordVideo = {
      dir: 'traces/video',
      size: { width: 1280, height: 720 }
    };
    // Ensure video directory exists
    if (!fs.existsSync('traces/video')) {
      fs.mkdirSync('traces/video', { recursive: true });
    }
  }
  
  // Configure viewport for consistent recording
  contextOptions.viewport = { width: 1280, height: 720 };
  contextOptions.deviceScaleFactor = 1;
  
  const context = await browser.newContext(contextOptions);
  
  // Start tracing if requested
  if (options.recordTrace) {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });
  }
  
  // Inject authentication if needed
  await injectAuth(context);
  
  return context;
}

export async function closeBrowser() {
  if (context && isTracing) {
    // Save trace before closing
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await context.tracing.stop({ path: `traces/trace-${timestamp}.zip` });
    console.log(`[TRACE] Saved trace to traces/trace-${timestamp}.zip`);
    isTracing = false;
  }
  
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
} 