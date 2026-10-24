import { EngineError } from "@/contracts/engine";
import { getGameService } from "@/game/service";
import { gameErrorResponse, readJson, requireAccountId } from "@/game/service/http";

/** Places a bet and deals (AC-3.1, AC-3.2, R4, R6). A repeated idempotencyKey returns the same round. */
export async function POST(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    const { stake, idempotencyKey } = await readJson(req);
    if (typeof idempotencyKey !== "string" || !idempotencyKey) {
      throw new EngineError("INVALID_AMOUNT", "idempotencyKey is required");
    }
    return Response.json(await getGameService().startRound(accountId, stake, idempotencyKey), { status: 201 });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
