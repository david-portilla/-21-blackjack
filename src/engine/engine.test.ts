import { beforeEach, describe, expect, it } from "vitest";
import { EngineError, type Transaction } from "@/contracts/engine";
import type { ErrorCode, Outcome } from "@/contracts/types";
import { openDb } from "./db";
import { createEngine, type Engine } from "./engine";

let engine: Engine;
let accountId: string;
const roundId = "r1";
const hand0 = `${roundId}:0`;
const hand1 = `${roundId}:1`;

beforeEach(async () => {
  engine = createEngine(openDb(":memory:"));
  accountId = (await engine.signIn("alice")).accountId;
});

async function fund(amount: number) {
  await engine.deposit({ accountId, amount, idempotencyKey: `dep:${amount}` });
}

const bet = (amount: number, round = roundId) =>
  engine.debit({ accountId, roundId: round, handId: `${round}:0`, kind: "BET", amount, idempotencyKey: `bet:${round}:0` });
const double = (handId = hand0) =>
  engine.debit({ accountId, roundId, handId, kind: "DOUBLE", idempotencyKey: `double:${handId}` });
const split = () => engine.debit({ accountId, roundId, handId: hand1, kind: "SPLIT", idempotencyKey: `split:${hand1}` });
const settle = (outcome: Outcome, handId = hand0, round = roundId) =>
  engine.settle({ accountId, roundId: round, handId, outcome, idempotencyKey: `payout:${handId}` });

const balance = async () => (await engine.getAccount(accountId)).balance;

async function snapshot() {
  return { balance: await balance(), txs: await engine.listTransactions(accountId) };
}

async function expectCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toBeInstanceOf(EngineError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("accounts (02)", () => {
  it("AC-1.1 new username creates account with balance 0", async () => {
    const account = await engine.signIn("bob");
    expect(account).toEqual({ accountId: expect.any(String), username: "bob", balance: 0 });
  });

  it("AC-1.2 same username returns the same account", async () => {
    await fund(30);
    expect(await engine.signIn("alice")).toEqual({ accountId, username: "alice", balance: 30 });
  });

  it("AC-1.2 username match is case-sensitive and ignores surrounding spaces", async () => {
    expect((await engine.signIn("Alice")).accountId).not.toBe(accountId);
    expect((await engine.signIn(" alice ")).accountId).toBe(accountId);
  });

  it("AC-1.1 username is trimmed and otherwise stored as sent", async () => {
    const account = await engine.signIn("  Bob ");
    expect(account.username).toBe("Bob");
    expect((await engine.signIn("Bob")).accountId).toBe(account.accountId);
    expect((await engine.signIn("")).username).toBe("");
  });

  it("non-string username rejected with INVALID_USERNAME", async () => {
    await expectCode(engine.signIn(42 as unknown as string), "INVALID_USERNAME");
    await expectCode(engine.signIn(undefined as unknown as string), "INVALID_USERNAME");
  });

  it("getAccount on unknown id throws ACCOUNT_NOT_FOUND", async () => {
    await expectCode(engine.getAccount("nope"), "ACCOUNT_NOT_FOUND");
  });
});

describe("deposits (03)", () => {
  it("AC-2.1 deposit increases balance and records DEPOSIT", async () => {
    const tx = await engine.deposit({ accountId, amount: 100, idempotencyKey: "d1" });
    expect(tx).toEqual({
      transactionId: expect.any(String),
      accountId,
      kind: "DEPOSIT",
      amount: 100,
      balanceAfter: 100,
      createdAt: expect.any(String),
    });
    expect(await balance()).toBe(100);
  });

  it("AC-2.2 rejects 0, negative, decimal and non-number; state unchanged", async () => {
    await fund(50);
    const before = await snapshot();
    for (const amount of [0, -5, 1.5, "10", NaN, Infinity, null, undefined, 2 ** 53]) {
      await expectCode(engine.deposit({ accountId, amount, idempotencyKey: `bad:${String(amount)}` }), "INVALID_AMOUNT");
    }
    expect(await snapshot()).toEqual(before);
  });

  it("AC-2.3 same idempotency key changes balance once", async () => {
    const first = await engine.deposit({ accountId, amount: 25, idempotencyKey: "d1" });
    const again = await engine.deposit({ accountId, amount: 25, idempotencyKey: "d1" });
    expect(again).toEqual(first);
    expect(await balance()).toBe(25);
    expect(await engine.listTransactions(accountId)).toHaveLength(1);
  });

  it("deposit to unknown account throws ACCOUNT_NOT_FOUND and writes nothing", async () => {
    await expectCode(engine.deposit({ accountId: "nope", amount: 10, idempotencyKey: "d1" }), "ACCOUNT_NOT_FOUND");
    expect(await engine.listTransactions("nope")).toEqual([]);
  });
});

describe("debit (04)", () => {
  it("AC-3.1 bet debits stake", async () => {
    await fund(100);
    const tx = await bet(10);
    expect(tx).toMatchObject({ kind: "BET", amount: 10, roundId, handId: hand0, balanceAfter: 90 });
    expect(await balance()).toBe(90);
  });

  it("AC-3.2 bet over balance rejected, state unchanged", async () => {
    await fund(5);
    const before = await snapshot();
    await expectCode(bet(10), "INSUFFICIENT_FUNDS");
    expect(await snapshot()).toEqual(before);
  });

  it("bet with invalid amount rejected with INVALID_AMOUNT", async () => {
    await fund(100);
    const before = await snapshot();
    for (const amount of [0, -1, 2.5, undefined]) {
      await expectCode(
        engine.debit({ accountId, roundId, handId: hand0, kind: "BET", amount, idempotencyKey: `b:${amount}` }),
        "INVALID_AMOUNT",
      );
    }
    expect(await snapshot()).toEqual(before);
  });

  it("AC-9.2 double debits the hand's current stake", async () => {
    await fund(100);
    await bet(10);
    const tx = await engine.debit({
      accountId,
      roundId,
      handId: hand0,
      kind: "DOUBLE",
      amount: 999, // ignored
      idempotencyKey: `double:${hand0}`,
    });
    expect(tx).toMatchObject({ kind: "DOUBLE", amount: 10, handId: hand0, balanceAfter: 80 });
  });

  it("AC-9.4 double without funds rejected, state unchanged", async () => {
    await fund(15);
    await bet(10);
    const before = await snapshot();
    await expectCode(double(), "INSUFFICIENT_FUNDS");
    expect(await snapshot()).toEqual(before);
  });

  it("AC-10.2 split debits the original stake against hand 1", async () => {
    await fund(100);
    await bet(10);
    const tx = await split();
    expect(tx).toMatchObject({ kind: "SPLIT", amount: 10, roundId, handId: hand1, balanceAfter: 80 });
  });

  it("AC-10.7 split without funds rejected, state unchanged", async () => {
    await fund(12);
    await bet(10);
    const before = await snapshot();
    await expectCode(split(), "INSUFFICIENT_FUNDS");
    expect(await snapshot()).toEqual(before);
  });

  it("double or split without a recorded stake throws ROUND_NOT_FOUND", async () => {
    await fund(100);
    await expectCode(double(), "ROUND_NOT_FOUND");
    await expectCode(split(), "ROUND_NOT_FOUND");
    expect(await balance()).toBe(100);
  });

  it("AC-12.1 repeated debit key returns original and changes nothing", async () => {
    await fund(100);
    const first = await bet(10);
    const before = await snapshot();
    expect(await bet(10)).toEqual(first);
    expect(await snapshot()).toEqual(before);
  });

  it("AC-12.4 balance never negative", async () => {
    await fund(10);
    await bet(10);
    await expectCode(double(), "INSUFFICIENT_FUNDS");
    await expectCode(bet(1, "r2"), "INSUFFICIENT_FUNDS");
    expect(await balance()).toBe(0);
  });

  it("debit on unknown account throws ACCOUNT_NOT_FOUND", async () => {
    await expectCode(
      engine.debit({ accountId: "nope", roundId, handId: hand0, kind: "BET", amount: 1, idempotencyKey: "b" }),
      "ACCOUNT_NOT_FOUND",
    );
  });
});

describe("settle (05)", () => {
  it("AC-11.2 win 2x, push 1x, loss 0, blackjack 2x", async () => {
    const cases: [Outcome, number][] = [["win", 20], ["push", 10], ["loss", 0], ["blackjack", 20]];
    await fund(100);
    for (const [i, [outcome, payout]] of cases.entries()) {
      const round = `r${i}`;
      await bet(10, round);
      const tx = await settle(outcome, `${round}:0`, round);
      expect(tx).toMatchObject({ kind: "PAYOUT", amount: payout, outcome, roundId: round, handId: `${round}:0` });
    }
  });

  it.each<[Outcome, number]>([["win", 110], ["push", 100], ["loss", 90]])(
    "AC-11.4 balance 100, bet 10: %s ends at %i",
    async (outcome, expected) => {
      await fund(100);
      await bet(10);
      const tx = await settle(outcome);
      expect(tx.balanceAfter).toBe(expected);
      expect(await balance()).toBe(expected);
    },
  );

  it.each<[Outcome, number]>([["win", 40], ["push", 20], ["loss", 0]])(
    "AC-9.5 double: %s returns %i",
    async (outcome, payout) => {
      await fund(100);
      await bet(10);
      await double();
      const tx = await settle(outcome);
      expect(tx.amount).toBe(payout);
      expect(await balance()).toBe(80 + payout);
    },
  );

  it("AC-10.8 split, one win one loss returns 20", async () => {
    await fund(100);
    await bet(10);
    await split();
    const win = await settle("win", hand0);
    const loss = await settle("loss", hand1);
    expect(win.amount + loss.amount).toBe(20);
    expect(await balance()).toBe(100);
  });

  it("AC-11.1 + AC-12.1 second settle with same key pays nothing", async () => {
    await fund(100);
    await bet(10);
    const first = await settle("win");
    const before = await snapshot();
    expect(await settle("win")).toEqual(first);
    expect(await snapshot()).toEqual(before);
  });

  it("AC-11.1 a hand already paid returns the original payout even with another key", async () => {
    await fund(100);
    await bet(10);
    const first = await settle("win");
    const before = await snapshot();
    const again = await engine.settle({ accountId, roundId, handId: hand0, outcome: "win", idempotencyKey: "other-key" });
    expect(again).toEqual(first);
    expect(await snapshot()).toEqual(before);
  });

  it("settle without a recorded stake throws ROUND_NOT_FOUND, state unchanged", async () => {
    await fund(100);
    const before = await snapshot();
    await expectCode(settle("win"), "ROUND_NOT_FOUND");
    expect(await snapshot()).toEqual(before);
  });
});

describe("balance and history (06)", () => {
  async function playMixedSequence() {
    await fund(100);
    await bet(10);
    await double();
    await settle("win"); // +40
    await bet(10, "r2");
    await engine.debit({ accountId, roundId: "r2", handId: "r2:1", kind: "SPLIT", idempotencyKey: "split:r2:1" });
    await settle("push", "r2:0", "r2"); // +10
    await settle("loss", "r2:1", "r2"); // +0
  }

  const signed = (tx: Transaction) => (tx.kind === "DEPOSIT" || tx.kind === "PAYOUT" ? tx.amount : -tx.amount);

  it("AC-13.1 history shows deposit, bet, double, split and payouts with round and hand", async () => {
    await playMixedSequence();
    const txs = await engine.listTransactions(accountId);
    expect(txs.map((t) => [t.kind, t.roundId, t.handId, t.outcome])).toEqual([
      ["PAYOUT", "r2", "r2:1", "loss"],
      ["PAYOUT", "r2", "r2:0", "push"],
      ["SPLIT", "r2", "r2:1", undefined],
      ["BET", "r2", "r2:0", undefined],
      ["PAYOUT", "r1", "r1:0", "win"],
      ["DOUBLE", "r1", "r1:0", undefined],
      ["BET", "r1", "r1:0", undefined],
      ["DEPOSIT", undefined, undefined, undefined],
    ]);
    expect(txs[txs.length - 1]).not.toHaveProperty("roundId");
  });

  it("AC-13.2 sum of signed transactions equals balance", async () => {
    await playMixedSequence();
    const txs = await engine.listTransactions(accountId);
    const sum = txs.reduce((acc, tx) => acc + signed(tx), 0);
    expect(sum).toBe(await balance());
    expect(sum).toBe(110);
    expect(txs[0].balanceAfter).toBe(sum);
  });
});
