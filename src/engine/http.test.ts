import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineError } from "@/contracts/engine";
import type { ErrorCode } from "@/contracts/types";
import { errorResponse, readJson, requireAccountId } from "./http";
import { SESSION_COOKIE, signSession } from "./session";

describe("errorResponse", () => {
  const cases: [ErrorCode, number][] = [
    ["INVALID_AMOUNT", 400],
    ["INVALID_USERNAME", 400],
    ["UNAUTHENTICATED", 401],
    ["ACCOUNT_NOT_FOUND", 404],
    ["ROUND_NOT_FOUND", 404],
    ["INSUFFICIENT_FUNDS", 409],
  ];

  it.each(cases)("maps %s to %i as ApiError", async (code, status) => {
    const res = errorResponse(new EngineError(code, "msg"));
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({ error: { code, message: "msg" } });
  });

  it("unknown error is a 500 without internal details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("SQLITE_CONSTRAINT secret detail"));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("SQLITE");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});

describe("requireAccountId", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  const req = (cookie?: string) =>
    new Request("http://localhost/api/engine/me", { headers: cookie ? { cookie } : undefined });

  it("AC-1.3 returns the accountId from a valid cookie", async () => {
    await expect(requireAccountId(req(`${SESSION_COOKIE}=${signSession("acc-1")}`))).resolves.toBe("acc-1");
  });

  it("AC-1.3 missing or forged cookie is UNAUTHENTICATED", async () => {
    for (const r of [req(), req(`${SESSION_COOKIE}=acc-1.forged`)]) {
      await expect(requireAccountId(r)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
  });
});

describe("readJson", () => {
  const post = (body: string) => new Request("http://localhost", { method: "POST", body });

  it("returns the parsed object", async () => {
    await expect(readJson(post('{"amount":5}'))).resolves.toEqual({ amount: 5 });
  });

  it("returns {} for malformed or non-object bodies", async () => {
    for (const body of ["{oops", "", "42", "null"]) {
      await expect(readJson(post(body))).resolves.toEqual({});
    }
  });
});
