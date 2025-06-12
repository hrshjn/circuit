import { StateGraph } from '@langchain/langgraph';
import { Page } from '@playwright/test';
import { getWebsiteContext, getContextualFormValue, WebsiteContext } from './context';
import { pruneWithLLM, SystemError, rateLimiter, shouldPrune, Candidate } from './llm';
import { bestSelector } from './selector';
import { Command, readSteps, Step, writeStep } from '../storage';
import { createExplorationPlan, ExplorationPath } from './planner';

// 2️⃣ Define the state channel
interface AgentState {
  page: Page;
  context: WebsiteContext;
  // The overall exploration plan
  explorationPlan: ExplorationPath[];
  // The current high-level path being explored (e.g., "Payments")
  currentPath: ExplorationPath | null;
  // The sequence of commands taken to reach the current state
  commandLog: Command[];
  // The final list of candidates for the next action
  candidates: string[];
  // The objective for the current step
  objective: string;
  // A log of system errors
  systemErrors: SystemError[];
  // The final output of the agent
  output?: any;
}

// 3️⃣ Define the graph
const graph = new StateGraph<AgentState>({
  channels: {
    page: {
      value: (x: Page, y: Page) => y,
      default: () => undefined as any,
    },
    context: {
      value: (x: WebsiteContext, y: WebsiteContext) => y,
      default: () => ({} as any),
    },
    commandLog: {
      value: (x: Command[], y: Command[]) => x.concat(y),
      default: () => [],
    },
    candidates: {
      value: (x: string[], y: string[]) => y,
      default: () => [],
    },
    objective: {
      value: (x: string, y: string) => y,
      default: () => '',
    },
    systemErrors: {
      value: (x: SystemError[], y: SystemError[]) => x.concat(y),
      default: () => [],
    },
    explorationPlan: {
      value: (x: ExplorationPath[], y: ExplorationPath[]) => y,
      default: () => [],
    },
    currentPath: {
      value: (x: ExplorationPath | null, y: ExplorationPath | null) => y,
      default: () => null,
    },
    output: {
      value: (x: any, y: any) => y,
      default: () => undefined,
    },
  },
});

/**
 * Creates the initial exploration plan for the website.
 */
async function planner(state: AgentState): Promise<Partial<AgentState>> {
  const plan = await createExplorationPlan(state.page, state.context);
  return { explorationPlan: plan };
}

/**
 * Selects the next high-priority, unexplored path from the plan.
 */
async function selectNextPath(state: AgentState): Promise<Partial<AgentState>> {
  const nextPath = state.explorationPlan.find(p => !p.explored) || null;
  if (nextPath) {
    console.log(`[ROUTER] Selecting next path to explore: "${nextPath.title}"`);
    // Mark as explored immediately to avoid re-selection
    const updatedPlan = state.explorationPlan.map(p =>
      p.url === nextPath.url ? { ...p, explored: true } : p,
    );
    // Navigate to the starting URL for this path
    try {
      await state.page.goto(nextPath.url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e: any) {
      console.warn(`[ROUTER] Failed to navigate to ${nextPath.url}: ${e.message}. Skipping path.`);
      // Mark as explored even if it fails to avoid getting stuck
      return {
        currentPath: null,
        explorationPlan: state.explorationPlan.map(p =>
          p.url === nextPath.url ? { ...p, explored: true } : p,
        ),
      };
    }
    return {
      currentPath: nextPath,
      explorationPlan: updatedPlan,
      commandLog: [], // Reset command log for the new section
    };
  }
  console.log('[ROUTER] All paths have been explored.');
  return { currentPath: null };
}

/**
 * Proposes a set of candidate actions from the current page state.
 * If exploring a specific path, candidates are filtered to stay within that path.
 */
async function propose(state: AgentState): Promise<Partial<AgentState>> {
  await state.page.waitForLoadState('networkidle');

  // If a modal or tour is obscuring the page, try to close it first.
  const modalSelectors = '[role="dialog"], [aria-modal="true"]';
  const closeButtonSelectors = 'button[aria-label*="close"], button[aria-label*="Close"], [role="button"][aria-label*="close"], [role="button"][aria-label*="Close"]';
  const isModalVisible = await state.page.$(modalSelectors);

  if (isModalVisible) {
    const closeButton = await state.page.$(closeButtonSelectors);
    if (closeButton) {
      console.log('[PROPOSE] Closing modal...');
      await closeButton.click();
      await state.page.waitForLoadState('networkidle');
    }
  }

  // Define Candidate type locally for browser context
  interface BrowserCandidate {
    selector: string;
    text?: string;
  }

  // Collect all potential candidate elements using page.$$eval for robustness
  const candidateObjects: BrowserCandidate[] = await state.page.$$eval(
    'a[href], button, [role="button"], [role="link"], [onclick]',
    (elements, currentPathUrl) => {
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

        interface BrowserCandidate {
          selector: string;
          text?: string;
        }

        const candidates: BrowserCandidate[] = [];
        for (const el of elements) {
            const selector = bestSelector(el);
            if (selector) {
                if (currentPathUrl) {
                    const href = el.getAttribute('href');
                    if (href) {
                        const absoluteUrl = new URL(href, window.location.href).href;
                        const isSubPath = absoluteUrl.startsWith(currentPathUrl);
                        const isBasePath = new URL(absoluteUrl).pathname === new URL(currentPathUrl).pathname;
                        if (!isSubPath && !isBasePath) {
                            continue;
                        }
                    }
                }
                candidates.push({ selector, text: (el as HTMLElement).innerText });
            }
        }
        return candidates;
    },
    state.currentPath?.url
  );

  let candidates = [...new Set(candidateObjects.map(c => c.selector))];
  let systemErrors: SystemError[] = [];

  // Prune candidates using LLM if the list is too long
  let best_ctas = candidates;
  if (shouldPrune(candidates.length)) {
    console.log(`[PROPOSE] Too many candidates (${candidates.length}), pruning with LLM...`);
    const bodyText = await state.page.evaluate(() => document.body.innerText.slice(0, 5000));
    const llmObjective = `The user wants to explore the page: ${state.page.url()}. The current high-level goal is to explore "${state.currentPath?.title}".`;

    // Convert to Candidate type expected by pruneWithLLM
    const candidatesForLLM: Candidate[] = candidateObjects.map(c => ({
      selector: c.selector,
      text: c.text
    }));

    const { candidates: pruned_candidates, errors } = await rateLimiter(
      () => pruneWithLLM(candidatesForLLM, bodyText, llmObjective),
    );
    best_ctas = pruned_candidates;
    systemErrors = errors;
  }

  return {
    candidates: best_ctas,
    systemErrors,
    objective: `The user wants to explore the page: ${state.page.url()}. The current high-level goal is to explore "${state.currentPath?.title}".`,
  };
}

/**
 * Executes the chosen command and updates the agent's state.
 */
async function execute(state: AgentState): Promise<Partial<AgentState>> {
  const { candidates, page, context, commandLog } = state;
  if (!candidates.length) {
    return { commandLog: [] };
  }

  const selector = candidates[0];
  let command: Command;

  // Check if it's a form element we need to fill
  const isFormElement = await page.$eval(selector, el => {
    return (
      el.tagName === 'INPUT' &&
      (el.getAttribute('type') === 'text' ||
        el.getAttribute('type') === 'search' ||
        el.getAttribute('type') === 'email' ||
        el.getAttribute('type') === 'password')
    );
  }).catch(() => false);

  if (isFormElement) {
    // Get input attributes to pass to getContextualFormValue
    const inputInfo = await page.$eval(selector, el => {
      const input = el as HTMLInputElement;
      return {
        type: input.getAttribute('type') || 'text',
        name: input.getAttribute('name') || '',
        placeholder: input.getAttribute('placeholder') || ''
      };
    });
    
    const value = getContextualFormValue(
      inputInfo.type,
      inputInfo.name,
      inputInfo.placeholder,
      context
    );
    command = { command: 'fill', selector, value };
    console.log(`[EXECUTE] Filling ${selector} with "${value}"`);
    await page.fill(selector, value);
    // Add a wait for network idle after filling and submitting
    await page.waitForTimeout(1000); // Small delay for search to trigger
    await page.press(selector, 'Enter');
  } else {
    command = { command: 'click', selector };
    console.log(`[EXECUTE] Clicking ${selector}`);
    await page.click(selector, { timeout: 5000 }).catch(e => {
        console.warn(`[EXECUTE] Click failed for selector ${selector}: ${(e as Error).message}. It might have been a stale element.`)
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.warn("[EXECUTE] Network idle timeout after action. The page might still be loading or it's a single-page app.");
  });
  
  // Write the step to storage
  await writeStep({
    url: page.url(),
    commandLog: [...commandLog, command],
  });

  return {
    commandLog: [command],
    candidates: candidates.slice(1),
  };
}

/**
 * The final node in the graph, preparing the output.
 */
function done(state: AgentState): Partial<AgentState> {
  console.log('[AGENT] Crawl complete.');
  return { output: 'Crawl finished successfully.' };
}

// 4️⃣ Define conditional edges

function shouldContinue(state: AgentState): 'propose' | 'selectNextPath' {
  // If there are no more candidates, the current path is fully explored.
  if (state.candidates.length === 0) {
    console.log(`[ROUTER] Finished exploring path: "${state.currentPath?.title}". Selecting next path.`);
    return 'selectNextPath';
  }
  // If the command log gets too deep, we might have gotten stuck in a loop.
  if (state.commandLog.length > 20) {
    console.warn('[ROUTER] Path is too deep, moving to next section to avoid loop.');
    return 'selectNextPath';
  }
  // Otherwise, continue exploring the current path.
  return 'propose';
}

// 5️⃣ Build the graph
graph.addNode('planner', planner);
graph.addNode('selectNextPath', selectNextPath);
graph.addNode('propose', propose);
graph.addNode('execute', execute);
graph.addNode('done', {
  invoke: done,
});

graph.setEntryPoint('planner');
graph.addEdge('planner', 'selectNextPath');

// After selecting a path, either propose actions or finish if no paths are left
graph.addConditionalEdges('selectNextPath', (state) => {
  return state.currentPath ? 'propose' : 'done';
});

// After proposing, execute the first candidate
graph.addEdge('propose', 'execute');

// After executing, decide whether to continue on the current path or select a new one
graph.addConditionalEdges('execute', shouldContinue);

const app = graph.compile();
export { app }; 