#!/usr/bin/env node
import 'dotenv/config';
import { generateDoc } from '../src/markdown.js';
import Database from 'better-sqlite3';

const db = new Database('flows.sqlite');
const arg = process.argv[2];

async function main() {
    const paths =
      !arg || arg === '--all'
        ? (db.prepare('SELECT pathId FROM paths').all() as { pathId: string }[])
        : [{ pathId: arg }];
    
    for (const { pathId } of paths) {
      await generateDoc(pathId);
    }
}

main(); 