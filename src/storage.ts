import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { Command, Step } from './types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { sha1 } from './util/hash';

const DB_PATH = 'flows.sqlite';
let db = new Database(DB_PATH);

const s3 = process.env.S3_BUCKET ? new S3Client({ region: 'auto' }) : null;

/**
 * For test environments, allows swapping the database instance.
 * @param testDb An instance of `better-sqlite3`.
 * @internal
 */
export function __setDb(testDb: Database.Database) {
  db = testDb;
}

/**
 * Uploads a file to an S3 bucket if configured via environment variables.
 * If not configured, it returns the local path.
 *
 * @param localPath The path to the file on the local filesystem.
 * @returns A promise that resolves to the S3 URL or the original local path.
 */
async function uploadIfS3(localPath: string): Promise<string> {
  if (!s3 || !process.env.S3_BUCKET) {
    return localPath;
  }
  const key = `screenshots/${path.basename(localPath)}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fs.readFileSync(localPath),
    }),
  );
  const region = await s3.config.region();
  return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Initializes the database by creating the necessary tables if they do not already exist.
 * This sets up the schema for storing flows and their corresponding steps.
 */
export function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      lastRun TEXT
    );
    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flow_id INTEGER NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      screenshot TEXT NOT NULL,
      commandLog TEXT,
      FOREIGN KEY (flow_id) REFERENCES flows(id)
    );
  `);
  
  // Add the commandLog column if it doesn't exist (for existing databases)
  const columns = db.prepare("PRAGMA table_info(steps)").all() as Array<{name: string}>;
  if (!columns.some(col => col.name === 'commandLog')) {
    db.exec('ALTER TABLE steps ADD COLUMN commandLog TEXT');
  }
}

/**
 * Retrieves the ID of a flow by its name. If the flow does not exist, it is created.
 *
 * @param name The name of the flow.
 * @returns The integer ID of the flow.
 */
function getFlowId(name: string): number {
  let flow = db.prepare('SELECT id FROM flows WHERE name = ?').get(name) as
    | { id: number }
    | undefined;
  if (!flow) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO flows (name) VALUES (?)')
      .run(name);
    flow = { id: lastInsertRowid as number };
  }
  return flow.id;
}

/**
 * Adds a new step to a specified flow. The step is identified by its content hash
 * to avoid duplicates. The screenshot may be offloaded to S3.
 *
 * @param name The name of the flow.
 * @param step An object containing the URL and local path to the screenshot.
 */
export async function addStep(
  name: string,
  step: {
    url: string;
    screenshot: string;
    commandLog?: Command[];
  },
) {
  const screenshotUrl = await uploadIfS3(step.screenshot);
  const flowId = getFlowId(name);
  const stepHash = sha1(JSON.stringify({ 
    name, 
    url: step.url, 
    commandLog: step.commandLog 
  }));

  db.prepare(
    `INSERT INTO steps (flow_id, hash, url, screenshot, commandLog)
     VALUES (@flowId, @hash, @url, @screenshot, @commandLog)
     ON CONFLICT(hash) DO NOTHING`,
  ).run({
    flowId,
    hash: stepHash,
    url: step.url,
    screenshot: screenshotUrl,
    commandLog: step.commandLog ? JSON.stringify(step.commandLog) : null,
  });
}

/**
 * Retrieves all steps associated with a given flow name.
 *
 * @param name The name of the flow.
 * @returns An array of step objects.
 */
export function getFlowSteps(name: string): { 
  url: string; 
  screenshot: string;
  commandLog?: Command[];
}[] {
  const flowId = getFlowId(name);
  const steps = db
    .prepare('SELECT url, screenshot, commandLog FROM steps WHERE flow_id = ?')
    .all(flowId) as { url: string; screenshot: string; commandLog: string | null }[];
  
  return steps.map(step => ({
    url: step.url,
    screenshot: step.screenshot,
    commandLog: step.commandLog ? (JSON.parse(step.commandLog) as Command[]) : [],
  }));
}

/**
 * Retrieves the names of all flows stored in the database.
 *
 * @returns An array of objects, each containing the name of a flow.
 */
export function getAllFlows(): { name: string }[] {
  return db.prepare('SELECT name FROM flows').all() as { name: string }[];
}

/**
 * Retrieves the names of all flows that have been modified since the last documentation generation.
 *
 * @returns An array of flow names.
 */
export function getModifiedFlows(): { name: string }[] {
  return db
    .prepare(
      `
    SELECT f.name
    FROM flows f
    LEFT JOIN steps s ON f.id = s.flow_id
    GROUP BY f.name
    HAVING f.lastRun IS NULL OR MAX(s.id) > (SELECT COALESCE(MAX(id), 0) FROM steps WHERE flow_id = f.id)
  `,
    )
    .all() as { name: string }[];
}

/**
 * Updates the `lastRun` timestamp for all flows to the current time.
 */
export function markAllFlowsAsDocumented() {
  db.prepare(`UPDATE flows SET lastRun = datetime('now')`).run();
}

export async function writeStep(step: Step) {
  const commandLogJson = JSON.stringify(step.commandLog);
  const hash = createHash('sha256')
    .update(step.url + commandLogJson)
    .digest('hex');

  const stmt = db.prepare(
    'INSERT OR REPLACE INTO steps (hash, url, command_log) VALUES (?, ?, ?)',
  );
  stmt.run(hash, step.url, commandLogJson);
  console.log(`[STORAGE] Wrote step for URL: ${step.url}`);
}

export async function readSteps(): Promise<Step[]> {
  const stmt = db.prepare('SELECT url, command_log FROM steps ORDER BY timestamp ASC');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    url: row.url,
    commandLog: JSON.parse(row.command_log),
  }));
}

// Keeping legacy functions for now to prevent widespread errors.
export function getFlow(flowId: string) {
  return db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
}
export function upsertFlow(flowId: string, startUrl: string) {
    const stmt = db.prepare('INSERT OR REPLACE INTO flows (id, startUrl) VALUES (?, ?)');
    stmt.run(flowId, startUrl);
}
export function recordRun(flowId: string) {
    db.prepare(`UPDATE flows SET lastRun = datetime('now')`).run();
}

export { Command, Step };