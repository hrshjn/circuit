#!/usr/bin/env node
import 'dotenv/config';
import { crawl } from '../src/crawl';
import { runGraph } from '../src/graph';
import { URL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

function parseArgs(args: string[]) {
  const url = args.find(arg => arg.startsWith('http')) ?? 'https://example.com';
  const useGraph = args.includes('--graph');
  const headful = args.includes('--headful');
  const depthArg = args.find(arg => arg.startsWith('--depth='));
  const depth = depthArg ? parseInt(depthArg.split('=')[1], 10) : 3;
  const trace = args.includes('--trace');
  const video = args.includes('--video');
  const debugUi = args.includes('--debug-ui');
  
  return { url, useGraph, headful, depth, trace, video, debugUi };
}

async function main() {
  const { url, useGraph, headful, depth, trace, video, debugUi } = parseArgs(process.argv.slice(2));
  const useLats = process.argv.slice(2).includes('--graph-lats');

  try {
    if (useLats) {
      console.log(`Running LATS agent on ${url} (depth: ${depth}, headful: ${headful})`);
      if (trace || video || debugUi) {
        console.log(`Recording enabled - trace: ${trace || debugUi}, video: ${video || debugUi}`);
      }
      const { runGraphLats } = await import('../src/agent/graph');
      await runGraphLats(url, depth, { 
        headless: !headful, 
        recordTrace: trace || debugUi,
        recordVideo: video || debugUi
      });
    } else if (useGraph) {
      console.log(`Running graph-based crawl on ${url} (depth: ${depth}, headful: ${headful})`);
      await runGraph(url, { maxDepth: depth, headless: !headful });
    } else {
      console.log(`Running simple trace on ${url} (headful: ${headful})`);
      const flowName = new URL(url).hostname.replace(/\./g, '-');
      await crawl(flowName, url, { headless: !headful });
    }
    console.log('✅ Done.');
    
    // If debug-ui flag is set, open the trace viewer
    if (debugUi) {
      const traces = fs.readdirSync('traces').filter(f => f.endsWith('.zip'));
      if (traces.length > 0) {
        // Get the most recent trace
        traces.sort();
        const latestTrace = traces[traces.length - 1];
        console.log(`\n🔍 Opening trace viewer for ${latestTrace}...`);
        await execAsync(`npx playwright show-trace traces/${latestTrace}`);
      } else {
        console.log('\n⚠️  No trace files found to open.');
      }
    }
  } catch (error) {
    console.error('❌ Crawl failed:', error);
    process.exit(1);
  }
}

main(); 