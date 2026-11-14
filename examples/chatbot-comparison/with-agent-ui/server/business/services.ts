import type { BusinessAction, Expense, Risk } from "../../shared/domain";
export const initialExpense: Expense = {
  reportId: "EXP-001",
  employee: "张三",
  department: "销售部",
  category: "差旅",
  currency: "CNY",
  amount: 3200,
  notes: "上海客户拜访",
  requireComment: true,
  items: [
    { date: "2026-11-10", desc: "交通", amount: 1200 },
    { date: "2026-11-11", desc: "住宿", amount: 2000 },
  ],
};
export const initialRisk: Risk = {
  title: "区域风险 / Regional risk",
  asOf: "2026-11-14",
  showLegend: true,
  rows: [
    {
      region: "Japan",
      group: "APAC",
      credit: 42,
      market: 58,
      liquidity: 31,
      ops: 55,
    },
    {
      region: "Singapore",
      group: "APAC",
      credit: 38,
      market: 68,
      liquidity: 44,
      ops: 29,
    },
  ],
};
export class DemoBusinessService {
  expense = structuredClone(initialExpense);
  risk = structuredClone(initialRisk);
  failNext = false;
  private results = new Map<string, { signature: string; result: Expense }>();
  approve(action: BusinessAction, user: string): Expense {
    if (
      user !== "demo-approver" ||
      action.context.reportId !== this.expense.reportId
    )
      throw Error("FORBIDDEN: report or approver mismatch");
    if (
      !["expense.approve", "expense.reject", "expense.requestChanges"].includes(
        action.name,
      )
    )
      throw Error("UNKNOWN_ACTION");
    const key = action.context.idempotencyKey;
    if (typeof key !== "string" || !key || key.length > 128)
      throw Error("IDEMPOTENCY_REQUIRED");
    const signature = JSON.stringify({
      name: action.name,
      reportId: action.context.reportId,
      comment: action.context.comment,
    });
    const old = this.results.get(key);
    if (old) {
      if (old.signature !== signature) throw Error("IDEMPOTENCY_CONFLICT");
      return structuredClone(old.result);
    }
    if (
      ["approved", "rejected", "changes_requested"].includes(
        this.expense.status ?? "",
      )
    )
      throw Error("ALREADY_DECIDED");
    if (
      action.name !== "expense.approve" &&
      !String(action.context.comment ?? "").trim()
    )
      throw Error("COMMENT_REQUIRED");
    const failed = this.failNext;
    this.failNext = false;
    this.expense = {
      ...this.expense,
      resultVersion: (this.expense.resultVersion ?? 0) + 1,
      status: failed
        ? "error"
        : action.name === "expense.approve"
          ? "approved"
          : action.name === "expense.reject"
            ? "rejected"
            : "changes_requested",
    };
    if (!failed)
      this.results.set(key, {
        signature,
        result: structuredClone(this.expense),
      });
    return structuredClone(this.expense);
  }
  drilldown(action: BusinessAction): Risk {
    const region = String(action.context.region ?? "");
    const row = this.risk.rows.find((row) => row.region === region);
    if (!row) throw Error("REGION_NOT_FOUND");
    const metric = action.context.metric;
    if (
      metric !== "credit" &&
      metric !== "market" &&
      metric !== "liquidity" &&
      metric !== "ops"
    )
      throw Error("METRIC_NOT_FOUND");
    this.risk = {
      ...this.risk,
      detail: {
        region,
        metric,
        value: row[metric],
        summary: `${region}: Agent risk detail`,
        exposure: 12400000,
      },
    };
    return structuredClone(this.risk);
  }
}
