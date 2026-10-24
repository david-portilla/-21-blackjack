// Engine contract. Owner: Edgar. Human-readable version in README.md ("Engine").

import type { ErrorCode, Outcome, TxKind } from "./types";

export type Transaction = {
  transactionId: string;
  accountId: string;
  kind: TxKind;
  amount: number;
  roundId?: string;
  handId?: string;
  outcome?: Outcome;
  balanceAfter: number;
  createdAt: string;
};

export type Account = { accountId: string; username: string; balance: number };

export type DebitInput = {
  accountId: string;
  roundId: string;
  handId: string;
  kind: "BET" | "DOUBLE" | "SPLIT";
  /** Required for BET. Ignored for DOUBLE and SPLIT: the engine computes them from recorded stakes. */
  amount?: number;
  idempotencyKey: string;
};

export type SettleInput = {
  accountId: string;
  roundId: string;
  handId: string;
  outcome: Outcome;
  idempotencyKey: string;
};

/** A finished Candles run (R16). `net` is computed by the engine from the run's transactions. */
export type Run = {
  runId: string;
  accountId: string;
  roundsSurvived: number;
  net: number;
  endedAt: string;
};

export type CloseRunInput = {
  accountId: string;
  runId: string;
  roundIds: string[];
  roundsSurvived: number;
};

/** In-process interface the game uses. Not exposed over HTTP. */
export interface CasinoEngine {
  getSessionAccount(req: Request): Promise<{ accountId: string } | null>;
  /** Throws EngineError: INVALID_AMOUNT | INSUFFICIENT_FUNDS | ROUND_NOT_FOUND. */
  debit(input: DebitInput): Promise<Transaction>;
  /** Throws EngineError: ROUND_NOT_FOUND. The payout amount is computed by the engine (R11). */
  settle(input: SettleInput): Promise<Transaction>;
  /** Records the ended run (AC-16.9). Same `runId` returns the stored run. Never moves money (AC-16.8). */
  closeRun(input: CloseRunInput): Promise<Run>;
}

/** Error thrown by the engine; `code` maps 1:1 to ApiError codes. */
export class EngineError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string = code) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

// HTTP bodies for /api/engine/*. Responses: Account or Transaction(s), errors as ApiError.
export type SessionRequest = { username: string };
export type DepositRequest = { amount: number; idempotencyKey: string };
