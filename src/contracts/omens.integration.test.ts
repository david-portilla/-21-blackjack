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
