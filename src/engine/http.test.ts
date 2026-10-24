import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineError } from "@/contracts/engine";
import type { ApiError, ErrorCode } from "@/contracts/types";
import { errorResponse, readJson, requireAccountId } from "./http";
import { SESSION_COOKIE, signSession } from "./session";

describe("errorResponse", () => {
  const cases: [ErrorCode, number, string][] = [
    ["INVALID_AMOUNT", 400, "Enter a whole number of credits greater than 0."],
    ["INVALID_USERNAME", 400, "Enter a username."],
    ["UNAUTHENTICATED", 401, "Please sign in."],
    ["ACCOUNT_NOT_FOUND", 404, "Account not found."],
    ["ROUND_NOT_FOUND", 404, "Round not found."],
    ["INSUFFICIENT_FUNDS", 409, "Not enough credits."],
  ];

  it.each(cases)("maps %s to %i with a readable message", async (code, status, message) => {
    const res = errorResponse(new EngineError(code));
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({ error: { code, message } });
  });

  it("every code has a readable message, not the bare code", async () => {
    const codes: ErrorCode[] = ["ROUND_IN_PROGRESS", "INVALID_ACTION", "STALE_VERSION", "IDEMPOTENCY_CONFLICT"];
    for (const code of codes) {
      const { error } = (await errorResponse(new EngineError(code)).json()) as ApiError;
      expect(error.code).toBe(code);
      expect(error.message).not.toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it("keeps a custom message", async () => {
    const res = errorResponse(new EngineError("INVALID_AMOUNT", "idempotencyKey is required"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: { code: "INVALID_AMOUNT", message: "idempotencyKey is required" },
    });
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
