import { getGameService } from "@/game/service";
import { gameErrorResponse, notFound, requireAccountId } from "@/game/service/http";

/** The unfinished round, or 404 when there is none. */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    const round = await getGameService().currentRound(accountId);
    return round ? Response.json(round) : notFound("ROUND_NOT_FOUND", "No round on the table.");
  } catch (err) {
    return gameErrorResponse(err);
  }
}
