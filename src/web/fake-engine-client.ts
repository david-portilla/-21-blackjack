// In-browser stand-in for the engine HTTP API, so the site can be built before Edgar's routes exist.
// Enabled with NEXT_PUBLIC_ENGINE_FAKE=1. Follows the same rules the real engine must follow (R1, R2, R11, R12).
// debit, settle and closeRun mirror the in-process CasinoEngine; only the in-browser game emulation calls them.
import type { Outcome, TxKind } from "@/contracts/types";
import { EngineError, type EngineClient } from "./engine-client";
import type { Account, Run, Transaction } from "./engine-types";

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export type FakeEngine = EngineClient & {
  debit(input: {
    roundId: string;
    handId: string;
    kind: "BET" | "DOUBLE" | "SPLIT";
    amount?: number; // BET only
    idempotencyKey: string;
  }): Promise<Transaction>;
  settle(input: { roundId: string; handId: string; outcome: Outcome; idempotencyKey: string }): Promise<Transaction>;
  closeRun(input: { runId: string; roundIds: string[]; roundsSurvived: number }): Promise<Run>;
};

const DEBITS: TxKind[] = ["BET", "DOUBLE", "SPLIT"];
const RETURN_MULTIPLIER: Record<Outcome, number> = { win: 2, blackjack: 2, push: 1, loss: 0 };

type State = {
  accounts: Record<string, Account>;
  transactions: Transaction[];
  runs: Run[];
  idempotency: Record<string, string>;
  session: string | null;
};

const KEY = "blackjack.fakeEngine";

export function createFakeEngineClient(store: () => KeyValueStore, now = () => new Date()): FakeEngine {
  const load = (): State =>
    JSON.parse(store().getItem(KEY) ?? "null") ?? {
      accounts: {},
      transactions: [],
      runs: [],
      idempotency: {},
      session: null,
    };
  const save = (s: State) => store().setItem(KEY, JSON.stringify(s));
  const signedIn = (s: State): Account => {
    const account = s.session ? s.accounts[s.session] : undefined;
    if (!account) throw new EngineError("UNAUTHENTICATED", "Sign in first");
    return account;
  };
  const byKey = (s: State, key: string) => s.transactions.find((t) => t.transactionId === s.idempotency[key]);
  const record = (s: State, account: Account, key: string, fields: Omit<Transaction, "transactionId" | "accountId" | "balanceAfter" | "createdAt">) => {
    const tx: Transaction = {
      transactionId: crypto.randomUUID(),
      accountId: account.accountId,
      ...fields,
      balanceAfter: account.balance,
      createdAt: now().toISOString(),
    };
    s.transactions.unshift(tx);
    s.idempotency[key] = tx.transactionId;
    save(s);
    return tx;
  };

  return {
    async signIn(username) {
      const s = load();
      // Same rule as the engine: trimmed, non-empty, exact (case-sensitive) match.
      const name = username.trim();
      if (!name) throw new EngineError("INVALID_USERNAME", "Write a name to sign the book");
      const account = Object.values(s.accounts).find((a) => a.username === name) ?? {
        accountId: crypto.randomUUID(),
        username: name,
        balance: 0,
      };
      s.accounts[account.accountId] = account;
      s.session = account.accountId;
      save(s);
      return account;
    },

    async me() {
      const s = load();
      return (s.session && s.accounts[s.session]) || null;
    },

    async deposit(amount, idempotencyKey) {
      const s = load();
      const account = signedIn(s);
      // A repeated key returns the original and changes nothing; the payload is not compared (engine contract).
      const prior = byKey(s, idempotencyKey);
      if (prior) return prior;
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new EngineError("INVALID_AMOUNT", "Deposit must be a positive whole number");
      }
      account.balance += amount;
      return record(s, account, idempotencyKey, { kind: "DEPOSIT", amount });
    },

    async transactions() {
      const s = load();
      const account = signedIn(s);
      return s.transactions.filter((t) => t.accountId === account.accountId);
    },

    async runs() {
      const s = load();
      const account = signedIn(s);
      return s.runs.filter((r) => r.accountId === account.accountId);
    },

    // Check and debit in one step: on any error nothing changes (AC-9.4, AC-10.7).
    // Like the engine, DOUBLE and SPLIT amounts come from the recorded stakes, never from the caller.
    async debit({ roundId, handId, kind, amount: requested, idempotencyKey }) {
      const s = load();
      const account = signedIn(s);
      const prior = byKey(s, idempotencyKey);
      if (prior) return prior;
      const stakeOf = (id: string) =>
        s.transactions.filter((t) => t.handId === id && DEBITS.includes(t.kind)).reduce((sum, t) => sum + t.amount, 0);
      const amount = kind === "DOUBLE" ? stakeOf(handId) : kind === "SPLIT" ? stakeOf(`${roundId}:0`) : (requested ?? 0);
      if (!Number.isInteger(amount) || amount <= 0) throw new EngineError("INVALID_AMOUNT", "Stake must be a positive whole number");
      if (account.balance < amount) throw new EngineError("INSUFFICIENT_FUNDS", "Not enough credits");
      account.balance -= amount;
      return record(s, account, idempotencyKey, { kind, amount, roundId, handId });
    },

    // The payout comes from the stakes recorded against the hand, never from the caller (AC-11.3).
    async settle({ roundId, handId, outcome, idempotencyKey }) {
      const s = load();
      const account = signedIn(s);
      const prior = byKey(s, idempotencyKey);
      if (prior) return prior;
      const stake = s.transactions
        .filter((t) => t.handId === handId && DEBITS.includes(t.kind))
        .reduce((sum, t) => sum + t.amount, 0);
      const amount = stake * RETURN_MULTIPLIER[outcome];
      account.balance += amount;
      return record(s, account, idempotencyKey, { kind: "PAYOUT", amount, roundId, handId, outcome });
    },

    async closeRun({ runId, roundIds, roundsSurvived }) {
      const s = load();
      const account = signedIn(s);
      const prior = s.runs.find((r) => r.runId === runId);
      if (prior) return prior;
      const net = s.transactions
        .filter((t) => t.accountId === account.accountId && t.roundId && roundIds.includes(t.roundId))
        .reduce((sum, t) => sum + (DEBITS.includes(t.kind) ? -t.amount : t.amount), 0);
      const run: Run = { runId, accountId: account.accountId, roundsSurvived, net, endedAt: now().toISOString() };
      s.runs.unshift(run);
      save(s);
      return run;
    },
  };
}
