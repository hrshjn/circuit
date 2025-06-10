#!/usr/bin/env node
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { generateDoc } from '../src/markdown.js';
import 'dotenv/config';

/** find traces that changed in the current branch vs main */
const diffOutput = execSync(
  'git diff --name-only origin/main...HEAD',
  { encoding: 'utf-8' }
).split('\n');

const changedTraces = diffOutput.filter(f => f.startsWith('traces/'));
if (changedTraces.length === 0) {
  console.info('[docs-regen-diff] no traces changed; exiting');
  process.exit(0);
}

const db = new Database('flows.sqlite');
const stmt = db.prepare(`
  SELECT DISTINCT pathId
    FROM steps
   WHERE screenshot IN (${changedTraces.map(() => '?').join(',')})
`);
const pathIds = stmt.all(...changedTraces) as { pathId: string }[];

if (pathIds.length === 0) {
  console.info('[docs-regen-diff] no matching paths found');
  process.exit(0);
}

async function run() {
    console.info('[docs-regen-diff] regenerating', pathIds);
    await Promise.all(pathIds.map(p => generateDoc(p.pathId)));
}

run(); 