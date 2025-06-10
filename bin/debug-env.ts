#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log(`Attempting to load .env file from path: ${envPath}`);

const result = dotenv.config({ path: envPath, debug: true });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Successfully loaded and parsed .env file.');
  console.log('--- Parsed Key-Value Pairs ---');
  console.log(result.parsed);
  console.log('------------------------------');
  console.log('Value of process.env.LOGIN_URL:', process.env.LOGIN_URL);
} 