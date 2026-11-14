import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
for (const language of ["python", "typescript", "curl"] as const)
  for (const scenario of ["full", "progressive", "action"] as const) {
    test(`${language} documented ${scenario} example drives a real preview`, async ({
      page,
    }) => {
      const [command, args] =
        language === "python"
          ? ["python3", ["examples/agent.py", "--scenario", scenario]]
          : language === "typescript"
            ? [
                "node",
                [
                  "examples/agent.ts",
                  "--scenario",
                  scenario,
                  "--locale",
                  "en-US",
                ],
              ]
            : ["bash", ["examples/agent.sh", scenario]];
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let output = "",
        error = "";
      const first = new Promise<{ previewUrl: string }>((resolve, reject) => {
        child.stdout.on("data", (chunk) => {
          output += String(chunk);
          if (output.includes("\n")) {
            try {
              resolve(JSON.parse(output.split("\n")[0]));
            } catch (error) {
              reject(error);
            }
          }
        });
        child.stderr.on("data", (chunk) => {
          error += String(chunk);
        });
        child.once("error", reject);
        child.once("exit", (code) => {
          if (code) reject(Error(error));
        });
      });
      try {
        const session = await first;
        await page.goto(session.previewUrl);
        const host = page.frameLocator('iframe[title="Preview Host"]');
        if (scenario === "action") {
          await host
            .getByRole("button", { name: "生成报告", exact: true })
            .click();
          await expect(
            host.getByRole("button", {
              name: "Agent received report.generate",
              exact: true,
            }),
          ).toBeVisible();
        } else if (scenario === "progressive")
          await expect(host.getByText("External Agent update 3")).toBeVisible();
        else
          await expect(
            host.getByText(
              "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
            ),
          ).toBeVisible();
        await expect.poll(() => child.exitCode, { message: error }).toBe(0);
        expect(output).toMatch(/"result"\s*:\s*"complete"/);
        if (language === "typescript")
          await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
      } finally {
        child.kill();
      }
    });
  }
