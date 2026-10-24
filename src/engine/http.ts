// Helpers for the engine route handlers in src/app/api/engine/.

import { EngineError } from "@/contracts/engine";
import type { ApiError, ErrorCode } from "@/contracts/types";
import { getSessionAccount } from "./session";

const STATUS: Partial<Record<ErrorCode, number>> = {
  INVALID_AMOUNT: 400,
  INVALID_USERNAME: 400,
  UNAUTHENTICATED: 401,
  ACCOUNT_NOT_FOUND: 404,
  ROUND_NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 409,
};

/** Player-facing sentence per code; the site shows `ApiError.message` as is. */
const MESSAGE: Record<ErrorCode, string> = {
  INVALID_AMOUNT: "Enter a whole number of credits greater than 0.",
  INVALID_USERNAME: "Enter a username.",
  INSUFFICIENT_FUNDS: "Not enough credits.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  UNAUTHENTICATED: "Please sign in.",
  ROUND_NOT_FOUND: "Round not found.",
  ROUND_IN_PROGRESS: "Finish the current round first.",
  INVALID_ACTION: "That move is not allowed right now.",
  STALE_VERSION: "The table changed. Please try again.",
  IDEMPOTENCY_CONFLICT: "This request was already used for something else.",
};

/**
 * Maps an EngineError to its ApiError response, with a readable message unless the error carries a
 * custom one. Anything else is a 500 with a generic message.
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof EngineError) {
    const message = err.message === err.code ? MESSAGE[err.code] : err.message;
    const body: ApiError = { error: { code: err.code, message } };
    return Response.json(body, { status: STATUS[err.code] ?? 400 });
  }
  console.error(err);
  return Response.json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

/** The accountId from the signed session cookie. Throws UNAUTHENTICATED if missing or invalid. */
export async function requireAccountId(req: Request): Promise<string> {
  const session = await getSessionAccount(req);
  if (!session) throw new EngineError("UNAUTHENTICATED");
  return session.accountId;
}

/** The JSON body as an object; `{}` if the body is missing or malformed. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
