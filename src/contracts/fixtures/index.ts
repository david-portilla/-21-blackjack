// Named fixed decks shared by every owner's tests. Owner: Heriberto.
// A fixture is the draw order: player, dealer up, player, dealer hidden, then every later draw in order.
// After a split the left hand's new card comes first, then the right hand's (AC-10.3).
import type { Card, Rank, Suit } from "../types";

export type DeckFixture = { name: string; description: string; cards: Card[] };

/** `card("10H")`, `card("AS")`. */
export function card(code: string): Card {
  return { rank: code.slice(0, -1) as Rank, suit: code.slice(-1) as Suit };
}

function fixture(name: string, description: string, codes: string): DeckFixture {
  return { name, description, cards: codes.split(" ").map(card) };
}

export const fixtures = {
  playerNatural: fixture("player-natural", "A+K vs 9+7: player blackjack, settles at once.", "AH 9S KD 7C"),
  dealerNatural: fixture("dealer-natural", "9+8 vs A+K: player loses at once.", "9H AS 8D KC"),
  bothNatural: fixture("both-natural", "A+K vs A+Q: push at once.", "AH AS KD QC"),
  dealerSoft17: fixture("dealer-soft-17", "10+8 stands vs A+6: dealer stands on soft 17, player wins.", "10H AS 8D 6C"),
  dealerDraws: fixture("dealer-draws", "10+9 stands vs 5+6: dealer draws 4 then 3, stands on 18, player wins.", "10H 5S 9D 6C 4H 3D"),
  hitBust: fixture("hit-bust", "10+6 hits K: busts; dealer still plays (stands on 17).", "10H 7S 6D 10C KH"),
  hitTo21: fixture("hit-to-21", "5+6 hits 10: 21 finishes automatically; dealer 18, player wins.", "5H 10S 6D 8C 10H"),
  softToHard: fixture("soft-to-hard", "A+6 is soft 17, hits 10: hard 17; dealer 17, push.", "AH 9S 6D 8C 10C"),
  double56: fixture("double-5-6", "5+6 doubles, gets 10 (21); dealer 16 draws 8 and busts: win returns 40 on 10.", "5H 9C 6D 7S 10H 8C"),
  split88: fixture("split-8-8", "8+8 split vs 10+7: left gets 10 (18, wins), right gets 6 (14, loses).", "8H 10C 8D 7S 10S 6H"),
  splitAces: fixture("split-aces", "A+A split vs 9+8: left gets K (21, not a natural), right gets 5; both stand.", "AH 9C AD 8S KH 5C"),
} satisfies Record<string, DeckFixture>;
