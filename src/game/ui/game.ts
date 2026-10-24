import { createFakeGameClient } from "./fake-game-client";
import { httpGameClient, type GameClient } from "./game-client";

// The game routes need a real engine session, so the table goes fake whenever the site's engine is fake.
export const gameClient: GameClient =
  process.env.NEXT_PUBLIC_ENGINE_FAKE === "1" ? createFakeGameClient(() => window.localStorage) : httpGameClient;
