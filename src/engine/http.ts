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

/** Maps an EngineError to its ApiError response. Anything else is a 500 with a generic message. */
export function errorResponse(err: unknown): Response {
  if (err instanceof EngineError) {
    const body: ApiError = { error: { code: err.code, message: err.message } };
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
