import type { ApiError, ErrorCode } from "@/contracts/types";
import type { Account, Run, Transaction } from "./engine-types";

export class EngineError extends Error {
  constructor(
    public code: ErrorCode | "NETWORK" | "UNKNOWN",
    message: string,
  ) {
    super(message);
  }
}

export interface EngineClient {
  signIn(username: string): Promise<Account>;
  me(): Promise<Account | null>;
  deposit(amount: number, idempotencyKey: string): Promise<Transaction>;
  transactions(): Promise<Transaction[]>;
  runs(): Promise<Run[]>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  } catch {
    throw new EngineError("NETWORK", "Could not reach the casino engine");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiError | null)?.error;
    throw new EngineError(error?.code ?? "UNKNOWN", error?.message ?? `Engine responded ${res.status}`);
  }
  return body as T;
}

export const httpEngineClient: EngineClient = {
  signIn: (username) =>
    request("/api/engine/session", { method: "POST", body: JSON.stringify({ username }) }),
  me: async () => {
    try {
      return await request<Account>("/api/engine/me");
    } catch (e) {
      if (e instanceof EngineError && e.code === "UNAUTHENTICATED") return null;
      throw e;
    }
  },
  deposit: (amount, idempotencyKey) =>
    request("/api/engine/deposits", { method: "POST", body: JSON.stringify({ amount, idempotencyKey }) }),
  transactions: () => request("/api/engine/transactions"),
  runs: () => request("/api/engine/runs"),
};

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
