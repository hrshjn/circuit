import fs from 'fs';
import path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import Database from 'better-sqlite3';

const db = new Database('flows.sqlite');
const llm = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.2 });

interface StepRow {
  seq: number;
  url: string;
  screenshot: string;
}

function getSteps(pathId: string): StepRow[] {
  return db.prepare(
    'SELECT seq, url, screenshot FROM steps WHERE pathId = ? ORDER BY seq'
  ).all(pathId) as StepRow[];
}

export async function generateDoc(pathId: string): Promise<void> {
  const steps = getSteps(pathId);
  if (steps.length === 0) {
    console.warn(`[markdown] no steps found for ${pathId}`);
    return;
  }

  /* ---- LLM prompt ---- */
  const outline = await llm.invoke([
    {
      role: 'system',
      content:
        'You are a technical writer. Produce a succinct step-by-step guide. Each step: "## Step n – Short title" then one-line description, then "![screenshot](<link>)". Keep it concise.'
    },
    {
      role: 'user',
      content: JSON.stringify(
        steps.map(s => ({
          step: s.seq + 1,
          url: s.url,
          screenshot: s.screenshot
        })),
        null,
        2
      )
    }
  ]);

  /* ---- write file ---- */
  const outDir  = path.join('docs', 'flows');
  const outPath = path.join(outDir, `${encodeURIComponent(pathId)}.md`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, outline.content.toString());
  console.info('[markdown] generated', outPath);
} 