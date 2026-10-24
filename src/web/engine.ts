import { httpEngineClient, type EngineClient } from "./engine-client";
import { createFakeEngineClient } from "./fake-engine-client";
import { createFakeGame } from "./fake-game/fake-game";

const fake =
  process.env.NEXT_PUBLIC_ENGINE_FAKE === "1" ? createFakeEngineClient(() => window.localStorage) : null;

export const engineClient: EngineClient = fake ?? httpEngineClient;

// In-browser game emulation, only with the fake engine. Gone when Heriberto's BlackjackTable lands.
export const fakeGame = fake ? createFakeGame(() => window.localStorage, fake) : null;
