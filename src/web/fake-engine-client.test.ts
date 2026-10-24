import { beforeEach, describe, expect, it } from "vitest";
import { createFakeEngineClient, type FakeEngine } from "./fake-engine-client";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("fake engine client", () => {
  let engine: FakeEngine;
  beforeEach(() => {
    const store = memoryStore();
    engine = createFakeEngineClient(() => store);
  });

  it("AC-1.1 a new account starts at balance 0", async () => {
    const account = await engine.signIn("dealer_bait");
    expect(account.balance).toBe(0);
    expect(await engine.me()).toEqual(account);
  });

  it("AC-1.2 an existing username signs into the same account (trimmed, case-sensitive like the engine)", async () => {
    const first = await engine.signIn("Leshy");
    expect((await engine.signIn("  Leshy ")).accountId).toBe(first.accountId);
    expect((await engine.signIn("leshy")).accountId).not.toBe(first.accountId);
  });

  it("signing out ends the session", async () => {
    await engine.signIn("player");
    await engine.signOut();
    expect(await engine.me()).toBeNull();
  });

  it("AC-2.1 a deposit adds exactly its amount and records a DEPOSIT", async () => {
    await engine.signIn("player");
    const tx = await engine.deposit(100, "k1");
    expect(tx).toMatchObject({ kind: "DEPOSIT", amount: 100, balanceAfter: 100 });
    expect((await engine.me())?.balance).toBe(100);
  });

  it.each([0, -5, 2.5, Number.NaN])("AC-2.2 rejects %s with INVALID_AMOUNT and changes nothing", async (amount) => {
    await engine.signIn("player");
    await expect(engine.deposit(amount, `bad-${amount}`)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect((await engine.me())?.balance).toBe(0);
    expect(await engine.transactions()).toHaveLength(0);
  });

  it("AC-2.3 retrying a deposit with the same key credits once", async () => {
    await engine.signIn("player");
    const first = await engine.deposit(50, "same");
    const retry = await engine.deposit(50, "same");
    expect(retry.transactionId).toBe(first.transactionId);
    expect((await engine.me())?.balance).toBe(50);
  });

  it("a reused key returns the original even with another amount (engine contract)", async () => {
    await engine.signIn("player");
    const first = await engine.deposit(50, "same");
    expect((await engine.deposit(70, "same")).transactionId).toBe(first.transactionId);
    expect((await engine.me())?.balance).toBe(50);
  });

  it("DOUBLE and SPLIT amounts come from the recorded stakes, not the caller", async () => {
    await engine.signIn("player");
    await engine.deposit(100, "d");
    await engine.debit({ roundId: "r", handId: "r:0", kind: "BET", amount: 10, idempotencyKey: "bet:r:0" });
    const split = await engine.debit({ roundId: "r", handId: "r:1", kind: "SPLIT", amount: 999, idempotencyKey: "split:r:1" });
    const double = await engine.debit({ roundId: "r", handId: "r:0", kind: "DOUBLE", idempotencyKey: "double:r:0" });
    expect([split.amount, double.amount]).toEqual([10, 10]);
    expect((await engine.me())?.balance).toBe(70);
  });
});
