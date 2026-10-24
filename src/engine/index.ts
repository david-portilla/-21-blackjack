// App wiring for the engine. The DB is opened lazily so imports (and `next build`) never create it.

import type { CasinoEngine } from "@/contracts/engine";
import { getDb } from "./db";
import { createEngine, type Engine } from "./engine";
import { createRuns, type Runs } from "./runs";
import { getSessionAccount } from "./session";

let engine: Engine | undefined;
let runs: Runs | undefined;

/** Engine on the app database (`data/casino.db`), created on first call. */
export function getEngine(): Engine {
  engine ??= createEngine(getDb());
  return engine;
}

/** Candles runs (R16) on the app database, created on first call. */
export function getRuns(): Runs {
  runs ??= createRuns(getDb());
  return runs;
}

/** In-process CasinoEngine for the game. Not exposed over HTTP. */
export function getCasinoEngine(): CasinoEngine {
  return {
    getSessionAccount,
    debit: (input) => getEngine().debit(input),
    settle: (input) => getEngine().settle(input),
    closeRun: (input) => getRuns().closeRun(input),
  };
}
