// Signed session cookie (AC-1.3). The cookie holds `accountId.hmac`; the browser never chooses the account.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "casino_session";

/** Options for setting SESSION_COOKIE from a route handler. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and set it.");
  }
  return secret;
}

function hmac(accountId: string): string {
  return createHmac("sha256", getSecret()).update(accountId).digest("base64url");
}

export function signSession(accountId: string): string {
  return `${accountId}.${hmac(accountId)}`;
}

/** Returns the accountId if the signature is valid, else null. Does not check the DB. */
export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;

  const accountId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(hmac(accountId));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? accountId : null;
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Matches CasinoEngine.getSessionAccount. Verifies the signature only; does not check the DB. */
export async function getSessionAccount(req: Request): Promise<{ accountId: string } | null> {
  const accountId = verifySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  return accountId ? { accountId } : null;
}
