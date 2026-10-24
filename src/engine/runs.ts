import type { CloseRunInput, Run } from "@/contracts/engine";
import type { DatabaseSync } from "./db";

type RunRow = { id: string; account_id: string; rounds_survived: number; net: number; ended_at: string };

function toRun(row: RunRow): Run {
  return {
    runId: row.id,
    accountId: row.account_id,
    roundsSurvived: row.rounds_survived,
    net: row.net,
    endedAt: row.ended_at,
  };
}

/** Candles runs (R16) on a SQLite connection. Method bodies are synchronous, like the engine. */
export function createRuns(db: DatabaseSync) {
  function findRun(runId: string): RunRow | undefined {
    return db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RunRow | undefined;
  }

  /** PAYOUT minus BET/DOUBLE/SPLIT over the account's transactions of `roundIds`; 0 if none. */
  function netOf(accountId: string, roundIds: string[]): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(CASE
           WHEN kind = 'PAYOUT' THEN amount
           WHEN kind IN ('BET', 'DOUBLE', 'SPLIT') THEN -amount
           ELSE 0 END), 0) AS net
         FROM transactions
         WHERE account_id = ? AND round_id IN (SELECT value FROM json_each(?))`,
      )
      .get(accountId, JSON.stringify(roundIds)) as { net: number };
    return row.net;
  }

  return {
    /** Stores the ended run (AC-16.2, AC-16.9). Same `runId` returns the stored run. Never moves money (AC-16.8). */
    async closeRun({ accountId, runId, roundIds, roundsSurvived }: CloseRunInput): Promise<Run> {
      const existing = findRun(runId);
      if (existing) return toRun(existing);
      const row: RunRow = {
        id: runId,
        account_id: accountId,
        rounds_survived: roundsSurvived,
        net: netOf(accountId, roundIds),
        ended_at: new Date().toISOString(),
      };
      db.prepare("INSERT INTO runs (id, account_id, rounds_survived, net, ended_at) VALUES (?, ?, ?, ?, ?)").run(
        row.id,
        row.account_id,
        row.rounds_survived,
        row.net,
        row.ended_at,
      );
      return toRun(row);
    },

    /** The account's runs, newest first (AC-16.3). */
    async listRuns(accountId: string): Promise<Run[]> {
      const rows = db
        .prepare("SELECT * FROM runs WHERE account_id = ? ORDER BY ended_at DESC, rowid DESC")
        .all(accountId) as RunRow[];
      return rows.map(toRun);
    },
  };
}

export type Runs = ReturnType<typeof createRuns>;
