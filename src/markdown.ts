import fs from 'fs';
import path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { getFlowSteps } from './storage';

const llm = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.2 });

export async function generateDoc(flowName: string): Promise<void> {
  const steps = getFlowSteps(flowName);
  if (steps.length === 0) {
    console.warn(`[markdown] no steps found for ${flowName}`);
    return;
  }

  /* ---- LLM prompt ---- */
  const outline = await llm.invoke([
    {
      role: 'system',
      content:
        'You are a technical writer. Produce a succinct step-by-step guide. Each step: "## Step n – Short title" then one-line description, then "![screenshot](<link>)". Keep it concise.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        steps.map((s, i) => ({
          step: i + 1,
          url: s.url,
          screenshot: s.screenshot,
        })),
        null,
        2,
      ),
    },
  ]);

  /* ---- write file ---- */
  const outDir = path.join('docs', 'flows');
  const outPath = path.join(outDir, `${encodeURIComponent(flowName)}.md`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, outline.content.toString());
  console.info('[markdown] generated', outPath);
} 