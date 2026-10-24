import { randomUUID } from "node:crypto";
import {
  EngineError,
  type Account,
  type DebitInput,
  type SettleInput,
  type Transaction,
} from "@/contracts/engine";
import { tier3Days } from "@/contracts/omens";
import type { Outcome, TxKind } from "@/contracts/types";
import type { DatabaseSync } from "./db";

export type DepositInput = { accountId: string; amount: unknown; idempotencyKey: string };

type AccountRow = { id: string; username: string; balance: number };

type TxRow = {
  id: string;
  account_id: string;
  kind: TxKind;
  amount: number;
  round_id: string | null;
  hand_id: string | null;
  outcome: Outcome | null;
  balance_after: number;
  created_at: string;
};

type NewTx = {
  accountId: string;
  kind: TxKind;
  amount: number;
  roundId?: string;
  handId?: string;
  outcome?: Outcome;
  idempotencyKey: string;
};

const PAYOUT_MULTIPLIER: Record<Outcome, number> = { win: 2, blackjack: 2, push: 1, loss: 0 };

function isValidAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

function toAccount(row: AccountRow): Account {
  return { accountId: row.id, username: row.username, balance: row.balance };
}

function toTransaction(row: TxRow): Transaction {
  return {
    transactionId: row.id,
    accountId: row.account_id,
    kind: row.kind,
    amount: row.amount,
    ...(row.round_id !== null && { roundId: row.round_id }),
    ...(row.hand_id !== null && { handId: row.hand_id }),
    ...(row.outcome !== null && { outcome: row.outcome }),
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };
}

/**
 * Casino engine on a SQLite connection. Every method body is synchronous (no `await` between
 * reading and writing), so check-and-write is atomic inside one Node process.
 */
export function createEngine(db: DatabaseSync) {
  function listTx(accountId: string): Transaction[] {
    const rows = db
      .prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC, rowid DESC")
      .all(accountId) as TxRow[];
    return rows.map(toTransaction);
  }

  function findAccount(accountId: string): AccountRow | undefined {
    return db.prepare("SELECT id, username, balance FROM accounts WHERE id = ?").get(accountId) as
      | AccountRow
      | undefined;
  }

  function findByKey(accountId: string, idempotencyKey: string): Transaction | undefined {
    const row = db
      .prepare("SELECT * FROM transactions WHERE account_id = ? AND idempotency_key = ?")
      .get(accountId, idempotencyKey) as TxRow | undefined;
    return row && toTransaction(row);
  }

  /** Sum of debits (BET, DOUBLE, SPLIT) recorded against a hand; undefined if none. */
  function handStake(accountId: string, handId: string): number | undefined {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS stake FROM transactions
         WHERE account_id = ? AND hand_id = ? AND kind IN ('BET', 'DOUBLE', 'SPLIT')`,
      )
      .get(accountId, handId) as { n: number; stake: number };
    return row.n > 0 ? row.stake : undefined;
  }

  function betOf(accountId: string, handId: string): number | undefined {
    const row = db
      .prepare("SELECT amount FROM transactions WHERE account_id = ? AND hand_id = ? AND kind = 'BET'")
      .get(accountId, handId) as { amount: number } | undefined;
    return row?.amount;
  }

  function inTransaction<T>(fn: () => T): T {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  /** Moves the balance and writes the ledger row in one SQL transaction. */
  function record(tx: NewTx): Transaction {
    return inTransaction(() => {
      const isDebit = tx.kind === "BET" || tx.kind === "DOUBLE" || tx.kind === "SPLIT";
      const { changes } = isDebit
        ? db
            .prepare("UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?")
            .run(tx.amount, tx.accountId, tx.amount)
        : db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(tx.amount, tx.accountId);
      if (Number(changes) === 0) {
        throw new EngineError(isDebit && findAccount(tx.accountId) ? "INSUFFICIENT_FUNDS" : "ACCOUNT_NOT_FOUND");
      }

      const row: TxRow = {
        id: randomUUID(),
        account_id: tx.accountId,
        kind: tx.kind,
        amount: tx.amount,
        round_id: tx.roundId ?? null,
        hand_id: tx.handId ?? null,
        outcome: tx.outcome ?? null,
        balance_after: findAccount(tx.accountId)!.balance,
        created_at: new Date().toISOString(),
      };
      db.prepare(
        `INSERT INTO transactions
         (id, account_id, kind, amount, round_id, hand_id, outcome, balance_after, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.account_id,
        row.kind,
        row.amount,
        row.round_id,
        row.hand_id,
        row.outcome,
        row.balance_after,
        tx.idempotencyKey,
        row.created_at,
      );
      return toTransaction(row);
    });
  }

  return {
    /**
     * Signs in by username, creating the account with balance 0 if new. The username is trimmed and
     * otherwise stored and matched as sent (case-sensitive); validation lives in the site. Only a
     * non-string is rejected, since it cannot be stored.
     */
    async signIn(username: string): Promise<Account> {
      if (typeof username !== "string") throw new EngineError("INVALID_USERNAME");
      const name = username.trim();
      const existing = db
        .prepare("SELECT id, username, balance FROM accounts WHERE username = ?")
        .get(name) as AccountRow | undefined;
      if (existing) return toAccount(existing);
      const row: AccountRow = { id: randomUUID(), username: name, balance: 0 };
      db.prepare("INSERT INTO accounts (id, username, balance, created_at) VALUES (?, ?, 0, ?)").run(
        row.id,
        row.username,
        new Date().toISOString(),
      );
      return toAccount(row);
    },

    async getAccount(accountId: string): Promise<Account> {
      const row = findAccount(accountId);
      if (!row) throw new EngineError("ACCOUNT_NOT_FOUND");
      return toAccount(row);
    },

    async deposit({ accountId, amount, idempotencyKey }: DepositInput): Promise<Transaction> {
      const existing = findByKey(accountId, idempotencyKey);
      if (existing) return existing;
      if (!isValidAmount(amount)) throw new EngineError("INVALID_AMOUNT");
      return record({ accountId, kind: "DEPOSIT", amount, idempotencyKey });
    },

    async debit(input: DebitInput): Promise<Transaction> {
      const { accountId, roundId, handId, kind, idempotencyKey } = input;
      const existing = findByKey(accountId, idempotencyKey);
      if (existing) return existing;

      let amount: number | undefined;
      if (kind === "BET") {
        if (!isValidAmount(input.amount)) throw new EngineError("INVALID_AMOUNT");
        amount = input.amount;
      } else {
        amount = kind === "DOUBLE" ? handStake(accountId, handId) : betOf(accountId, `${roundId}:0`);
        if (amount === undefined) throw new EngineError("ROUND_NOT_FOUND");
      }
      return record({ accountId, kind, amount, roundId, handId, idempotencyKey });
    },

    async settle(input: SettleInput): Promise<Transaction> {
      const { accountId, roundId, handId, outcome, idempotencyKey } = input;
      const existing = findByKey(accountId, idempotencyKey);
      if (existing) return existing;
      // One payout per hand (AC-11.1), whatever key is used.
      const paid = db
        .prepare("SELECT * FROM transactions WHERE account_id = ? AND hand_id = ? AND kind = 'PAYOUT'")
        .get(accountId, handId) as TxRow | undefined;
      if (paid) return toTransaction(paid);

      const stake = handStake(accountId, handId);
      if (stake === undefined) throw new EngineError("ROUND_NOT_FOUND");
      const amount = stake * PAYOUT_MULTIPLIER[outcome];
      return record({ accountId, kind: "PAYOUT", amount, roundId, handId, outcome, idempotencyKey });
    },

    /** All transactions of the account, newest first. */
    async listTransactions(accountId: string): Promise<Transaction[]> {
      return listTx(accountId);
    },

    /** Spare candle for a new run (AC-18.5, AC-18.8). Same runId returns the first answer; never moves money. */
    async claimSpareCandle({ accountId, runId }: { accountId: string; runId: string }): Promise<boolean> {
      const prior = db.prepare("SELECT granted FROM spare_candle_claims WHERE run_id = ?").get(runId) as
        | { granted: number }
        | undefined;
      if (prior) return prior.granted === 1;
      const spent = db
        .prepare("SELECT COUNT(*) AS n FROM spare_candle_claims WHERE account_id = ? AND granted = 1")
        .get(accountId) as { n: number };
      const granted = Math.min(1, tier3Days(listTx(accountId)) - spent.n) > 0;
      db.prepare("INSERT INTO spare_candle_claims (run_id, account_id, granted, claimed_at) VALUES (?, ?, ?, ?)").run(
        runId,
        accountId,
        granted ? 1 : 0,
        new Date().toISOString(),
      );
      return granted;
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
