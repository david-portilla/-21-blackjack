// Helpers for the game route handlers in src/app/api/game/.
import { EngineError } from "@/contracts/engine";
import type { StaleVersionError as StaleBody } from "@/contracts/round";
import type { ApiError, ErrorCode } from "@/contracts/types";
import { StaleVersionError } from "./service";

export { readJson, requireAccountId } from "@/engine/http";

const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  ACCOUNT_NOT_FOUND: 401,
  ROUND_NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 409,
  ROUND_IN_PROGRESS: 409,
  STALE_VERSION: 409,
};

const MESSAGE: Partial<Record<ErrorCode, string>> = {
  INVALID_AMOUNT: "Bet a whole number of credits greater than 0.",
  INSUFFICIENT_FUNDS: "Not enough credits for that.",
  UNAUTHENTICATED: "Please sign in.",
  ACCOUNT_NOT_FOUND: "Please sign in.",
  ROUND_NOT_FOUND: "No round on the table.",
  ROUND_IN_PROGRESS: "Finish the round on the table first.",
  INVALID_ACTION: "That move is not allowed right now.",
  STALE_VERSION: "The table moved on.",
};

/** ApiError response; STALE_VERSION also carries the current round. Anything unexpected is a logged 500. */
export function gameErrorResponse(err: unknown): Response {
  if (err instanceof EngineError) {
    const message = err.message === err.code ? (MESSAGE[err.code] ?? err.code) : err.message;
    const code: ErrorCode = err.code === "ACCOUNT_NOT_FOUND" ? "UNAUTHENTICATED" : err.code;
    const body: ApiError | StaleBody =
      err instanceof StaleVersionError ? { error: { code, message }, round: err.round } : { error: { code, message } };
    return Response.json(body, { status: STATUS[err.code] ?? 400 });
  }
  console.error(err);
  return Response.json({ error: { code: "INTERNAL", message: "The dealer dropped the deck. Try again." } }, { status: 500 });
}

export function notFound(code: ErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: 404 });
}
