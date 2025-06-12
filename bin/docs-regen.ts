#!/usr/bin/env node
import 'dotenv/config';
import { generateDoc } from '../src/markdown';
import {
  getModifiedFlows,
  markAllFlowsAsDocumented,
  getAllFlows,
} from '../src/storage';

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const changed = args.includes('--changed');
  const specificFlow = args.find((arg) => !arg.startsWith('--'));

  let flowsToDocument: { name: string }[] = [];

  if (specificFlow) {
    flowsToDocument = [{ name: specificFlow }];
  } else if (changed) {
    flowsToDocument = getModifiedFlows();
  } else {
    // Default to all flows if no specific flag is given
    flowsToDocument = getAllFlows();
  }

  if (flowsToDocument.length === 0) {
    console.log('No flows found to document.');
    return;
  }

  for (const flow of flowsToDocument) {
    console.log(`Generating documentation for flow: ${flow.name}`);
    await generateDoc(flow.name);
  }

  markAllFlowsAsDocumented();
  console.log('Documentation generation complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 