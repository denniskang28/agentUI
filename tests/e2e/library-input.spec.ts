import { test, expect } from "@playwright/test";
import { builtins } from "../../packages/catalog/src/index";
const version = builtins.find((e) => e.key === "text")!.version;
const create = (id: string, text: string) => ({
  type: "template.create",
  id,
  template: "text",
  templateVersion: version,
  data: { text },
});

test("both response sources offer both formats, preserve four independent drafts and render Library form data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const raw = page.getByRole("textbox", { name: "A2UI JSON", exact: true });
  const original = await raw.inputValue();
  await page
    .getByRole("button", { name: "Library 便捷模板", exact: true })
    .click();
  const editor = page.getByRole("textbox", {
    name: "Library JSON",
    exact: true,
  });
  expect(JSON.parse(await editor.inputValue())[0].type).toBe("template.create");
  await page.getByRole("button", { name: "表单", exact: true }).click();
  await page
    .getByRole("textbox", { name: "文本", exact: true })
    .fill("Library form text");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    page
      .frameLocator('iframe[title="Preview Host"]')
      .getByText("Library form text", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const libraryTemplate = await editor.inputValue();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await editor.fill(JSON.stringify(create("custom", "Custom library")));
  const libraryCustom = await editor.inputValue();
  await page.getByRole("button", { name: "A2UI", exact: true }).click();
  await raw.fill("");
  await page.getByRole("button", { name: "组件模板", exact: true }).click();
  // An unchanged generated raw template follows form values; hand-authored raw drafts are separate.
  const rawDraft = original.replace("本季度整体风险可控", "Raw template draft");
  await raw.fill(rawDraft);
  await page
    .getByRole("button", { name: "Library 便捷模板", exact: true })
    .click();
  await expect(editor).toHaveValue(libraryTemplate);
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await expect(editor).toHaveValue(libraryCustom);
  await page.getByRole("button", { name: "A2UI", exact: true }).click();
  await expect(raw).toHaveValue("");
  await page.getByRole("button", { name: "组件模板", exact: true }).click();
  await expect(raw).toHaveValue(rawDraft);
});

test("custom Library JSONL is unrestricted by gallery, replays multiple Surfaces and delete, preserves original export", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "CapabilityProfile", exact: true })
    .click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await page
    .getByRole("button", { name: "Library 便捷模板", exact: true })
    .click();
  const inputs = [
    create("one", "First surface"),
    create("two", "Second surface"),
    { type: "template.patch", id: "two", patch: { text: "Patched second" } },
    { type: "template.delete", id: "one" },
  ];
  await page
    .getByRole("textbox", { name: "Library JSON", exact: true })
    .fill(inputs.map((x) => JSON.stringify(x)).join("\n"));
  await page
    .getByRole("spinbutton", { name: "间隔", exact: true })
    .fill("30000");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("First surface", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(host.getByText("Second surface", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(host.getByText("Patched second", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(host.getByText("First surface", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "复制接入代码", exact: true }).click();
  await page
    .getByRole("button", { name: "Library Inputs", exact: true })
    .click();
  const data = JSON.parse(await page.locator(".copy-dialog pre").innerText());
  expect(data.batches.flatMap((b: { inputs: unknown[] }) => b.inputs)).toEqual(
    inputs,
  );
});

test("Library validation identifies template/version errors and recovers through imported custom batches", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Library 便捷模板", exact: true })
    .click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Library JSON",
    exact: true,
  });
  await editor.fill(
    JSON.stringify({ ...create("a", "Bad"), templateVersion: "unknown" }),
  );
  await page.getByRole("button", { name: "校验", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("TEMPLATE_VERSION");
  const batch = {
    protocol: "enterprise-agent-ui/1",
    runId: "my_run",
    batchId: "my_batch",
    firstSequence: 1,
    inputs: [create("imported", "Imported batch")],
  };
  await page
    .locator('input[type="file"][accept=".json,.jsonl"]')
    .setInputFiles({
      name: "input.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
  await expect(editor).toHaveValue(JSON.stringify(batch));
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    page
      .frameLocator('iframe[title="Preview Host"]')
      .getByText("Imported batch", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const mode of ["native", "sandbox"] as const)
  test(`${mode} Library on_complete plugin stays gated until ready and handles real Actions`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator(".component-item")
      .filter({ hasText: "Expense Approval" })
      .click();
    await page
      .getByRole("button", { name: "Library 便捷模板", exact: true })
      .click();
    if (mode === "native") {
      await page.getByRole("button", { name: "Native", exact: true }).click();
      await page.getByRole("button", { name: "确认切换", exact: true }).click();
    }
    await page.getByRole("radio", { name: /等待完整数据/ }).click();
    await page
      .getByRole("spinbutton", { name: "间隔", exact: true })
      .fill("30000");
    await page.getByRole("button", { name: "渲染并播放", exact: true }).click();
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await expect(host.getByText("等待完整数据", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await expect(host.getByText("等待完整数据", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    const plugin =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
        : host;
    await expect(
      plugin.getByRole("button", { name: "批准", exact: true }),
    ).toBeVisible();
    await plugin
      .getByRole("textbox", { name: "审批意见", exact: true })
      .fill("Reviewed through Library input");
    // A just-mounted nested frame can resize between scroll and pointer dispatch.
    // Use a real keyboard activation; the existing plugin suites cover pointer clicks.
    await plugin
      .getByRole("button", { name: "批准", exact: true })
      .press("Enter");
    await expect(
      plugin.getByRole("status").getByText("已批准", { exact: true }),
    ).toBeVisible();
  });

for (const width of [1440, 1280, 375])
  for (const locale of ["zh-CN", "en-US"])
    test(`input format controls remain usable at ${width} in ${locale}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await page.goto("/");
      if (width === 375)
        await page.getByRole("tab", { name: "模板配置", exact: true }).click();
      if (locale === "en-US")
        await page
          .getByRole("button", { name: "选择语言", exact: true })
          .click();
      await page
        .getByRole("button", {
          name: locale === "zh-CN" ? "Library 便捷模板" : "Library templates",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "JSON", exact: true }).click();
      const editor = page.getByRole("textbox", {
        name: "Library JSON",
        exact: true,
      });
      await expect(editor).toBeVisible();
      const controls = page.getByRole("group", {
        name: locale === "zh-CN" ? "输入格式" : "Input format",
        exact: true,
      });
      const rect = await controls.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/library-experience/input-formats/${locale}-${width}-template.png`,
      });
      await page
        .getByRole("button", {
          name: locale === "zh-CN" ? "自定义响应" : "Custom response",
          exact: true,
        })
        .click();
      await expect(editor).toBeVisible();
      await page.screenshot({
        path: `artifacts/library-experience/input-formats/${locale}-${width}-custom.png`,
      });
    });
