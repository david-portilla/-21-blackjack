import { getRuns } from "@/engine";
import { errorResponse, requireAccountId } from "@/engine/http";

/** The account's Candles runs, newest first (AC-16.3, AC-16.9). */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    return Response.json(await getRuns().listRuns(accountId));
  } catch (err) {
    return errorResponse(err);
  }
}
