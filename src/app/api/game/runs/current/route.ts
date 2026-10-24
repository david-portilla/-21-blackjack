import { getGameService } from "@/game/service";
import { gameErrorResponse, notFound, requireAccountId } from "@/game/service/http";

/** The open candle run (AC-16.3), or 404 when the next bet starts a new one. */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    const run = await getGameService().currentRun(accountId);
    return run ? Response.json(run) : notFound("ROUND_NOT_FOUND", "No run in progress.");
  } catch (err) {
    return gameErrorResponse(err);
  }
}
