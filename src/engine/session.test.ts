import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, getSessionAccount, signSession, verifySession } from "./session";

const SECRET = "test-secret";

function requestWithCookie(cookie?: string): Request {
  const headers = cookie === undefined ? undefined : { cookie };
  return new Request("http://localhost/api/engine/me", { headers });
}

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("AC-1.3 valid cookie resolves the account", async () => {
    const value = signSession("acc-1");
    expect(verifySession(value)).toBe("acc-1");

    const req = requestWithCookie(`theme=dark; ${SESSION_COOKIE}=${value}; other=x`);
    await expect(getSessionAccount(req)).resolves.toEqual({ accountId: "acc-1" });
  });

  it("AC-1.3 tampered cookie returns null", async () => {
    const value = signSession("acc-1");
    const [, sig] = value.split(".");

    const otherAccount = `acc-2.${sig}`;
    expect(verifySession(otherAccount)).toBeNull();
    await expect(
      getSessionAccount(requestWithCookie(`${SESSION_COOKIE}=${otherAccount}`)),
    ).resolves.toBeNull();

    const flipped = sig[0] === "A" ? "B" : "A";
    const otherSig = `acc-1.${flipped}${sig.slice(1)}`;
    expect(verifySession(otherSig)).toBeNull();
    expect(verifySession(`acc-1.${sig}x`)).toBeNull();
  });

  it("AC-1.3 missing or malformed cookie returns null", async () => {
    await expect(getSessionAccount(requestWithCookie())).resolves.toBeNull();
    await expect(getSessionAccount(requestWithCookie("theme=dark"))).resolves.toBeNull();
    await expect(getSessionAccount(requestWithCookie(`${SESSION_COOKIE}=`))).resolves.toBeNull();

    for (const value of [undefined, "", "nodot", ".sig", "acc-1.", "."]) {
      expect(verifySession(value)).toBeNull();
    }
  });

  it("cookie signed with another secret returns null", () => {
    process.env.SESSION_SECRET = "other-secret";
    const value = signSession("acc-1");
    process.env.SESSION_SECRET = SECRET;
    expect(verifySession(value)).toBeNull();
  });

  it("missing SESSION_SECRET throws a clear error", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signSession("acc-1")).toThrow("SESSION_SECRET is not set");

    process.env.SESSION_SECRET = "";
    expect(() => verifySession("acc-1.sig")).toThrow("SESSION_SECRET is not set");
  });
});
