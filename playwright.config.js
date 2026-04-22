import { defineConfig } from "@playwright/test";
import net from "node:net";

function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" || err.code === "EACCES") resolve(findFreePort(start + 1));
      else reject(err);
    });
    server.listen(start, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Workers inherit env from the main process, so pick a free port once and reuse
// it across all config re-evaluations (otherwise baseURL and webServer drift apart).
let port;
if (process.env.PLAYWRIGHT_TEST_PORT) {
  port = Number(process.env.PLAYWRIGHT_TEST_PORT);
} else {
  port = await findFreePort(3004);
  process.env.PLAYWRIGHT_TEST_PORT = String(port);
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: `node cli.js web --port ${port}`,
    port,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
