import { defineConfig } from "@playwright/test";

const LOCAL_FRONTEND_URL = "http://127.0.0.1:8080";
const DEV_FRONTEND_URL = process.env.BASE_URL?.trim().replace(/\/+$/, "");
const FRONTEND_URL = DEV_FRONTEND_URL || LOCAL_FRONTEND_URL;
const enabledEnvironmentFlag = (value?: string) =>
  Boolean(value && value !== "0" && value.toLowerCase() !== "false");
const IS_CI = [process.env.CI, process.env.GITHUB_ACTIONS, process.env.TF_BUILD]
  .some(enabledEnvironmentFlag);

// Set SLOW_MO_MS to a delay in milliseconds (e.g. 500 or 1000) to slow down test actions for visual debugging
const SLOW_MO_MS = Number(process.env.SLOW_MO ?? 0);

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["html", { open: "never" }],
    ["list"]
  ],
  use: {
    baseURL: FRONTEND_URL,
    screenshot: "on",
    launchOptions: {
      slowMo: SLOW_MO_MS,
    },
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { 
        browserName: "chromium",
        storageState: "./tests/e2e/.auth/user.json"
      },
      dependencies: ["setup"],
    },
  ],
  webServer: DEV_FRONTEND_URL ? undefined : [
    {
      command: "npm --prefix ../Spelling-Coach run dev",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --strictPort",
      url: FRONTEND_URL,
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
    },
    {
      command: "npm --prefix ../Spelling-Coach run dev",
      env: {
        PORT: "3002",
        SPELLING_COACH_SECTION_TIMEOUT_MS: "1",
      },
      url: "http://127.0.0.1:3002/api/health",
      reuseExistingServer: !IS_CI,
      stderr: "ignore",
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4174",
      env: {
        VITE_API_BASE_URL: "http://localhost:3002",
      },
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
    },
    {
      command: "npm --prefix ../Spelling-Coach run dev",
      env: {
        PORT: "3003",
        OPENAI_API_KEY: "e2e-intentionally-invalid",
      },
      url: "http://127.0.0.1:3003/api/health",
      reuseExistingServer: !IS_CI,
      stderr: "ignore",
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4175",
      env: {
        VITE_API_BASE_URL: "http://localhost:3003",
      },
      url: "http://127.0.0.1:4175",
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4176",
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:3999",
      },
      url: "http://127.0.0.1:4176",
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
    },
  ],
});
