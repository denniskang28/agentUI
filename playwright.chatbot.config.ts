import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/chatbot",
  outputDir: "artifacts/chatbot-checks/browser-results",
  timeout: 30000,
  expect: { timeout: 8000 },
  workers: 1,
  use: {
    channel: "chromium",
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/chatbot", open: "never" }],
  ],
  webServer: [
    {
      command: "pnpm chatbot:host",
      url: "http://127.0.0.1:4183/health",
      reuseExistingServer: true,
    },
    {
      command: "npm --prefix examples/chatbot-comparison/baseline run start",
      env: { NODE_ENV: "production" },
      url: "http://localhost:5180/api/health",
      reuseExistingServer: true,
    },
    {
      command:
        "npm --prefix examples/chatbot-comparison/with-agent-ui run start",
      env: { NODE_ENV: "production" },
      url: "http://localhost:5181/api/health",
      reuseExistingServer: true,
    },
  ],
});
