import Database from 'better-sqlite3';
import fs from 'fs';
import { sha1 } from './util/hash.js';

const DB_PATH = 'flows.sqlite';
let db: Database.Database;

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '');
}
db = new Database(DB_PATH);

// Exported for test mocking
export function __setDb(testDb: Database.Database) {
  // @ts-ignore
  db = testDb;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS paths (
    pathId      TEXT PRIMARY KEY,
    firstSeen   TEXT,
    lastSeen    TEXT
  );
  CREATE TABLE IF NOT EXISTS steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pathId      TEXT,
    seq         INTEGER,
    url         TEXT,
    domHash     TEXT,
    screenshot  TEXT,
    UNIQUE(pathId, seq)
  );
`);

export interface StepInput {
  pathId: string;
  seq: number;
  url: string;
  dom: string;
  screenshot: string;
}

/**
 * Inserts or updates a step in the database.
 *
 * This function checks if a step at a given path and sequence already exists.
 * - If it doesn't exist, it inserts a new row.
 * - If it exists and the DOM hash is different, it updates the hash and screenshot.
 * - If it exists and the DOM hash is the same, it does nothing.
 *
 * @param step The step data to upsert.
 * @returns 'new' if the step was created, 'changed' if updated, 'same' if unchanged.
 */
export function upsertStep(step: StepInput): 'new' | 'changed' | 'same' {
  const hash = sha1(step.dom);
  const row  = db
    .prepare('SELECT domHash FROM steps WHERE pathId = ? AND seq = ?')
    .get(step.pathId, step.seq) as { domHash: string } | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO steps (pathId, seq, url, domHash, screenshot)
      VALUES (@pathId, @seq, @url, @hash, @screenshot)
    `).run({ ...step, hash });
    db.prepare(`
      INSERT OR IGNORE INTO paths(pathId, firstSeen, lastSeen)
      VALUES (@pathId, datetime('now'), datetime('now'))
    `).run({ pathId: step.pathId });
    return 'new';
  }

  if (row.domHash !== hash) {
    db.prepare(`
      UPDATE steps SET domHash = @hash, screenshot = @screenshot
      WHERE pathId = @pathId AND seq = @seq
    `).run({ ...step, hash });
    return 'changed';
  }
  
  touchPath(step.pathId);
  return 'same';
}

/**
 * Updates the lastSeen timestamp for a given path.
 * @param pathId The ID of the path to touch.
 */
export function touchPath(pathId: string) {
  db.prepare(`UPDATE paths SET lastSeen = datetime('now') WHERE pathId = ?`)
    .run(pathId);
} 