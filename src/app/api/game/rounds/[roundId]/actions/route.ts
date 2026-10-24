import { EngineError } from "@/contracts/engine";
import type { Action } from "@/contracts/types";
import { getGameService } from "@/game/service";
import { gameErrorResponse, readJson, requireAccountId } from "@/game/service/http";

const ACTIONS: Action[] = ["hit", "stand", "double", "split"];

/** Hit, stand, double or split (R7 to R10). A stale version draws nothing (AC-12.2). */
export async function POST(req: Request, ctx: RouteContext<"/api/game/rounds/[roundId]/actions">) {
  try {
    const accountId = await requireAccountId(req);
    const { roundId } = await ctx.params;
    const { handId, action, version } = await readJson(req);
    if (typeof handId !== "string" || !ACTIONS.includes(action as Action) || typeof version !== "number") {
      throw new EngineError("INVALID_ACTION");
    }
    return Response.json(await getGameService().act(accountId, roundId, handId, action as Action, version));
  } catch (err) {
    return gameErrorResponse(err);
  }
}
