import { StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { getAuthenticatedContext, closeBrowser } from '../browser';
import * as storage from '../storage';
import fs from 'fs';
import crypto from 'crypto';

// 1️⃣  Define channels
const stateSchema = z.object({
  url: z.string(),
  depth: z.number(),
  maxDepth: z.number(),
  visitedUrls: z.array(z.string()).optional(),
  candidates: z.array(z.string()).optional(),
  score: z.number().optional(),
});

type State = z.infer<typeof stateSchema>;

const graph = new StateGraph<State>({
  // The user-provided shim accepts `any`, so we use this structure.
  channels: {
    url: {
      value: (x: string, y: string) => y,
      default: () => '',
    },
    depth: {
      value: (x: number, y: number) => y,
      default: () => 0,
    },
    maxDepth: {
      value: (x: number, y: number) => y,
      default: () => 3,
    },
    // Replace candidates list at each step
    candidates: {
      value: (_: string[], y: string[]) => y,
      default: () => [],
    },
    score: {
      value: (x: number, y: number) => y,
      default: () => 0,
    },
  },
});

// 2️⃣  Nodes must pass through unchanged keys
graph.addNode('propose', async (state: State) => {
  console.log(`[LATS] Proposing actions for URL: ${state.url}`);
  const context = await getAuthenticatedContext();
  const page = await context.newPage();
  try {
    await page.goto(state.url, { waitUntil: 'domcontentloaded' });

    const visited = new Set(state.visitedUrls || []);
    visited.add(state.url); // Add current URL to visited set

    const links = await page.$$eval('a[href]', (anchors) =>
      (anchors as HTMLAnchorElement[]).map((a) => a.href),
    );

    const validLinks = links.filter(
      (link) =>
        link &&
        (link.startsWith('http://') || link.startsWith('https://')) &&
        link !== state.url &&
        !visited.has(link),
    );

    const uniqueLinks = [...new Set(validLinks)]; // Deduplicate candidates for this step
    console.log(`[LATS] Found ${uniqueLinks.length} new unique candidates.`);
    return {
      candidates: uniqueLinks,
      visitedUrls: Array.from(visited),
    };
  } finally {
    await page.close();
  }
});

graph.addNode('execute', async (state: State) => {
  if (!state.candidates || state.candidates.length === 0) {
    console.log('[LATS] No candidates to execute.');
    return {};
  }

  // Reverting to single-candidate, deterministic execution for stability.
  const index = state.depth % state.candidates.length;
  const actionUrl = state.candidates[index];
  console.log(
    `[LATS] Executing action: navigating to candidate #${index}: ${actionUrl}`,
  );

  const context = await getAuthenticatedContext();
  const page = await context.newPage();
  try {
    await page.goto(actionUrl, { waitUntil: 'domcontentloaded' });
    const nextUrl = page.url();

    const urlHash = crypto.createHash('sha1').update(nextUrl).digest('hex');
    const screenshotPath = `screenshots/${Date.now()}-${urlHash}.png`;
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await storage.addStep(`lats-${new URL(state.url).hostname}`, {
      url: nextUrl,
      screenshot: screenshotPath,
    });

    const visited = new Set(state.visitedUrls || []);
    visited.add(nextUrl);

    return {
      url: nextUrl,
      depth: state.depth + 1,
      candidates: [],
      visitedUrls: Array.from(visited),
    };
  } finally {
    await page.close();
  }
});

graph.addNode('evaluate', async (state: State) => {
  console.log(`[LATS] Evaluating result for URL: ${state.url}`);
  return { score: 1 / (state.depth + 1) }; // nothing else changes
});

// 3️⃣  Set entry point and conditional edge
graph.setEntryPoint('propose');
graph.addEdge('propose', 'execute');
graph.addEdge('execute', 'evaluate');
graph.addConditionalEdges(
  'evaluate',
  (s: State) => (s.depth < s.maxDepth ? 'propose' : '__end__'),
  {
    propose: 'propose',
    __end__: '__end__',
  },
);

// 4️⃣  runGraphLats: include maxDepth in the initial invoke
export async function runGraphLats(startUrl: string, maxDepth = 3) {
  const app = graph.compile();
  console.log(
    `[LATS] Starting graph execution for ${startUrl} with max depth ${maxDepth}`,
  );
  await app.invoke({
    url: startUrl,
    depth: 0,
    maxDepth: maxDepth,
  });
  console.log('[LATS] Graph execution finished.');
  await closeBrowser();
} 