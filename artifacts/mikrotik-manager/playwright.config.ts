import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5180);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Prefer the chromium executable that the Replit Nix toolchain already
// provides so the suite runs without a separate Playwright browser download
// or a hard-coded /nix/store path. If unset, Playwright will fall back to
// `PLAYWRIGHT_BROWSERS_PATH` or its own bundled browsers.
const NIX_CHROMIUM = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  // Single worker: tests share one Vite dev server (`reuseExistingServer`)
  // and writing trace artifacts from multiple workers concurrently caused
  // intermittent ENOENT failures on the trace files. Serializing the run
  // also keeps the chat-stream route mock from racing across contexts.
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(NIX_CHROMIUM
      ? {
          launchOptions: {
            executablePath: NIX_CHROMIUM,
            // The Nix-provided Chromium is recent enough that the legacy
            // `--headless=old` mode (Playwright's default) was removed.
            // Force the new headless implementation.
            ignoreDefaultArgs: ["--headless=old"],
            args: ["--headless=new"],
          },
        }
      : {}),
  },
  webServer: {
    // Spin up an isolated Vite dev server for tests so we don't collide
    // with the developer's running workflow. The dev server requires PORT
    // and BASE_PATH; we set BASE_PATH=/ so the test URLs match `/api/...`
    // glob patterns directly.
    command: `PORT=${PORT} BASE_PATH=/ pnpm exec vite --config vite.test.config.ts --host 0.0.0.0`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
