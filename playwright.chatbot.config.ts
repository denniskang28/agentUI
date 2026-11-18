import { chatbotOrigins } from "./tests/chatbot/origins";
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
      url: `${chatbotOrigins.host}/health`,
      env: {
        AGENT_UI_HOST_PORT: new URL(chatbotOrigins.host).port,
        AGENT_UI_PARENT_ORIGINS: `${chatbotOrigins.baseline},${chatbotOrigins.integrated}`,
      },
      reuseExistingServer: true,
    },
    {
      command: "npm --prefix examples/chatbot-comparison/baseline run start",
      env: {
        NODE_ENV: "production",
        DEMO_PORT: new URL(chatbotOrigins.baseline).port,
      },
      url: `${chatbotOrigins.baseline}/api/health`,
      reuseExistingServer: true,
    },
    {
      command:
        "npm --prefix examples/chatbot-comparison/with-agent-ui run start",
      env: {
        NODE_ENV: "production",
        DEMO_PORT: new URL(chatbotOrigins.integrated).port,
      },
      url: `${chatbotOrigins.integrated}/api/health`,
      reuseExistingServer: true,
    },
  ],
});
