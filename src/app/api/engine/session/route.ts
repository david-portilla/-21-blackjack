import { NextResponse } from "next/server";
import { getEngine } from "@/engine";
import { errorResponse, readJson } from "@/engine/http";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/engine/session";

/** Signs in by username (AC-1.1, AC-1.2) and sets the signed session cookie (AC-1.3). */
export async function POST(req: Request) {
  try {
    const { username } = await readJson(req);
    const account = await getEngine().signIn(username as string);
    const res = NextResponse.json(account);
    res.cookies.set(SESSION_COOKIE, signSession(account.accountId), sessionCookieOptions);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
