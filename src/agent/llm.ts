import Bottleneck from 'bottleneck';
import { OpenAI } from 'openai';
import { createHash } from 'crypto';

export interface Candidate {
  selector: string;
  text?: string;
}

export interface SystemError {
  type: 'llm_error' | 'cache_error';
  message: string;
}

export function shouldPrune(candidateCount: number): boolean {
  const threshold = process.env.LLM_PRUNE_THRESHOLD ? parseInt(process.env.LLM_PRUNE_THRESHOLD, 10) : 20;
  return candidateCount > threshold;
}

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1000,
});

export const rateLimiter = <T>(fn: (...args: any[]) => Promise<T>) => {
  return limiter.schedule(() => fn());
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Prunes a list of candidates using an LLM to select the most promising CTAs.
 * @param candidates The full list of candidate selectors.
 * @param page The Playwright page instance for context.
 * @param objective The high-level objective for the current crawl step.
 * @returns A list of the best candidate selectors.
 */
export async function pruneWithLLM(
  candidates: Candidate[],
  html: string,
  objective: string,
): Promise<{ candidates: string[]; errors: SystemError[] }> {
  const errors: SystemError[] = [];
  const maxResults = 8;
  
  const prompt = `
You are an expert web crawler. Based on the following HTML snippet and the user's objective, identify the top ${maxResults} most important calls-to-action (CTAs) from the provided list of candidates.

Objective: "${objective}"

HTML Snippet:
\`\`\`html
${html.slice(0, 4000)}
\`\`\`

Candidate Selectors (with their visible text):
${candidates
  .map((c, i) => `${i}. ${c.selector} ("${c.text}")`)
  .join('\n')}

Respond with a JSON array of the integer indices corresponding to the best CTAs from the list above. For example: [0, 5, 12]
`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const choice = response.choices[0].message?.content;
    if (!choice) {
      throw new Error('LLM returned an empty choice.');
    }

    const jsonResponse = choice.replace(/```json|```/g, '').trim();
    const selectedIndices = JSON.parse(jsonResponse) as number[];

    const prunedCandidates = selectedIndices
      .filter(i => i >= 0 && i < candidates.length)
      .map(i => candidates[i].selector);

    console.log(`[LLM] Pruned to ${prunedCandidates.length} candidates`);
    return { candidates: prunedCandidates, errors };

  } catch (error) {
    console.error('[LLM] Pruning failed:', error);
    const fallbackCandidates = candidates.slice(0, maxResults).map(c => c.selector);
    return { candidates: fallbackCandidates, errors: [{ type: 'llm_error', message: (error as Error).message }] };
  }
} 