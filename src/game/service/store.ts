// Game tables on the engine's SQLite connection (D-017). The game never writes engine tables.
import type { Card } from "@/contracts/types";
import type { DatabaseSync } from "@/engine/db";
import type { RoundState } from "../rules/round";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS game_rounds_one_open ON game_rounds (account_id) WHERE status != 'settled';
CREATE TABLE IF NOT EXISTS game_runs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  candles INTEGER NOT NULL,
  starting_candles INTEGER NOT NULL DEFAULT 3,
  rounds_won INTEGER NOT NULL,
  round_ids TEXT NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS game_runs_one_open ON game_runs (account_id) WHERE closed = 0;
`;

/**
 * - `pending`: stored, BET not confirmed yet, nothing dealt.
 * - `player_turn`: dealt, waiting for the player.
 * - `settling`: dealer done, payouts in progress.
 * - `settled`: every hand paid.
 */
export type RoundStatus = "pending" | "player_turn" | "settling" | "settled";

export type RoundRow = {
  roundId: string;
  accountId: string;
  idempotencyKey: string;
  runId: string;
  status: RoundStatus;
  version: number;
  stake: number;
  /** Shuffled once at creation; never leaves the server (AC-4.3). */
  deck: Card[];
  drawn: number;
  state: RoundState | null;
  payouts: Record<string, number>;
};

/** `closed`: engine.closeRun has recorded it. A run at 0 candles and not closed still needs closing. */
export type RunRow = {
  runId: string;
  accountId: string;
  candles: number;
  /** 3, or 4 with a spare candle (AC-18.5). */
  startingCandles: number;
  roundsWon: number;
  roundIds: string[];
  closed: boolean;
};

type Data = Pick<RoundRow, "stake" | "deck" | "drawn" | "state" | "payouts">;

function toRound(r: Record<string, unknown>): RoundRow {
  const data = JSON.parse(r.data as string) as Data;
  return {
    roundId: r.id as string,
    accountId: r.account_id as string,
    idempotencyKey: r.idempotency_key as string,
    runId: r.run_id as string,
    status: r.status as RoundStatus,
    version: Number(r.version),
    ...data,
  };
}

function toRun(r: Record<string, unknown>): RunRow {
  return {
    runId: r.id as string,
    accountId: r.account_id as string,
    candles: Number(r.candles),
    startingCandles: Number(r.starting_candles ?? 3),
    roundsWon: Number(r.rounds_won),
    roundIds: JSON.parse(r.round_ids as string),
    closed: Number(r.closed) === 1,
  };
}

const dataOf = (r: RoundRow): string =>
  JSON.stringify({ stake: r.stake, deck: r.deck, drawn: r.drawn, state: r.state, payouts: r.payouts } satisfies Data);

export function createGameStore(db: DatabaseSync) {
  db.exec(SCHEMA);
  // Databases created before AC-18.5 lack the column; CREATE TABLE IF NOT EXISTS does not add it.
  const columns = db.prepare("PRAGMA table_info(game_runs)").all().map((c) => c.name);
  if (!columns.includes("starting_candles")) {
    db.exec("ALTER TABLE game_runs ADD COLUMN starting_candles INTEGER NOT NULL DEFAULT 3");
  }

  return {
    roundByKey(accountId: string, idempotencyKey: string): RoundRow | null {
      const r = db.prepare("SELECT * FROM game_rounds WHERE account_id = ? AND idempotency_key = ?").get(accountId, idempotencyKey);
      return r ? toRound(r) : null;
    },

    roundById(accountId: string, roundId: string): RoundRow | null {
      const r = db.prepare("SELECT * FROM game_rounds WHERE account_id = ? AND id = ?").get(accountId, roundId);
      return r ? toRound(r) : null;
    },

    openRound(accountId: string): RoundRow | null {
      const r = db.prepare("SELECT * FROM game_rounds WHERE account_id = ? AND status != 'settled'").get(accountId);
      return r ? toRound(r) : null;
    },

    /** False when the account already has an unfinished round or the key was used (AC-3.3). */
    insertRound(r: RoundRow): boolean {
      try {
        db.prepare(
          "INSERT INTO game_rounds (id, account_id, idempotency_key, run_id, status, version, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(r.roundId, r.accountId, r.idempotencyKey, r.runId, r.status, r.version, dataOf(r), new Date().toISOString());
        return true;
      } catch (e) {
        if (String(e).includes("UNIQUE")) return false;
        throw e;
      }
    },

    /** Compare-and-swap on version: false if someone else saved first (AC-12.2). */
    saveRound(r: RoundRow, expectedVersion: number): boolean {
      const { changes } = db
        .prepare("UPDATE game_rounds SET status = ?, version = ?, data = ? WHERE id = ? AND version = ?")
        .run(r.status, r.version, dataOf(r), r.roundId, expectedVersion);
      return Number(changes) === 1;
    },

    deleteRound(roundId: string): void {
      db.prepare("DELETE FROM game_rounds WHERE id = ?").run(roundId);
    },

    openRun(accountId: string): RunRow | null {
      const r = db.prepare("SELECT * FROM game_runs WHERE account_id = ? AND closed = 0").get(accountId);
      return r ? toRun(r) : null;
    },

    runById(runId: string): RunRow | null {
      const r = db.prepare("SELECT * FROM game_runs WHERE id = ?").get(runId);
      return r ? toRun(r) : null;
    },

    insertRun(run: RunRow): void {
      db.prepare(
        "INSERT INTO game_runs (id, account_id, candles, starting_candles, rounds_won, round_ids, closed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(run.runId, run.accountId, run.candles, run.startingCandles, run.roundsWon, JSON.stringify(run.roundIds), run.closed ? 1 : 0, new Date().toISOString());
    },

    saveRun(run: RunRow): void {
      db.prepare("UPDATE game_runs SET candles = ?, rounds_won = ?, round_ids = ?, closed = ? WHERE id = ?").run(
        run.candles,
        run.roundsWon,
        JSON.stringify(run.roundIds),
        run.closed ? 1 : 0,
        run.runId,
      );
    },

    deleteRun(runId: string): void {
      db.prepare("DELETE FROM game_runs WHERE id = ?").run(runId);
    },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;
