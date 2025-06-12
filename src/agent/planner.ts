import { Page } from '@playwright/test';
import { WebsiteContext } from './context';

export interface ExplorationPath {
  url: string;
  title: string;
  selector: string;
  priority: number; // Lower is higher priority
  explored: boolean;
}

/**
 * Creates a prioritized exploration plan based on the website's main navigation
 * and the context provided by Perplexity.
 *
 * @param page The Playwright page instance of the homepage.
 * @param context The website context from Perplexity.
 * @returns A promise that resolves to an array of exploration paths.
 */
export async function createExplorationPlan(
  page: Page,
  context: WebsiteContext,
): Promise<ExplorationPath[]> {
  console.log('[PLANNER] Creating exploration plan...');

  // 1. Identify primary navigation elements and extract their details in the browser context
  const paths = await page.$$eval(
    'nav a[href], [role="navigation"] a[href], [data-testid="sidebar"] a[href]',
    (elements, primaryFeatures) => {
      // This function runs in the browser, so we define a local version of bestSelector
      const bestSelector = (el: Element): string => {
        const id = el.getAttribute('id');
        if (id && !/(\d{4,}|floating-ui|generated|dynamic|temp)/.test(id)) return `#${CSS.escape(id)}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
        const role = el.getAttribute('role');
        const text = (el as HTMLElement).innerText?.trim().substring(0, 30);
        if (role && text) return `[role="${role}"]:has-text("${text}")`;
        if (text) return `${el.tagName.toLowerCase()}:has-text("${text}")`;
        return '';
      };

      const extractedPaths: ExplorationPath[] = [];
      for (const el of elements) {
        const anchor = el as HTMLAnchorElement;
        const href = anchor.getAttribute('href');
        const title = anchor.innerText;

        if (!href || !title || href === '#' || href.startsWith('javascript:')) {
          continue;
        }

        const fullUrl = new URL(href, window.location.href).toString();
        const selector = bestSelector(el);
        
        if (!selector) {
          continue;
        }

        let priority = 99;
        const titleLower = title.toLowerCase();
        const matchingFeature = primaryFeatures.find(feature =>
          titleLower.includes(feature.toLowerCase().split(' ')[0])
        );

        if (matchingFeature) {
          priority = primaryFeatures.indexOf(matchingFeature);
        }

        extractedPaths.push({
          url: fullUrl,
          title: title.trim(),
          selector,
          priority,
          explored: false,
        });
      }
      return extractedPaths;
    },
    context.primaryFeatures, // Pass primary features as an argument to $$eval
  );

  // 2. Deduplicate and sort the plan
  const uniquePaths = Array.from(new Map(paths.map(p => [p.url, p])).values());
  uniquePaths.sort((a, b) => a.priority - b.priority);

  console.log(`[PLANNER] Plan created with ${uniquePaths.length} primary paths.`);
  if (uniquePaths.length > 0) {
    console.log('[PLANNER] Top 3 paths:', uniquePaths.slice(0, 3).map(p => `${p.title} (P${p.priority})`));
  }
  
  return uniquePaths;
} 