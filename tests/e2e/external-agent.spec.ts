import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
function runAgent(scenario: string) {
  const child = spawn(
    "python3",
    ["examples/agent.py", "--scenario", scenario],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "";
  let errors = "";
  const first = new Promise<{ previewUrl: string; sessionId: string }>(
    (resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        if (output.includes("\n")) {
          try {
            resolve(JSON.parse(output.split("\n")[0]));
          } catch (e) {
            reject(e);
          }
        }
      });
      child.stderr.on("data", (chunk) => {
        errors += chunk.toString();
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code) reject(new Error(errors));
      });
    },
  );
  return {
    child,
    first,
    done: () =>
      new Promise<string>((resolve, reject) => {
        if (child.exitCode !== null) {
          if (child.exitCode) reject(new Error(errors));
          else resolve(output);
          return;
        }
        child.once("exit", (code) => {
          if (code) reject(new Error(errors));
          else resolve(output);
        });
      }),
  };
}
test("external Python Agent receives a real click and returns the visible update without Mock duplication", async ({
  page,
}) => {
  const agent = runAgent("action");
  try {
    const session = await agent.first;
    await page.goto(session.previewUrl);
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await host.getByRole("button", { name: "生成报告", exact: true }).click();
    await expect(
      host.getByRole("button", {
        name: "Agent received report.generate",
        exact: true,
      }),
    ).toBeVisible();
    const output = await agent.done();
    expect(output).toContain('"result": "complete"');
    await page.getByRole("button", { name: "调试面板" }).click();
    await page.getByRole("button", { name: "操作 1", exact: true }).click();
    await expect(page.locator(".inspector pre")).toContainText(
      "report.generate",
    );
  } finally {
    agent.child.kill();
  }
});
test("external Python progressive updates change the real bound Surface", async ({
  page,
}) => {
  const agent = runAgent("progressive");
  try {
    const session = await agent.first;
    await page.goto(session.previewUrl);
    await expect(
      page
        .frameLocator('iframe[title="Preview Host"]')
        .getByText("External Agent update 3"),
    ).toBeVisible();
    expect(await agent.done()).toContain('"lastSequence": 4');
  } finally {
    agent.child.kill();
  }
});
