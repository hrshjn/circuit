#!/usr/bin/env node
import 'dotenv/config';
import { exec } from 'child_process';
import { runGraph } from '../src/graph.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const args = process.argv.slice(2);
    const useGraph = args.includes('--graph');
    const url = args.find(arg => arg.startsWith('http')) ?? 'https://example.com';
    
    const depthArg = args.find(arg => arg.startsWith('--depth='));
    const depth = depthArg ? parseInt(depthArg.split('=')[1], 10) : undefined;

    if (useGraph) {
        console.log('Running with LangGraph...');
        await runGraph(url, depth);
    } else {
        console.log('Running simple crawl...');
        const crawlScriptPath = path.resolve(__dirname, '../src/crawl.ts');
        const command = `tsx ${crawlScriptPath} ${url}`;
        
        const child = exec(command);
        child.stdout?.pipe(process.stdout);
        child.stderr?.pipe(process.stderr);

        child.on('close', (code) => {
            process.exit(code ?? 0);
        });
    }
}

main(); 