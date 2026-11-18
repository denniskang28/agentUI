process.env.MCP_DEMO = "1";
process.env.MCP_SERVERS_JSON ??= JSON.stringify([
  {
    id: "official-time",
    name: "Official quickstart",
    url: "http://127.0.0.1:3003/mcp",
    allowLocal: true,
    allowedTools: ["get-time"],
  },
  {
    id: "expense-demo",
    name: "Expense demo",
    url: "http://127.0.0.1:3002/mcp",
    allowLocal: true,
    allowedTools: [
      "expense_dashboard",
      "approve_expense",
      "model_only",
      "plain_text",
    ],
  },
  {
    id: "negative-fixtures",
    name: "Protocol error fixtures",
    url: "http://127.0.0.1:3004/mcp",
    allowLocal: true,
    allowedTools: ["invalid_mime", "uninitialized_view"],
  },
]);
await import("./dev");
export {};
