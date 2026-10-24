import { EngineError } from "@/contracts/engine";
import { getEngine } from "@/engine";
import { errorResponse, requireAccountId } from "@/engine/http";

/** The signed-in account. A cookie for an account that no longer exists is UNAUTHENTICATED. */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId(req);
    return Response.json(await getEngine().getAccount(accountId));
  } catch (err) {
    if (err instanceof EngineError && err.code === "ACCOUNT_NOT_FOUND") {
      return errorResponse(new EngineError("UNAUTHENTICATED"));
    }
    return errorResponse(err);
  }
}
