// Shared types used by every part. Owner: David.
// Engine and round types live in their own files, written by their owners (see README.md).

export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "S" | "H" | "D" | "C";
export type Card = { rank: Rank; suit: Suit };
export type CardView = Card | { hidden: true };

export type Action = "hit" | "stand" | "double" | "split";
export type Outcome = "win" | "push" | "loss" | "blackjack";
export type TxKind = "DEPOSIT" | "BET" | "DOUBLE" | "SPLIT" | "PAYOUT";

export type ErrorCode =
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_FUNDS"
  | "ACCOUNT_NOT_FOUND"
  | "UNAUTHENTICATED"
  | "ROUND_NOT_FOUND"
  | "ROUND_IN_PROGRESS"
  | "INVALID_ACTION"
  | "STALE_VERSION"
  | "IDEMPOTENCY_CONFLICT";

export type ApiError = { error: { code: ErrorCode; message: string } };
