import { omenStatus } from "@/contracts/omens";
import { getEngine } from "@/engine";
import { errorResponse, requireAccountId } from "@/engine/http";

/** Today's omen, whether it is fulfilled and the streak (R17). Read-only: computed from the ledger. */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    return Response.json(omenStatus(await getEngine().listTransactions(accountId), new Date()));
  } catch (err) {
    return errorResponse(err);
  }
}
