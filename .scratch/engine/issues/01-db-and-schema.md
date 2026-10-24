# 01 · DB connection and schema

Status: done
Implements: AC-12.3 (persistence base)

## What
- `src/engine/db.ts`: `openDb(path: string)` using `DatabaseSync` from `node:sqlite`; creates tables if missing; exports a default app connection on `data/casino.db` (create `data/` if missing).
- Tables:
  - `accounts(id TEXT PK, username TEXT UNIQUE NOT NULL, balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), created_at TEXT)`
  - `transactions(id TEXT PK, account_id TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, round_id TEXT, hand_id TEXT, outcome TEXT, balance_after INTEGER NOT NULL, idempotency_key TEXT, created_at TEXT, UNIQUE(account_id, idempotency_key))`

## First check (spike)
Confirm `node:sqlite` loads in Vitest 5 and in a Next route handler (Node runtime). If not, tell Edgar: plan B is `better-sqlite3` (new dependency, needs David).

## Done when
- A test opens `:memory:`, inserts an account, reads it back.
- `pnpm check` passes.

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
