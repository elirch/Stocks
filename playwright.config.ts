import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", acceptDownloads: true },
  webServer: {
    command: `npx next start -p ${PORT}`,
    env: { MARKET_DATA_PROVIDER: "fixture" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
