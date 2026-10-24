import { beforeEach, describe, expect, it } from "vitest";
import { createFakeEngineClient } from "./fake-engine-client";
import type { EngineClient } from "./engine-client";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("fake engine client", () => {
  let engine: EngineClient;
  beforeEach(() => {
    const store = memoryStore();
    engine = createFakeEngineClient(() => store);
  });

  it("AC-1.1 a new account starts at balance 0", async () => {
    const account = await engine.signIn("dealer_bait");
    expect(account.balance).toBe(0);
    expect(await engine.me()).toEqual(account);
  });

  it("AC-1.2 an existing username signs into the same account, case-insensitive", async () => {
    const first = await engine.signIn("Leshy");
    const again = await engine.signIn("leshy");
    expect(again.accountId).toBe(first.accountId);
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

  it("rejects a reused key with a different amount", async () => {
    await engine.signIn("player");
    await engine.deposit(50, "same");
    await expect(engine.deposit(70, "same")).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
});
