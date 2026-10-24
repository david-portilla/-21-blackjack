import { defineConfig, devices } from "@playwright/test";

// Browser journey checks (`pnpm e2e`). Local only: CI runs `pnpm check`.
// E2E_ENGINE=real runs the same journey against the real /api/engine/* routes instead of the fake.
const PORT = 3123;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 800 } } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    env: { NEXT_PUBLIC_ENGINE_FAKE: process.env.E2E_ENGINE === "real" ? "0" : "1" },
  },
});
