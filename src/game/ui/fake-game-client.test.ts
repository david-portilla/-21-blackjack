import { beforeEach, describe, expect, it } from "vitest";
import { fixtures, type DeckFixture } from "@/contracts/fixtures";
import { createFakeGameClient } from "./fake-game-client";
import { GameError, type GameClient } from "./game-client";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("fake game client", () => {
  let decks: DeckFixture[];
  let game: GameClient;
  beforeEach(() => {
    decks = [];
    const store = memoryStore();
    game = createFakeGameClient(() => store, () => decks.shift()!.cards);
  });

  it("AC-4.3 an open round shows the dealer's second card as hidden", async () => {
    decks.push(fixtures.dealerDraws);
    const view = await game.startRound(10, "k1");
    expect(view.status).toBe("player_turn");
    expect(view.dealer.cards[1]).toEqual({ hidden: true });
    expect(await game.currentRound()).toEqual(view);
  });

  it("AC-6.2 a natural settles at once and reveals the dealer", async () => {
    decks.push(fixtures.playerNatural);
    const view = await game.startRound(10, "k1");
    expect(view.status).toBe("settled");
    expect(view.hands[0]).toMatchObject({ outcome: "blackjack", payout: 20 });
    expect(view.dealer.cards).toHaveLength(2);
    expect(await game.currentRound()).toBeNull();
  });

  it("AC-12.2 a stale version draws nothing and returns the current round", async () => {
    decks.push(fixtures.softToHard);
    const start = await game.startRound(10, "k1");
    const hit = await game.act(start.roundId, { handId: start.hands[0].handId, action: "hit", version: start.version });
    const stale = await game.act(start.roundId, { handId: start.hands[0].handId, action: "hit", version: start.version }).catch((e) => e);
    expect(stale).toBeInstanceOf(GameError);
    expect(stale.code).toBe("STALE_VERSION");
    expect(stale.round).toEqual(hit);
  });

  it("a retried bet with the same key returns the same round; another key is ROUND_IN_PROGRESS", async () => {
    decks.push(fixtures.dealerDraws);
    const first = await game.startRound(10, "k1");
    expect(await game.startRound(10, "k1")).toEqual(first);
    await expect(game.startRound(10, "k2")).rejects.toMatchObject({ code: "ROUND_IN_PROGRESS" });
  });

  it("AC-3.1 a stake that is not a positive whole number is INVALID_AMOUNT", async () => {
    await expect(game.startRound(0, "k1")).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(game.startRound(2.5, "k2")).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("AC-16.4 three lost rounds snuff three candles and end the run", async () => {
    decks.push(fixtures.dealerNatural, fixtures.dealerNatural, fixtures.dealerNatural);
    let view = await game.startRound(10, "a");
    expect(view.run).toMatchObject({ candles: 2, ended: false });
    view = await game.startRound(10, "b");
    view = await game.startRound(10, "c");
    expect(view.run).toMatchObject({ candles: 0, ended: true });
    expect(await game.currentRun()).toBeNull();
  });
});
