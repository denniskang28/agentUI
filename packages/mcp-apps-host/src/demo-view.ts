import { App } from "@modelcontextprotocol/ext-apps";
const app = new App(
  { name: "Approval demo", version: "1.0.0" },
  {},
  { autoResize: true },
);
const root = document.getElementById("app")!;
const delivery: string[] = [];
let input: Record<string, unknown> = {};
function render(data: Record<string, unknown>) {
  root.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = String(data.title ?? "Expense approval");
  root.append(heading);
  const detail = document.createElement("p");
  detail.textContent = `${data.reportId ?? "EXP-001"} · ${data.amount ?? 3200} CNY · ${data.status ?? "pending"}`;
  detail.id = "approval-status";
  root.append(detail);
  const button = document.createElement("button");
  button.textContent = "Approve";
  button.id = "approve";
  button.disabled = data.status === "approved";
  root.append(button);
  button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await app.callServerTool({
        name: "approve_expense",
        arguments: { reportId: data.reportId ?? "EXP-001" },
      });
      render((result.structuredContent ?? {}) as Record<string, unknown>);
    } catch (error) {
      detail.textContent = String(error);
      button.disabled = false;
    }
  };
  const context = document.createElement("p");
  context.id = "host-context";
  context.textContent = `${app.getHostContext()?.locale ?? ""} / ${app.getHostContext()?.theme ?? ""}`;
  root.append(context);
  const message = document.createElement("button");
  message.textContent = "Send summary";
  message.onclick = () =>
    void app.sendMessage({
      role: "user",
      content: [{ type: "text", text: "Approval reviewed" }],
    });
  root.append(message);
  const update = document.createElement("button");
  update.textContent = "Update context";
  update.onclick = () =>
    void app.updateModelContext({
      content: [{ type: "text", text: "Selected expense EXP-001" }],
    });
  root.append(update);
  const expand = document.createElement("button");
  expand.textContent = "Expand details";
  expand.onclick = () => {
    const details = document.createElement("p");
    details.style.height = "400px";
    details.textContent = "Expense details";
    root.append(details);
  };
  root.append(expand);
  const sequence = document.createElement("p");
  sequence.id = "delivery-order";
  sequence.textContent = delivery.join(",");
  root.append(sequence);
}
app.ontoolinput = (p) => {
  delivery.push("input");
  input = p.arguments ?? {};
};
app.ontoolresult = (p) => {
  delivery.push("result");
  return render({
    ...input,
    ...((p.structuredContent as Record<string, unknown>) ?? {}),
  });
};
app.onhostcontextchanged = () => {
  const ctx = app.getHostContext();
  document.documentElement.style.colorScheme = ctx?.theme ?? "light";
  const el = document.getElementById("host-context");
  if (el) el.textContent = `${ctx?.locale ?? ""} / ${ctx?.theme ?? ""}`;
};
app.ontoolcancelled = () => {
  root.textContent = "Cancelled";
};
await app.connect();
