#!/usr/bin/env node
import { URL } from 'url';
import fs from 'fs';
import path from 'path';

/**
 * This script should be run by the assistant to generate context files
 * using the MCP Perplexity API
 */

const url = process.argv[2];
if (!url) {
  console.error('Usage: pnpm get-context <url>');
  process.exit(1);
}

const domain = new URL(url).hostname;
console.log(`Getting context for ${domain}...`);

// The assistant will use MCP Perplexity here and write the result
const contextDir = path.join(process.cwd(), 'contexts');
if (!fs.existsSync(contextDir)) {
  fs.mkdirSync(contextDir);
}

console.log(`Context should be saved to: contexts/${domain}.json`);
console.log('Please use MCP Perplexity to analyze this domain and save the results.'); 