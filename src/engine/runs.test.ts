import { beforeEach, describe, expect, it } from "vitest";
import type { Outcome } from "@/contracts/types";
import { openDb } from "./db";
import { createEngine, type Engine } from "./engine";
import { createRuns, type Runs } from "./runs";

let engine: Engine;
let runs: Runs;
let accountId: string;

beforeEach(async () => {
  const db = openDb(":memory:");
  engine = createEngine(db);
  runs = createRuns(db);
  accountId = (await engine.signIn("alice")).accountId;
  await engine.deposit({ accountId, amount: 100, idempotencyKey: "dep:100" });
});

const bet = (roundId: string, amount: number, account = accountId) =>
  engine.debit({
    accountId: account,
    roundId,
    handId: `${roundId}:0`,
    kind: "BET",
    amount,
    idempotencyKey: `bet:${roundId}`,
  });
const double = (roundId: string) =>
  engine.debit({ accountId, roundId, handId: `${roundId}:0`, kind: "DOUBLE", idempotencyKey: `double:${roundId}` });
const split = (roundId: string) =>
  engine.debit({ accountId, roundId, handId: `${roundId}:1`, kind: "SPLIT", idempotencyKey: `split:${roundId}` });
const settle = (handId: string, outcome: Outcome, account = accountId) =>
  engine.settle({
    accountId: account,
    roundId: handId.split(":")[0],
    handId,
    outcome,
    idempotencyKey: `payout:${handId}`,
  });

const balance = async () => (await engine.getAccount(accountId)).balance;

describe("closeRun (11)", () => {
  it("AC-16.9 closeRun computes net from the run's rounds", async () => {
    // r1: bet 10, win -> +10. r2: bet 10, loss -> -10. r3: bet 10, double 10, win 40 -> +20.
    // r4: bet 10, split 10, one win (20) and one loss -> 0.
    await bet("r1", 10);
    await settle("r1:0", "win");
    await bet("r2", 10);
    await settle("r2:0", "loss");
    await bet("r3", 10);
    await double("r3");
    await settle("r3:0", "win");
    await bet("r4", 10);
    await split("r4");
    await settle("r4:0", "win");
    await settle("r4:1", "loss");

    const run = await runs.closeRun({ accountId, runId: "run1", roundIds: ["r1", "r2", "r3", "r4"], roundsSurvived: 3 });
    expect(run).toEqual({ runId: "run1", accountId, roundsSurvived: 3, net: 20, endedAt: expect.any(String) });

    const lossOnly = await runs.closeRun({ accountId, runId: "run2", roundIds: ["r2"], roundsSurvived: 0 });
    expect(lossOnly.net).toBe(-10);
    const empty = await runs.closeRun({ accountId, runId: "run3", roundIds: [], roundsSurvived: 0 });
    expect(empty.net).toBe(0);
  });

  it("AC-16.9 transactions of rounds outside roundIds are ignored", async () => {
    await bet("r1", 10);
    await settle("r1:0", "loss");
    await bet("r2", 10);
    await settle("r2:0", "blackjack");

    const bob = (await engine.signIn("bob")).accountId;
    await engine.deposit({ accountId: bob, amount: 50, idempotencyKey: "dep:bob" });
    await bet("r1", 30, bob);
    await settle("r1:0", "win", bob);

    const run = await runs.closeRun({ accountId, runId: "run1", roundIds: ["r1"], roundsSurvived: 0 });
    expect(run.net).toBe(-10);
  });

  it("AC-16.8 closeRun does not change the balance", async () => {
    await bet("r1", 10);
    await settle("r1:0", "win");
    const before = await balance();
    const txsBefore = await engine.listTransactions(accountId);

    await runs.closeRun({ accountId, runId: "run1", roundIds: ["r1"], roundsSurvived: 1 });

    expect(await balance()).toBe(before);
    expect(await engine.listTransactions(accountId)).toEqual(txsBefore);
  });

  it("AC-16.2 same runId returns the stored run", async () => {
    await bet("r1", 10);
    await settle("r1:0", "loss");
    const first = await runs.closeRun({ accountId, runId: "run1", roundIds: ["r1"], roundsSurvived: 2 });

    await bet("r2", 10);
    await settle("r2:0", "win");
    const again = await runs.closeRun({ accountId, runId: "run1", roundIds: ["r1", "r2"], roundsSurvived: 5 });

    expect(again).toEqual(first);
    expect(await runs.listRuns(accountId)).toEqual([first]);
  });
});

describe("listRuns (12)", () => {
  it("AC-16.3 listRuns returns the account's runs newest first, not other accounts' runs", async () => {
    const bob = (await engine.signIn("bob")).accountId;
    const a1 = await runs.closeRun({ accountId, runId: "a1", roundIds: [], roundsSurvived: 1 });
    const b1 = await runs.closeRun({ accountId: bob, runId: "b1", roundIds: [], roundsSurvived: 4 });
    const a2 = await runs.closeRun({ accountId, runId: "a2", roundIds: [], roundsSurvived: 2 });

    expect(await runs.listRuns(accountId)).toEqual([a2, a1]);
    expect(await runs.listRuns(bob)).toEqual([b1]);
    expect(await runs.listRuns("nobody")).toEqual([]);
  });
});
