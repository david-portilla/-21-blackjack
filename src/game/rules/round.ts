// Pure round rules (R4 to R10). No I/O, no money: the service debits before calling an action that needs it.
import type { HandStatus } from "@/contracts/round";
import type { Action, Card, Outcome } from "@/contracts/types";
import { handValue, isTwoCard21 } from "./cards";

/** Next card from the round's deck: a stored shuffle in production, a fixture in tests. */
export type Draw = () => Card;

export type HandState = {
  handId: string;
  cards: Card[];
  stake: number;
  status: HandStatus;
  fromSplit: boolean;
  outcome?: Outcome;
};

export type RoundState = {
  roundId: string;
  /** `resolved`: every hand has an outcome and the dealer is done; money is still the service's job. */
  phase: "player_turn" | "resolved";
  /** Original stake, also the split stake (AC-10.2). */
  stake: number;
  dealer: Card[];
  hands: HandState[];
};

export class RuleError extends Error {
  readonly code = "INVALID_ACTION";
}

export function handId(roundId: string, index: 0 | 1): string {
  return `${roundId}:${index}`;
}

/** Deals two cards each in casino order and checks naturals at once (AC-4.2, R6). */
export function deal(roundId: string, stake: number, draw: Draw): RoundState {
  const p1 = draw();
  const d1 = draw();
  const p2 = draw();
  const d2 = draw();
  const round: RoundState = {
    roundId,
    phase: "player_turn",
    stake,
    dealer: [d1, d2],
    hands: [{ handId: handId(roundId, 0), cards: [p1, p2], stake, status: "playing", fromSplit: false }],
  };

  const playerNatural = isTwoCard21(round.hands[0].cards);
  const dealerNatural = isTwoCard21(round.dealer);
  if (!playerNatural && !dealerNatural) return round;

  // AC-6.2: settle at once, no dealer draw.
  const hand = round.hands[0];
  hand.status = "finished";
  hand.outcome = playerNatural && dealerNatural ? "push" : playerNatural ? "blackjack" : "loss";
  round.phase = "resolved";
  return round;
}

export function activeHand(round: RoundState): HandState | null {
  if (round.phase !== "player_turn") return null;
  return round.hands.find((h) => h.status === "playing") ?? null;
}

function isSplitAce(hand: HandState): boolean {
  return hand.fromSplit && hand.cards[0].rank === "A";
}

export function allowedActions(round: RoundState, id: string): Action[] {
  const hand = activeHand(round);
  if (!hand || hand.handId !== id || isSplitAce(hand)) return [];
  const actions: Action[] = ["hit", "stand"];
  // Two cards means no Hit yet (AC-9.1, AC-10.5).
  if (hand.cards.length === 2) actions.push("double");
  // AC-10.1: original two cards, same rank, once per round.
  if (!hand.fromSplit && round.hands.length === 1 && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank) {
    actions.push("split");
  }
  return actions;
}

/** Throws RuleError unless the action is allowed now. The service calls this before debiting. */
export function assertAllowed(round: RoundState, id: string, action: Action): void {
  if (!allowedActions(round, id).includes(action)) {
    throw new RuleError(`${action} is not allowed on ${id}`);
  }
}

/** Closes a hand that reached 21 or more (AC-7.3). */
function closeIfDone(hand: HandState): void {
  const { total } = handValue(hand.cards);
  if (total > 21) hand.status = "busted";
  else if (total === 21) hand.status = "finished";
}

export function applyAction(current: RoundState, id: string, action: Action, draw: Draw): RoundState {
  assertAllowed(current, id, action);
  const round = structuredClone(current);
  const hand = round.hands.find((h) => h.handId === id)!;

  switch (action) {
    case "hit":
      hand.cards.push(draw());
      closeIfDone(hand);
      break;
    case "stand":
      hand.status = "stood";
      break;
    case "double":
      // AC-9.2, AC-9.3: stake doubles, exactly one card, hand closes.
      hand.stake *= 2;
      hand.cards.push(draw());
      hand.status = handValue(hand.cards).total > 21 ? "busted" : "finished";
      break;
    case "split": {
      // AC-10.3: one original card each, then one new card each, left first.
      const [left, right] = hand.cards;
      const leftHand: HandState = { handId: handId(round.roundId, 0), cards: [left, draw()], stake: round.stake, status: "playing", fromSplit: true };
      const rightHand: HandState = { handId: handId(round.roundId, 1), cards: [right, draw()], stake: round.stake, status: "playing", fromSplit: true };
      for (const h of [leftHand, rightHand]) {
        // AC-10.4: split aces get one card and stand. Otherwise 21 closes the hand (a normal 21, AC-6.3).
        if (isSplitAce(h)) h.status = "finished";
        else closeIfDone(h);
      }
      round.hands = [leftHand, rightHand];
      break;
    }
  }

  if (!activeHand(round)) resolve(round, draw);
  return round;
}

/** Dealer reveals and plays, even when every hand busted (AC-8.1, AC-8.2, open question Q1), then each hand gets its outcome. */
function resolve(round: RoundState, draw: Draw): void {
  while (handValue(round.dealer).total < 17) round.dealer.push(draw());
  const dealerTotal = handValue(round.dealer).total;
  for (const hand of round.hands) hand.outcome = outcome(handValue(hand.cards).total, dealerTotal);
  round.phase = "resolved";
}

/** AC-8.3. */
function outcome(player: number, dealer: number): Outcome {
  if (player > 21) return "loss";
  if (dealer > 21 || player > dealer) return "win";
  return player === dealer ? "push" : "loss";
}
