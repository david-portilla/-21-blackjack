// App wiring for the game. Opened lazily, like the engine, so imports and `next build` never create the DB.
import { getCasinoEngine } from "@/engine";
import { getDb } from "@/engine/db";
import { createGameService, type GameService } from "./service";
import { createGameStore } from "./store";

let service: GameService | undefined;

export function getGameService(): GameService {
  service ??= createGameService({ engine: getCasinoEngine(), store: createGameStore(getDb()) });
  return service;
}
