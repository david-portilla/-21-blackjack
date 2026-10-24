// Mirror of the game section of src/contracts/README.md, until Heriberto publishes the round types.
import type { Action, Card, CardView, Outcome } from "@/contracts/types";

export type HandView = {
  handId: string;
  cards: Card[];
  total: number;
  soft: boolean;
  stake: number;
  status: "playing" | "stood" | "busted" | "finished";
  allowedActions: Action[];
  outcome?: Outcome;
  payout?: number;
};

export type RoundView = {
  roundId: string;
  version: number;
  status: "player_turn" | "settled";
  dealer: { cards: CardView[]; total?: number };
  hands: HandView[];
  activeHandId: string | null;
  run: { runId: string; candles: number; roundsSurvived: number; ended: boolean };
};
