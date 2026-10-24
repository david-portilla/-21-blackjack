// Omens (R17) on the real engine ledger: rounds played through the real game service fulfil the omens.
import { beforeEach, describe, expect, it } from "vitest";
import type { CasinoEngine } from "@/contracts/engine";
import { fixtures, type DeckFixture } from "@/contracts/fixtures";
import { openDb } from "@/engine/db";
import { createEngine, type Engine } from "@/engine/engine";
import { createRuns } from "@/engine/runs";
import { createGameService, type GameService } from "@/game/service/service";
import { createGameStore } from "@/game/service/store";
import { isFulfilled, omenFor, omenStatus, type OmenId } from "./omens";

let engine: Engine;
let game: GameService;
let decks: DeckFixture[];
let accountId: string;

beforeEach(async () => {
  const db = openDb(":memory:");
  engine = createEngine(db);
  const runs = createRuns(db);
  const casino: CasinoEngine = {
    getSessionAccount: async () => null,
    debit: (i) => engine.debit(i),
    settle: (i) => engine.settle(i),
    closeRun: (i) => runs.closeRun(i),
    claimSpareCandle: (i) => engine.claimSpareCandle(i),
  };
  decks = [];
  game = createGameService({ engine: casino, store: createGameStore(db), newDeck: () => decks.shift()!.cards });
  accountId = (await engine.signIn("omen-seeker")).accountId;
  await engine.deposit({ accountId, amount: 100, idempotencyKey: "dep" });
});

const ledger = () => engine.listTransactions(accountId);

async function play(deck: DeckFixture, firstAction?: "double" | "split") {
  decks.push(deck);
  let view = await game.startRound(accountId, 10, `k-${deck.name}`);
  if (firstAction && view.activeHandId) view = await game.act(accountId, view.roundId, view.activeHandId, firstAction, view.version);
  while (view.status !== "settled" && view.activeHandId) {
    view = await game.act(accountId, view.roundId, view.activeHandId, "stand", view.version);
  }
  return view;
}

describe("omens on the real ledger", () => {
  it.each<[OmenId, DeckFixture, "double" | "split" | undefined]>([
    ["blackjack", fixtures.playerNatural, undefined],
    ["push", fixtures.bothNatural, undefined],
    ["double-win", fixtures.double56, "double"],
    ["split", fixtures.split88, "split"],
  ])("AC-17.2 a real round fulfils %s", async (id, deck, action) => {
    expect(isFulfilled(id, await ledger())).toBe(false);
    await play(deck, action);
    expect(isFulfilled(id, await ledger())).toBe(true);
  });

  it("AC-17.2 a doubled hand that loses does not fulfil double-win on the real ledger", async () => {
    await play(fixtures.hitBust); // a loss without a double
    expect(isFulfilled("double-win", await ledger())).toBe(false);
  });

  it("AC-17.4 today's status reads the account's own real ledger", async () => {
    const today = omenFor(new Date().toISOString().slice(0, 10)).id;
    const deck = { blackjack: fixtures.playerNatural, push: fixtures.bothNatural, "double-win": fixtures.double56, split: fixtures.split88 }[today];
    await play(deck, today === "double-win" ? "double" : today === "split" ? "split" : undefined);
    expect(omenStatus(await ledger(), new Date())).toMatchObject({ fulfilled: true, streak: 1 });
  });
});

describe("omens ladder and spare candle on the real engine and game (R18)", () => {
  const fourSigns = async () => {
    await play(fixtures.playerNatural);
    await play(fixtures.bothNatural);
    await play(fixtures.double56, "double");
    await play(fixtures.split88, "split");
  };

  it("AC-18.3 AC-18.4 all four signs in one day reach tier III, with its sigils and the Marked title", async () => {
    await fourSigns();
    expect(omenStatus(await ledger(), new Date())).toMatchObject({
      ladder: { tier: 3, next: null },
      sigils: { 1: 1, 2: 1, 3: 1 },
      title: "Marked",
    });
  });

  it("AC-18.5 AC-18.8 no spare candle without tier III; claims are idempotent by run", async () => {
    expect(await engine.claimSpareCandle({ accountId, runId: "r1" })).toBe(false);
    await fourSigns();
    expect(await engine.claimSpareCandle({ accountId, runId: "r1" })).toBe(false); // first answer stands
    expect(await engine.claimSpareCandle({ accountId, runId: "r2" })).toBe(true);
    expect(await engine.claimSpareCandle({ accountId, runId: "r2" })).toBe(true);
    expect(await engine.claimSpareCandle({ accountId, runId: "r3" })).toBe(false); // spent, capped at 1
  });

  it("AC-18.5 tier III lights a fourth candle on the next run, once, and never moves credits", async () => {
    await fourSigns();
    // Finish the open run: three lost rounds snuff its three candles.
    for (let i = 0; i < 3; i++) await play({ ...fixtures.dealerNatural, name: `loss-${i}` });
    const before = (await engine.getAccount(accountId)).balance;
    const next = await play({ ...fixtures.dealerDraws, name: "next-run" });
    expect(next.run).toMatchObject({ startingCandles: 4, candles: 4 });
    expect((await engine.getAccount(accountId)).balance - before).toBe(10); // just the round's own win
  });
});
