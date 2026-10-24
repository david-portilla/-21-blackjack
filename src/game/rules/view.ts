import type { HandView, RoundView, RunView } from "@/contracts/round";
import type { CardView } from "@/contracts/types";
import { handValue } from "./cards";
import { activeHand, allowedActions, type RoundState } from "./round";

export type ViewExtras = {
  version: number;
  /** True only once the engine has settled every hand. */
  settled: boolean;
  run: RunView;
  /** Engine payout per handId, once settled. */
  payouts?: Record<string, number>;
};

/** Builds the only shape that leaves the server. The hidden card stays hidden until settled (AC-4.3). */
export function toRoundView(round: RoundState, extras: ViewExtras): RoundView {
  const { settled } = extras;
  const dealerCards: CardView[] = settled ? round.dealer : [round.dealer[0], { hidden: true }];
  const hands: HandView[] = round.hands.map((h) => ({
    handId: h.handId,
    cards: h.cards,
    ...handValue(h.cards),
    stake: h.stake,
    status: h.status,
    allowedActions: settled ? [] : allowedActions(round, h.handId),
    ...(settled && h.outcome ? { outcome: h.outcome } : {}),
    ...(settled && extras.payouts?.[h.handId] !== undefined ? { payout: extras.payouts[h.handId] } : {}),
  }));
  return {
    roundId: round.roundId,
    version: extras.version,
    status: settled ? "settled" : "player_turn",
    dealer: settled ? { cards: dealerCards, total: handValue(round.dealer).total } : { cards: dealerCards },
    hands,
    activeHandId: settled ? null : (activeHand(round)?.handId ?? null),
    run: extras.run,
  };
}
