import { beforeEach, describe, expect, it } from "vitest";
import { fixtures, type DeckFixture } from "@/contracts/fixtures";
import type { CasinoEngine } from "@/contracts/engine";
import { openDb } from "@/engine/db";
import { createEngine, type Engine } from "@/engine/engine";
import { createRuns, type Runs } from "@/engine/runs";
import { createGameService, type GameService } from "./service";
import { createGameStore } from "./store";

let engine: Engine;
let runs: Runs;
let game: GameService;
let decks: DeckFixture[];
let accountId: string;

async function setup(balance: number) {
  const db = openDb(":memory:");
  engine = createEngine(db);
  runs = createRuns(db);
  const casino: CasinoEngine = {
    getSessionAccount: async () => null,
    debit: (i) => engine.debit(i),
    settle: (i) => engine.settle(i),
    closeRun: (i) => runs.closeRun(i),
    claimSpareCandle: (i) => engine.claimSpareCandle(i),
  };
  decks = [];
  game = createGameService({ engine: casino, store: createGameStore(db), newDeck: () => decks.shift()!.cards });
  accountId = (await engine.signIn("heriberto")).accountId;
  if (balance > 0) await engine.deposit({ accountId, amount: balance, idempotencyKey: "dep" });
}

const balance = async () => (await engine.getAccount(accountId)).balance;
const kinds = async () => (await engine.listTransactions(accountId)).map((t) => t.kind).reverse();

beforeEach(() => setup(100));

describe("bet", () => {
  it("AC-3.1 a bet debits the stake and starts a round", async () => {
    decks.push(fixtures.dealerDraws);
    const view = await game.startRound(accountId, 10, "k1");
    expect(view.status).toBe("player_turn");
    expect(await balance()).toBe(90);
    expect(await kinds()).toEqual(["DEPOSIT", "BET"]);
  });

  it("AC-3.2 insufficient funds: rejected, no round, no run, balance unchanged", async () => {
    decks.push(fixtures.dealerDraws);
    await expect(game.startRound(accountId, 500, "k1")).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await balance()).toBe(100);
    expect(await game.currentRound(accountId)).toBeNull();
    expect(await game.currentRun(accountId)).toBeNull();
  });

  it("AC-3.3 one unfinished round per account; the same key returns the same round, debited once", async () => {
    decks.push(fixtures.dealerDraws);
    const first = await game.startRound(accountId, 10, "k1");
    expect(await game.startRound(accountId, 10, "k1")).toEqual(first);
    await expect(game.startRound(accountId, 10, "k2")).rejects.toMatchObject({ code: "ROUND_IN_PROGRESS" });
    expect(await balance()).toBe(90);
  });

  it("AC-4.3 no response contains the hidden card or the deck", async () => {
    decks.push(fixtures.dealerDraws);
    const view = await game.startRound(accountId, 10, "k1");
    expect(view.dealer.cards[1]).toEqual({ hidden: true });
    expect(JSON.stringify(view)).not.toMatch(/deck|"6"/);
  });
});

describe("settlement", () => {
  it("AC-11.4 AC-6.2 a natural settles at once: 100 becomes 110", async () => {
    decks.push(fixtures.playerNatural);
    const view = await game.startRound(accountId, 10, "k1");
    expect(view.status).toBe("settled");
    expect(view.hands[0]).toMatchObject({ outcome: "blackjack", payout: 20 });
    expect(await balance()).toBe(110);
  });

  it("AC-11.4 push returns the stake, loss returns nothing", async () => {
    decks.push(fixtures.bothNatural, fixtures.dealerNatural);
    await game.startRound(accountId, 10, "k1");
    expect(await balance()).toBe(100);
    await game.startRound(accountId, 10, "k2");
    expect(await balance()).toBe(90);
  });

  it("AC-8.2 AC-11.1 stand: the dealer plays and each hand is paid once", async () => {
    decks.push(fixtures.dealerDraws);
    const start = await game.startRound(accountId, 10, "k1");
    const end = await game.act(accountId, start.roundId, start.hands[0].handId, "stand", start.version);
    expect(end.status).toBe("settled");
    expect(end.dealer.cards).toHaveLength(4);
    expect(await kinds()).toEqual(["DEPOSIT", "BET", "PAYOUT"]);
    expect(await balance()).toBe(110);
  });
});

describe("double and split", () => {
  it("AC-9.2 AC-9.5 double: extra stake debited, win returns 40", async () => {
    decks.push(fixtures.double56);
    const start = await game.startRound(accountId, 10, "k1");
    const end = await game.act(accountId, start.roundId, start.hands[0].handId, "double", start.version);
    expect(end.hands[0]).toMatchObject({ stake: 20, outcome: "win", payout: 40 });
    expect(await kinds()).toEqual(["DEPOSIT", "BET", "DOUBLE", "PAYOUT"]);
    expect(await balance()).toBe(120);
  });

  it("AC-9.4 double without funds: INSUFFICIENT_FUNDS, state unchanged", async () => {
    await setup(10);
    decks.push(fixtures.double56);
    const start = await game.startRound(accountId, 10, "k1");
    await expect(game.act(accountId, start.roundId, start.hands[0].handId, "double", start.version)).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    expect(await game.currentRound(accountId)).toEqual(start);
    expect(await balance()).toBe(0);
  });

  it("AC-10.2 AC-10.8 split 8+8: one win and one loss return 20, no candle lost", async () => {
    decks.push(fixtures.split88);
    let view = await game.startRound(accountId, 10, "k1");
    const [left, right] = [`${view.roundId}:0`, `${view.roundId}:1`];
    view = await game.act(accountId, view.roundId, left, "split", view.version);
    view = await game.act(accountId, view.roundId, left, "stand", view.version);
    view = await game.act(accountId, view.roundId, right, "stand", view.version);
    expect(view.hands.map((h) => [h.outcome, h.payout])).toEqual([["win", 20], ["loss", 0]]);
    expect(await kinds()).toEqual(["DEPOSIT", "BET", "SPLIT", "PAYOUT", "PAYOUT"]);
    expect(await balance()).toBe(100);
    expect(view.run).toMatchObject({ candles: 3, roundsWon: 0 });
  });
});

describe("integrity", () => {
  it("AC-12.2 a repeated action with an old version draws nothing", async () => {
    decks.push(fixtures.softToHard);
    const start = await game.startRound(accountId, 10, "k1");
    const hit = await game.act(accountId, start.roundId, start.hands[0].handId, "hit", start.version);
    const stale = await game.act(accountId, start.roundId, start.hands[0].handId, "hit", start.version).catch((e) => e);
    expect(stale.code).toBe("STALE_VERSION");
    expect(stale.round).toEqual(hit);
  });

  it("an action that is not allowed is INVALID_ACTION and moves nothing", async () => {
    decks.push(fixtures.dealerDraws);
    const start = await game.startRound(accountId, 10, "k1");
    await expect(game.act(accountId, start.roundId, start.hands[0].handId, "split", start.version)).rejects.toMatchObject({
      code: "INVALID_ACTION",
    });
    expect(await balance()).toBe(90);
  });
});

describe("candles", () => {
  it("AC-16.4 AC-16.9 three lost rounds snuff three candles and the engine stores the run", async () => {
    decks.push(fixtures.dealerNatural, fixtures.dealerNatural, fixtures.dealerNatural);
    let view = await game.startRound(accountId, 10, "a");
    expect(view.run).toMatchObject({ candles: 2, ended: false });
    await game.startRound(accountId, 10, "b");
    view = await game.startRound(accountId, 10, "c");
    expect(view.run).toMatchObject({ candles: 0, ended: true });
    expect(await game.currentRun(accountId)).toBeNull();
    const stored = await runs.listRuns(accountId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ runId: view.run.runId, net: -30, roundsSurvived: 0 });
  });

  it("AC-16.5 AC-16.8 the next bet after a run ends lights a new run; candles never move money", async () => {
    decks.push(fixtures.dealerNatural, fixtures.dealerNatural, fixtures.dealerNatural, fixtures.playerNatural);
    for (const k of ["a", "b", "c"]) await game.startRound(accountId, 10, k);
    const first = await game.startRound(accountId, 10, "d");
    expect(first.run).toMatchObject({ candles: 3, roundsWon: 1, ended: false });
    expect(await balance()).toBe(80);
  });
});
