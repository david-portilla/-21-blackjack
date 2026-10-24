import { getEngine } from "@/engine";
import { errorResponse, requireAccountId } from "@/engine/http";

/** The account's transactions, newest first (AC-13.1). */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    return Response.json(await getEngine().listTransactions(accountId));
  } catch (err) {
    return errorResponse(err);
  }
}
