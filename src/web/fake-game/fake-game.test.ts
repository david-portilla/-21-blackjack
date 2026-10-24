import { beforeEach, describe, expect, it } from "vitest";
import type { Card, Rank } from "@/contracts/types";
import { createFakeEngineClient, type FakeEngine } from "../fake-engine-client";
import { createFakeGame, type FakeGame } from "./fake-game";
import { handTotal } from "./rules";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

// Deal order: player, dealer (up), player, dealer (hidden), then hits in order.
const deck = (...ranks: Rank[]): Card[] => ranks.map((rank) => ({ rank, suit: "S" }));
const filler = deck("2", "2", "2", "2", "2", "2", "2", "2");

describe("fake game", () => {
  let engine: FakeEngine;
  let game: FakeGame;
  let decks: Card[][];

  beforeEach(async () => {
    const store = memoryStore();
    engine = createFakeEngineClient(() => store);
    decks = [];
    game = createFakeGame(() => store, engine, () => [...(decks.shift() ?? []), ...filler]);
    await engine.signIn("player");
    await engine.deposit(100, "seed");
  });

  const balance = async () => (await engine.me())?.balance;

  it("AC-5.2 AC-5.3 aces are flexible and A+6 is soft 17", () => {
    expect(handTotal(deck("A", "6"))).toEqual({ total: 17, soft: true });
    expect(handTotal(deck("A", "6", "10"))).toEqual({ total: 17, soft: false });
    expect(handTotal(deck("A", "A", "9"))).toEqual({ total: 21, soft: true });
  });

  it("AC-4.3 the dealer's second card is hidden until the round settles", async () => {
    decks.push(deck("10", "9", "6", "7"));
    const round = await game.start(10, "k");
    expect(round.dealer.cards[1]).toEqual({ hidden: true });
    expect(round.dealer.total).toBeUndefined();
  });

  it("AC-3.2 a bet above the balance is rejected and no round starts", async () => {
    await expect(game.start(500, "k")).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await game.current()).toBeNull();
    expect(await balance()).toBe(100);
  });

  it("AC-6.2 a player natural wins at once and pays 2x", async () => {
    decks.push(deck("A", "9", "K", "7"));
    const round = await game.start(10, "k");
    expect(round.status).toBe("settled");
    expect(round.hands[0]).toMatchObject({ outcome: "blackjack", payout: 20 });
    expect(await balance()).toBe(110);
  });

  it("AC-6.2 both naturals push", async () => {
    decks.push(deck("A", "A", "K", "Q"));
    const round = await game.start(10, "k");
    expect(round.hands[0]).toMatchObject({ outcome: "push", payout: 10 });
    expect(await balance()).toBe(100);
  });

  it("AC-8.2 the dealer stands on soft 17", async () => {
    decks.push(deck("10", "A", "9", "6"));
    const round = await game.start(10, "k");
    const done = await game.act(round.roundId, round.hands[0].handId, "stand", round.version);
    expect(done.dealer.cards).toHaveLength(2);
    expect(done.dealer.total).toBe(17);
    expect(done.hands[0].outcome).toBe("win");
  });

  it("AC-9.5 double on 5+6: stake 20, one card, win returns 40", async () => {
    decks.push(deck("5", "9", "6", "7", "10", "2"));
    const round = await game.start(10, "k");
    expect(round.hands[0].allowedActions).toContain("double");
    const done = await game.act(round.roundId, round.hands[0].handId, "double", round.version);
    expect(done.hands[0]).toMatchObject({ stake: 20, total: 21, outcome: "win", payout: 40 });
    expect(done.hands[0].cards).toHaveLength(3);
    expect(await balance()).toBe(120);
  });

  it("AC-9.4 double without funds is rejected and nothing changes", async () => {
    decks.push(deck("5", "9", "6", "7"));
    const round = await game.start(100, "k");
    await expect(game.act(round.roundId, round.hands[0].handId, "double", round.version)).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    const same = await game.current();
    expect(same?.version).toBe(round.version);
    expect(same?.hands[0].cards).toHaveLength(2);
    expect(await balance()).toBe(0);
  });

  it("AC-10.8 split 8+8: two 10-credit hands, one win and one loss return 20", async () => {
    decks.push(deck("8", "10", "8", "7", "10", "5"));
    const round = await game.start(10, "k");
    const split = await game.act(round.roundId, round.hands[0].handId, "split", round.version);
    expect(split.hands.map((h) => [h.stake, h.total])).toEqual([[10, 18], [10, 13]]);
    expect(split.hands[0].allowedActions).not.toContain("split");
    const left = await game.act(split.roundId, split.hands[0].handId, "stand", split.version);
    const done = await game.act(left.roundId, left.hands[1].handId, "stand", left.version);
    expect(done.hands.map((h) => h.outcome)).toEqual(["win", "loss"]);
    expect(await balance()).toBe(100);
  });

  it("AC-10.4 AC-6.3 split aces take one card each; A+K after a split is a normal win", async () => {
    decks.push(deck("A", "9", "A", "8", "K", "5"));
    const round = await game.start(10, "k");
    const done = await game.act(round.roundId, round.hands[0].handId, "split", round.version);
    expect(done.status).toBe("settled");
    expect(done.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(done.hands.map((h) => h.outcome)).toEqual(["win", "loss"]);
    expect(done.hands[0].payout).toBe(20);
  });

  it("AC-12.2 a stale action draws nothing", async () => {
    decks.push(deck("10", "9", "2", "7"));
    const round = await game.start(10, "k");
    const hit = await game.act(round.roundId, round.hands[0].handId, "hit", round.version);
    await expect(game.act(round.roundId, round.hands[0].handId, "hit", round.version)).rejects.toMatchObject({
      code: "STALE_VERSION",
    });
    expect((await game.current())?.hands[0].cards).toHaveLength(hit.hands[0].cards.length);
  });

  it("AC-12.1 retrying a bet with the same key starts one round and debits once", async () => {
    decks.push(deck("10", "9", "6", "7"));
    const first = await game.start(10, "same");
    const again = await game.start(10, "same");
    expect(again.roundId).toBe(first.roundId);
    expect(await balance()).toBe(90);
  });

  it("AC-16.1 AC-16.2 AC-16.4 three lost rounds snuff three candles and record the run", async () => {
    for (let i = 0; i < 3; i++) decks.push(deck("10", "10", "6", "9"));
    let round = await game.start(10, "r1");
    expect(round.run.candles).toBe(3);
    for (const key of ["r1", "r2", "r3"]) {
      if (key !== "r1") round = await game.start(10, key);
      round = await game.act(round.roundId, round.hands[0].handId, "stand", round.version);
    }
    expect(round.run).toMatchObject({ candles: 0, ended: true, roundsSurvived: 2 });
    expect(await engine.runs()).toMatchObject([{ roundsSurvived: 2, net: -30 }]);
    const next = await game.start(10, "r4");
    expect(next.run.candles).toBe(3);
  });

  it("AC-16.6 a push snuffs nothing", async () => {
    decks.push(deck("10", "10", "8", "8"));
    const round = await game.start(10, "k");
    const done = await game.act(round.roundId, round.hands[0].handId, "stand", round.version);
    expect(done.hands[0].outcome).toBe("push");
    expect(done.run.candles).toBe(3);
  });
});
