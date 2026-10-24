import type { Card, Rank, Suit } from "@/contracts/types";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];

export function freshDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

/** Returns a random integer in [0, max). */
export type RandomInt = (max: number) => number;

export const cryptoRandomInt: RandomInt = (max) => {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
};

/** Fisher–Yates over a fresh 52-card deck (AC-4.1). */
export function shuffledDeck(randomInt: RandomInt = cryptoRandomInt): Card[] {
  const deck = freshDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** AC-5.1: 2–10 face value, J/Q/K 10, A 1 (raised to 11 in handValue). */
function baseValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** AC-5.2: one ace counts 11 if the total stays <= 21; the hand is then soft. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((sum, c) => sum + baseValue(c.rank), 0);
  const soft = cards.some((c) => c.rank === "A") && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

/** A + 10-value in exactly two cards (AC-6.1). Callers decide whether a split hand qualifies (AC-6.3). */
export function isTwoCard21(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}
