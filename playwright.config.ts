import { defineConfig, devices } from "@playwright/test";

// Browser journey checks (`pnpm e2e`) on the real engine and game. Local only: CI runs `pnpm check`.
// Next allows one `next dev` per project, so an already running `pnpm dev` on :3000 is reused as is.
const PORT = 3000;

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
    // The session cookie needs a secret; a local-only one if .env does not set it.
    env: { SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-local-only" },
  },
});
