#!/usr/bin/env node
import 'dotenv/config';
import { crawl } from '../src/crawl';
import { runGraph } from '../src/graph';
import { URL } from 'url';

function parseArgs(args: string[]) {
  const url = args.find(arg => arg.startsWith('http')) ?? 'https://example.com';
  const useGraph = args.includes('--graph');
  const headful = args.includes('--headful');
  const depthArg = args.find(arg => arg.startsWith('--depth='));
  const depth = depthArg ? parseInt(depthArg.split('=')[1], 10) : 3;
  
  return { url, useGraph, headful, depth };
}

async function main() {
  const { url, useGraph, headful, depth } = parseArgs(process.argv.slice(2));

  try {
    if (useGraph) {
      console.log(`Running graph-based crawl on ${url} (depth: ${depth}, headful: ${headful})`);
      await runGraph(url, { maxDepth: depth, headless: !headful });
    } else {
      console.log(`Running simple trace on ${url} (headful: ${headful})`);
      const flowName = new URL(url).hostname.replace(/\./g, '-');
      await crawl(flowName, url, { headless: !headful });
    }
    console.log('✅ Done.');
  } catch (error) {
    console.error('❌ Crawl failed:', error);
    process.exit(1);
  }
}

main(); 