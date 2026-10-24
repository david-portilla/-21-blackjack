import { EngineError } from "@/contracts/engine";
import { getEngine } from "@/engine";
import { errorResponse, readJson, requireAccountId } from "@/engine/http";

/** Deposits credits (AC-2.1, AC-2.2, AC-2.3). A repeated idempotencyKey returns the original transaction. */
export async function POST(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    const { amount, idempotencyKey } = await readJson(req);
    if (typeof idempotencyKey !== "string" || !idempotencyKey) {
      throw new EngineError("INVALID_AMOUNT", "idempotencyKey is required");
    }
    const tx = await getEngine().deposit({ accountId, amount, idempotencyKey });
    return Response.json(tx, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
