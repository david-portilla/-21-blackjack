// Round API and RoundView. Owner: Heriberto. See README.md "Game: HTTP API".
import type { Action, ApiError, Card, CardView, Outcome } from "./types";

/**
 * - `playing`: the player can still act on it.
 * - `stood`: the player chose Stand.
 * - `busted`: over 21.
 * - `finished`: closed automatically (reached 21, doubled, split aces, natural).
 */
export type HandStatus = "playing" | "stood" | "busted" | "finished";

export type HandView = {
  handId: string;
  cards: Card[];
  total: number;
  soft: boolean;
  stake: number;
  status: HandStatus;
  /** Computed server-side; the UI only renders them. */
  allowedActions: Action[];
  /** `blackjack` only for a player natural; a dealer natural is `loss`, both naturals `push`. */
  outcome?: Outcome;
  /** Total returned by the engine for this hand, once settled. */
  payout?: number;
};

/** Live candle run (R16). */
export type RunView = {
  runId: string;
  candles: number;
  /** Rounds with a positive net in this run (proposed rename of `roundsSurvived`, pending approval). */
  roundsWon: number;
  ended: boolean;
};

export type RoundView = {
  roundId: string;
  /** Bumps on every state change (R12). */
  version: number;
  status: "player_turn" | "settled";
  /** The hidden card is `{ hidden: true }` until settled (AC-4.3); `total` only when settled. */
  dealer: { cards: CardView[]; total?: number };
  hands: HandView[];
  activeHandId: string | null;
  run: RunView;
};

/** POST /api/game/rounds */
export type StartRoundRequest = { stake: number; idempotencyKey: string };

/** POST /api/game/rounds/{roundId}/actions */
export type ActionRequest = { handId: string; action: Action; version: number };

/** 409 body when `version` is stale: the current round, nothing drawn. */
export type StaleVersionError = ApiError & { round: RoundView };
