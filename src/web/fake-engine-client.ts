// In-browser stand-in for the engine HTTP API, so the site can be built before Edgar's routes exist.
// Enabled with NEXT_PUBLIC_ENGINE_FAKE=1. Follows the same rules the real engine must follow (R1, R2).
import { EngineError, type EngineClient } from "./engine-client";
import type { Account, Run, Transaction } from "./engine-types";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

type State = {
  accounts: Record<string, Account>;
  transactions: Transaction[];
  runs: Run[];
  idempotency: Record<string, string>;
  session: string | null;
};

const KEY = "blackjack.fakeEngine";

export function createFakeEngineClient(store: () => KeyValueStore, now = () => new Date()): EngineClient {
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

  return {
    async signIn(username) {
      const s = load();
      const name = username.trim();
      const account = Object.values(s.accounts).find((a) => a.username.toLowerCase() === name.toLowerCase()) ?? {
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
      const prior = s.transactions.find((t) => t.transactionId === s.idempotency[idempotencyKey]);
      if (prior) {
        if (prior.amount !== amount) throw new EngineError("IDEMPOTENCY_CONFLICT", "Key reused with another amount");
        return prior;
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new EngineError("INVALID_AMOUNT", "Deposit must be a positive whole number");
      }
      account.balance += amount;
      const tx: Transaction = {
        transactionId: crypto.randomUUID(),
        accountId: account.accountId,
        kind: "DEPOSIT",
        amount,
        balanceAfter: account.balance,
        createdAt: now().toISOString(),
      };
      s.transactions.unshift(tx);
      s.idempotency[idempotencyKey] = tx.transactionId;
      save(s);
      return tx;
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
  };
}
