import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3004",
  },
  webServer: {
    command: "node cli.js web --port 3004",
    port: 3004,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
