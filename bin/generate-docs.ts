#!/usr/bin/env node
import { generateDocumentation, generateSummaryReport } from '../src/agent/documentation';
import * as storage from '../src/storage';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    // Generate docs for all flows
    const flows = storage.getAllFlows();
    for (const flow of flows) {
      await generateDocumentation(flow.name);
    }
    await generateSummaryReport();
  } else if (args.length > 0) {
    // Generate docs for specific flows
    for (const flowName of args) {
      await generateDocumentation(flowName);
    }
  } else {
    // Generate docs for modified flows
    const modifiedFlows = storage.getModifiedFlows();
    if (modifiedFlows.length === 0) {
      console.log('[DOCS] No new or modified flows to document.');
      return;
    }
    for (const flow of modifiedFlows) {
      await generateDocumentation(flow.name);
    }
    await generateSummaryReport();
  }
  
  // Mark all flows as documented
  storage.markAllFlowsAsDocumented();
}

main().catch(console.error); 