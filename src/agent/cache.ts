import Database from 'better-sqlite3';

const CACHE_DB_PATH = 'llm-cache.db';
let db: Database.Database;

function getDb() {
  if (!db) {
    db = new Database(CACHE_DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS llm_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}

export function setCache(key: string, value: any): void {
  try {
    const db = getDb();
    const stmt = db.prepare('INSERT OR REPLACE INTO llm_cache (key, value) VALUES (?, ?)');
    stmt.run(key, JSON.stringify(value));
  } catch (error) {
    console.error('[CACHE] Error setting cache:', error);
  }
}

export function getCache(key: string): any | null {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT value FROM llm_cache WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  } catch (error) {
    console.error('[CACHE] Error getting cache:', error);
    return null;
  }
}

// For testing purposes
export function __closeDb() {
  if (db) {
    db.close();
    db = undefined as any;
  }
} 