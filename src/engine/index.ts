// App wiring for the engine. The DB is opened lazily so imports (and `next build`) never create it.

import type { CasinoEngine } from "@/contracts/engine";
import { getDb } from "./db";
import { createEngine, type Engine } from "./engine";
import { getSessionAccount } from "./session";

let engine: Engine | undefined;

/** Engine on the app database (`data/casino.db`), created on first call. */
export function getEngine(): Engine {
  engine ??= createEngine(getDb());
  return engine;
}

/** In-process CasinoEngine for the game. Not exposed over HTTP. */
export function getCasinoEngine(): CasinoEngine {
  return {
    getSessionAccount,
    debit: (input) => getEngine().debit(input),
    settle: (input) => getEngine().settle(input),
  };
}
