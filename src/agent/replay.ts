import { Page } from '@playwright/test';
import { Command } from '../types';
import { getAuthenticatedContext } from '../browser';

/**
 * Replays a sequence of commands on a page up to a specified depth.
 * 
 * @param startUrl The initial URL to navigate to
 * @param commands The full command log to replay
 * @param targetDepth The depth to replay up to (0-indexed)
 * @returns The final URL after replaying commands
 */
export async function replayToDepth(
  startUrl: string,
  commands: Command[],
  targetDepth: number
): Promise<{ url: string; page: Page }> {
  const browserOptions = (global as any).__browserOptions || {};
  const context = await getAuthenticatedContext(browserOptions);
  const page = await context.newPage();
  
  try {
    // Navigate to the starting URL
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    
    // Replay commands up to the target depth
    const commandsToReplay = commands.slice(0, targetDepth);
    
    for (const [index, command] of commandsToReplay.entries()) {
      console.log(`[REPLAY] Executing command ${index + 1}/${commandsToReplay.length}:`, command);
      
      switch (command.type) {
        case 'click':
          await page.waitForSelector(command.selector, { timeout: 10000 });
          await page.click(command.selector);
          await page.waitForLoadState('domcontentloaded');
          break;
          
        case 'fill':
          await page.waitForSelector(command.selector, { timeout: 10000 });
          await page.fill(command.selector, command.text);
          break;
          
        case 'select':
          await page.waitForSelector(command.selector, { timeout: 10000 });
          await page.selectOption(command.selector, command.value);
          break;
          
        case 'press':
          await page.waitForSelector(command.selector, { timeout: 10000 });
          await page.focus(command.selector);
          await page.keyboard.press(command.key);
          break;
          
        default:
          console.warn(`[REPLAY] Unknown command type: ${(command as any).type}`);
      }
    }
    
    const finalUrl = page.url();
    console.log(`[REPLAY] Completed replay at depth ${targetDepth}, final URL: ${finalUrl}`);
    
    return { url: finalUrl, page };
  } catch (error) {
    await page.close();
    throw error;
  }
}

/**
 * Replays commands and returns to a previous state by going back one step.
 * Useful for the recap node to try different paths.
 * 
 * @param startUrl The initial URL
 * @param commands The command log
 * @param currentDepth The current depth to go back from
 * @returns The state one step back
 */
export async function replayToPreviousState(
  startUrl: string,
  commands: Command[],
  currentDepth: number
): Promise<{ url: string; depth: number }> {
  if (currentDepth <= 0) {
    return { url: startUrl, depth: 0 };
  }
  
  const targetDepth = currentDepth - 1;
  const { url, page } = await replayToDepth(startUrl, commands, targetDepth);
  await page.close();
  
  return { url, depth: targetDepth };
} 