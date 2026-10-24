// House rules for the in-browser game emulation (docs/requirements.md R4 to R8).
// Heriberto's server-side game is the real implementation; this only lets the site be played meanwhile.
import type { Card, Rank, Suit } from "@/contracts/types";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];

export function freshDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

export function shuffle(cards: Card[], random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32): Card[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

// Aces count 11 while the total stays <= 21; a hand still counting an ace as 11 is soft (AC-5.2).
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let elevens = 0;
  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === "A") elevens++;
  }
  while (total > 21 && elevens > 0) {
    total -= 10;
    elevens--;
  }
  return { total, soft: elevens > 0 };
}

export const isNatural = (cards: Card[]) => cards.length === 2 && handTotal(cards).total === 21;
