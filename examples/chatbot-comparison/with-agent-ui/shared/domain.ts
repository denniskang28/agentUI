export type Locale = "zh-CN" | "en-US";
export interface Expense {
  reportId: string;
  employee: string;
  department: string;
  category: string;
  currency: string;
  amount: number;
  notes: string;
  requireComment: boolean;
  items: { date: string; desc: string; amount: number }[];
  status?: string;
  resultVersion?: number;
}
export interface Risk {
  title: string;
  asOf: string;
  showLegend: boolean;
  rows: {
    region: string;
    group: "APAC" | "EMEA" | "AMER";
    credit: number;
    market: number;
    liquidity: number;
    ops: number;
  }[];
  detail?: {
    summary: string;
    region: string;
    metric: string;
    value: number;
    exposure: number;
  };
}
export type DomainEvent =
  | {
      kind: "expense";
      phase: "loading" | "data" | "ready" | "result";
      surfaceId: string;
      data: Partial<Expense>;
    }
  | {
      kind: "risk";
      phase: "ready" | "update" | "result";
      surfaceId: string;
      data: Risk;
    }
  | {
      kind: "composition";
      phase: "create" | "update" | "delete";
      surfaceId: string;
    };
export interface BusinessAction {
  name: string;
  surfaceId: string;
  context: Record<string, unknown>;
}
export interface StreamEvent {
  id: number;
  runId: string;
  type: "text" | "ui" | "trace" | "reset" | "error";
  payload: unknown;
}
export interface SessionInfo {
  id: string;
  runId: string;
  mode: "template" | "raw";
}
