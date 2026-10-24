import { httpEngineClient, type EngineClient } from "./engine-client";
import { createFakeEngineClient } from "./fake-engine-client";

export const engineClient: EngineClient =
  process.env.NEXT_PUBLIC_ENGINE_FAKE === "1"
    ? createFakeEngineClient(() => window.localStorage)
    : httpEngineClient;
