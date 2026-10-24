import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Minimal typing for `node:sqlite` (Node 22). The installed @types/node (v20) does not ship it,
// so the module is loaded with `process.getBuiltinModule` and typed here.
export type SqlValue = null | number | bigint | string | Uint8Array;

export interface StatementSync {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
  all(...params: SqlValue[]): Record<string, SqlValue>[];
}

export interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}

type SqliteModule = { DatabaseSync: new (path: string) => DatabaseSync };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  round_id TEXT,
  hand_id TEXT,
  outcome TEXT,
  balance_after INTEGER NOT NULL,
  idempotency_key TEXT,
  created_at TEXT,
  UNIQUE (account_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  rounds_survived INTEGER NOT NULL,
  net INTEGER NOT NULL,
  ended_at TEXT NOT NULL
);
`;

/** Opens a SQLite database (file path or ":memory:") and creates the engine tables if missing. */
export function openDb(path: string): DatabaseSync {
  const sqlite = process.getBuiltinModule("node:sqlite") as SqliteModule;
  const db = new sqlite.DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

let appDb: DatabaseSync | undefined;

/** App connection on `data/casino.db`, opened on first call. */
export function getDb(): DatabaseSync {
  if (!appDb) {
    const dir = join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    // Keep the local database out of Git without touching the root .gitignore.
    writeFileSync(join(dir, ".gitignore"), "*\n");
    appDb = openDb(join(dir, "casino.db"));
  }
  return appDb;
}
