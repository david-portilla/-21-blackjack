import type { ActionRequest, RoundView, RunView, StaleVersionError } from "@/contracts/round";
import type { ApiError, ErrorCode } from "@/contracts/types";

export class GameError extends Error {
  constructor(
    public code: ErrorCode | "NETWORK" | "UNKNOWN",
    message: string,
    /** Current round, sent with STALE_VERSION. */
    public round?: RoundView,
  ) {
    super(message);
  }
}

export interface GameClient {
  /** Unfinished round, or null. */
  currentRound(): Promise<RoundView | null>;
  /** Open candle run, or null when the next bet starts a new one. */
  currentRun(): Promise<RunView | null>;
  startRound(stake: number, idempotencyKey: string): Promise<RoundView>;
  act(roundId: string, request: ActionRequest): Promise<RoundView>;
}

async function send(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  } catch {
    throw new GameError("NETWORK", "Could not reach the table");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok && res.status !== 404) throw toError(res.status, body);
  return { status: res.status, body };
}

function toError(status: number, body: unknown): GameError {
  const error = (body as ApiError | null)?.error;
  return new GameError(error?.code ?? "UNKNOWN", error?.message ?? `Table responded ${status}`, (body as StaleVersionError | null)?.round);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { status, body } = await send(path, init);
  if (status === 404) throw toError(status, body);
  return body as T;
}

/** GET endpoints where 404 means "none". */
async function maybe<T>(path: string): Promise<T | null> {
  const { status, body } = await send(path);
  return status === 404 ? null : (body as T);
}

export const httpGameClient: GameClient = {
  currentRound: () => maybe<RoundView>("/api/game/rounds/current"),
  currentRun: () => maybe<RunView>("/api/game/runs/current"),
  startRound: (stake, idempotencyKey) =>
    request("/api/game/rounds", { method: "POST", body: JSON.stringify({ stake, idempotencyKey }) }),
  act: (roundId, body) =>
    request(`/api/game/rounds/${encodeURIComponent(roundId)}/actions`, { method: "POST", body: JSON.stringify(body) }),
};
