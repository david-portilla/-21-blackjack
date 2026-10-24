import { describe, expect, it } from "vitest";
import { card, fixtures, type DeckFixture } from "@/contracts/fixtures";
import type { Card } from "@/contracts/types";
import { freshDeck, handValue, shuffledDeck } from "./cards";
import { allowedActions, applyAction, deal, RuleError, type Draw, type RoundState } from "./round";
import { recordRound, roundNet, startRun } from "./run";
import { toRoundView } from "./view";

function drawFrom(f: DeckFixture): Draw & { drawn: () => number } {
  let i = 0;
  const draw = () => {
    if (i >= f.cards.length) throw new Error(`fixture ${f.name} ran out of cards`);
    return f.cards[i++];
  };
  return Object.assign(draw, { drawn: () => i });
}

const R = "r1";
const H0 = "r1:0";
const H1 = "r1:1";
const cards = (codes: string): Card[] => codes.split(" ").map(card);
const run = { runId: "run1", candles: 3, roundsWon: 0, ended: false };

function play(f: DeckFixture, stake: number, actions: [string, "hit" | "stand" | "double" | "split"][]): RoundState {
  const draw = drawFrom(f);
  let round = deal(R, stake, draw);
  for (const [id, action] of actions) round = applyAction(round, id, action, draw);
  return round;
}

describe("R4 deck and deal", () => {
  it("AC-4.1 a shuffled deck has 52 distinct cards", () => {
    const deck = shuffledDeck();
    expect(new Set(deck.map((c) => c.rank + c.suit)).size).toBe(52);
    expect(freshDeck()).toHaveLength(52);
  });

  it("AC-4.2 player and dealer get two cards each, dealer second card hidden", () => {
    const round = deal(R, 10, drawFrom(fixtures.dealerDraws));
    expect(round.hands[0].cards).toEqual(cards("10H 9D"));
    expect(round.dealer).toEqual(cards("5S 6C"));
    const view = toRoundView(round, { version: 1, settled: false, run });
    expect(view.dealer.cards).toEqual([card("5S"), { hidden: true }]);
  });

  it("AC-4.3 the unsettled view never contains the hidden card or a dealer total", () => {
    const round = deal(R, 10, drawFrom(fixtures.dealerDraws));
    const json = JSON.stringify(toRoundView(round, { version: 1, settled: false, run }));
    expect(json).not.toContain('"6"');
    expect(json).not.toContain("total\":11");
    expect(toRoundView(round, { version: 1, settled: false, run }).dealer.total).toBeUndefined();
  });
});

describe("R5 card values", () => {
  it("AC-5.1 number cards count face value, J/Q/K count 10", () => {
    expect(handValue(cards("2H 10S")).total).toBe(12);
    expect(handValue(cards("JH QS KD")).total).toBe(30);
  });

  it("AC-5.2 an ace counts 11 while the total stays <= 21, then 1", () => {
    expect(handValue(cards("AH 9S"))).toEqual({ total: 20, soft: true });
    expect(handValue(cards("AH 9S 5D"))).toEqual({ total: 15, soft: false });
    expect(handValue(cards("AH AS"))).toEqual({ total: 12, soft: true });
  });

  it("AC-5.3 A+6 is soft 17, A+6+10 is hard 17", () => {
    expect(handValue(cards("AH 6D"))).toEqual({ total: 17, soft: true });
    expect(handValue(cards("AH 6D 10C"))).toEqual({ total: 17, soft: false });
  });
});

describe("R6 naturals", () => {
  it("AC-6.1 AC-6.2 player natural only: blackjack, settles at once", () => {
    const round = deal(R, 10, drawFrom(fixtures.playerNatural));
    expect(round.phase).toBe("resolved");
    expect(round.hands[0].outcome).toBe("blackjack");
    expect(round.dealer).toHaveLength(2);
  });

  it("AC-6.2 dealer natural only: player loses at once", () => {
    const round = deal(R, 10, drawFrom(fixtures.dealerNatural));
    expect(round.phase).toBe("resolved");
    expect(round.hands[0].outcome).toBe("loss");
  });

  it("AC-6.2 both natural: push, hidden card revealed when settled", () => {
    const round = deal(R, 10, drawFrom(fixtures.bothNatural));
    expect(round.hands[0].outcome).toBe("push");
    expect(toRoundView(round, { version: 1, settled: true, run }).dealer.cards).toEqual(cards("AS QC"));
  });

  it("AC-6.3 A+10 after a split is a normal 21, not a natural", () => {
    const round = play(fixtures.splitAces, 10, [[H0, "split"]]);
    expect(round.hands[0].outcome).toBe("win");
  });
});

describe("R7 hit and stand", () => {
  it("AC-7.1 hit adds one card and the hand can hit again", () => {
    const round = play(fixtures.softToHard, 10, [[H0, "hit"]]);
    expect(round.hands[0].cards).toEqual(cards("AH 6D 10C"));
    expect(allowedActions(round, H0)).toEqual(["hit", "stand"]);
  });

  it("AC-7.2 stand finishes the hand", () => {
    const round = play(fixtures.softToHard, 10, [[H0, "hit"], [H0, "stand"]]);
    expect(round.hands[0].status).toBe("stood");
    expect(round.hands[0].outcome).toBe("push");
  });

  it("AC-7.3 over 21 busts and finishes", () => {
    const round = play(fixtures.hitBust, 10, [[H0, "hit"]]);
    expect(round.hands[0].status).toBe("busted");
    expect(round.hands[0].outcome).toBe("loss");
  });

  it("AC-7.3 exactly 21 finishes automatically", () => {
    const round = play(fixtures.hitTo21, 10, [[H0, "hit"]]);
    expect(round.hands[0].status).toBe("finished");
    expect(round.hands[0].outcome).toBe("win");
  });

  it("acting on a finished round is INVALID_ACTION", () => {
    const round = play(fixtures.hitBust, 10, [[H0, "hit"]]);
    expect(() => applyAction(round, H0, "hit", drawFrom(fixtures.hitBust))).toThrow(RuleError);
  });
});

describe("R8 dealer", () => {
  it("AC-8.1 AC-8.2 dealer draws below 17 and stands on 18", () => {
    const round = play(fixtures.dealerDraws, 10, [[H0, "stand"]]);
    expect(round.dealer).toEqual(cards("5S 6C 4H 3D"));
    expect(round.hands[0].outcome).toBe("win");
  });

  it("AC-8.2 dealer stands on soft 17", () => {
    const round = play(fixtures.dealerSoft17, 10, [[H0, "stand"]]);
    expect(round.dealer).toEqual(cards("AS 6C"));
    expect(round.hands[0].outcome).toBe("win");
  });

  it("AC-8.2 dealer still plays when every player hand busted (open question Q1)", () => {
    const draw = drawFrom(fixtures.hitBust);
    applyAction(deal(R, 10, draw), H0, "hit", draw);
    expect(draw.drawn()).toBe(5);
  });

  it("AC-8.3 dealer bust: non-busted hands win; equal totals push", () => {
    expect(play(fixtures.double56, 10, [[H0, "double"]]).hands[0].outcome).toBe("win");
    expect(play(fixtures.softToHard, 10, [[H0, "hit"], [H0, "stand"]]).hands[0].outcome).toBe("push");
  });
});

describe("R9 double down", () => {
  it("AC-9.1 allowed only on two cards before any hit", () => {
    expect(allowedActions(deal(R, 10, drawFrom(fixtures.double56)), H0)).toContain("double");
    expect(allowedActions(play(fixtures.softToHard, 10, [[H0, "hit"]]), H0)).not.toContain("double");
  });

  it("AC-9.3 AC-9.5 exactly one card, hand closes, stake 20", () => {
    const round = play(fixtures.double56, 10, [[H0, "double"]]);
    expect(round.hands[0].cards).toHaveLength(3);
    expect(round.hands[0].stake).toBe(20);
    expect(round.hands[0].status).toBe("finished");
  });
});

describe("R10 split", () => {
  it("AC-10.1 split only on the same rank, once per round", () => {
    expect(allowedActions(deal(R, 10, drawFrom(fixtures.split88)), H0)).toContain("split");
    expect(allowedActions(deal(R, 10, drawFrom(fixtures.dealerDraws)), H0)).not.toContain("split");
    const kq = deal(R, 10, () => card("KH"));
    kq.hands[0].cards = cards("KH QS");
    expect(allowedActions(kq, H0)).not.toContain("split");
    expect(allowedActions(play(fixtures.split88, 10, [[H0, "split"]]), H0)).not.toContain("split");
  });

  it("AC-10.3 one original card each, then a new card each, left first; left plays first", () => {
    const round = play(fixtures.split88, 10, [[H0, "split"]]);
    expect(round.hands.map((h) => h.cards)).toEqual([cards("8H 10S"), cards("8D 6H")]);
    expect(allowedActions(round, H0)).toEqual(["hit", "stand", "double"]);
    expect(allowedActions(round, H1)).toEqual([]);
  });

  it("AC-10.4 split aces get one card each and stand", () => {
    const round = play(fixtures.splitAces, 10, [[H0, "split"]]);
    expect(round.hands.map((h) => h.status)).toEqual(["finished", "finished"]);
    expect(round.phase).toBe("resolved");
  });

  it("AC-10.5 AC-10.6 AC-10.8 each hand settles against one dealer hand: one win, one loss", () => {
    const round = play(fixtures.split88, 10, [[H0, "split"], [H0, "stand"], [H1, "stand"]]);
    expect(round.dealer).toEqual(cards("10C 7S"));
    expect(round.hands.map((h) => [h.stake, h.outcome])).toEqual([[10, "win"], [10, "loss"]]);
  });
});

describe("R16 candles", () => {
  it("AC-16.1 AC-16.2 AC-16.4 three lost rounds snuff three candles and end the run", () => {
    let r = startRun("run1");
    for (const id of ["a", "b", "c"]) r = recordRound(r, id, -10);
    expect(r).toMatchObject({ candles: 0, ended: true, roundIds: ["a", "b", "c"] });
    expect(() => recordRound(r, "d", -10)).toThrow();
  });

  it("AC-16.6 split one win one loss nets 0 and snuffs nothing", () => {
    const net = roundNet([10, 10], [20, 0]);
    expect(net).toBe(0);
    expect(recordRound(startRun("run1"), "a", net)).toMatchObject({ candles: 3, roundsWon: 0 });
  });

  it("AC-16.7 candles never relight; positive rounds count as won", () => {
    let r = recordRound(startRun("run1"), "a", -10);
    r = recordRound(r, "b", 30);
    expect(r).toMatchObject({ candles: 2, roundsWon: 1 });
  });
});
