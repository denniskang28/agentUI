import { Fragment, useEffect, useRef, useState } from "react";
import {
  definePlugin,
  useHostAction,
  useHostLocale,
} from "@enterprise/agent-ui-plugin-sdk";
type Data = {
  reportId: string;
  employee: string;
  department: string;
  category: string;
  amount: number;
  currency: string;
  notes: string;
  requireComment: boolean;
  items: { date: string; desc: string; amount: number }[];
  status?: string;
  resultVersion?: number;
};
const words = {
  "zh-CN": {
    title: "费用报销审批",
    employee: "员工",
    department: "部门",
    category: "费用类别",
    amount: "金额",
    date: "日期",
    description: "说明",
    items: "明细",
    total: "合计",
    notes: "备注",
    comment: "审批意见",
    placeholder: "请输入审批意见",
    approve: "批准",
    reject: "驳回",
    changes: "退回修改",
    pending: "待审批",
    approved: "已批准",
    rejected: "已驳回",
    changes_requested: "已退回",
    submitting: "提交中",
    required: "驳回或退回时必须填写意见",
    error: "审批失败，请重试",
    processed: "审批单已处理",
    mock: "演示审批",
  },
  "en-US": {
    title: "Expense approval",
    employee: "Employee",
    department: "Department",
    category: "Category",
    amount: "Amount",
    date: "Date",
    description: "Description",
    items: "Items",
    total: "Total",
    notes: "Notes",
    comment: "Comment",
    placeholder: "Enter a comment",
    approve: "Approve",
    reject: "Reject",
    changes: "Request changes",
    pending: "Pending approval",
    approved: "Approved",
    rejected: "Rejected",
    changes_requested: "Changes requested",
    submitting: "Submitting",
    required: "A comment is required when rejecting or requesting changes",
    error: "Approval failed. Please retry.",
    processed: "This report has been processed",
    mock: "Demo approval",
  },
};
function ExpenseApproval({ data }: { data: Data }) {
  const dispatch = useHostAction(),
    locale = useHostLocale(),
    w = words[locale];
  const [comment, setComment] = useState(""),
    [pending, setPending] = useState(false),
    [commentRequired, setCommentRequired] = useState(false);
  const locked = useRef(false);
  const intent = useRef({ signature: "", key: "" });
  const done = ["approved", "rejected", "changes_requested"].includes(
    data.status ?? "",
  );
  useEffect(() => {
    if (data.status) {
      setPending(false);
      locked.current = false;
    }
  }, [data.status, data.resultVersion]);
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: data.currency,
    }).format(amount);
  const submit = (name: string) => {
    if (locked.current || done) return;
    if (name !== "expense.approve" && data.requireComment && !comment.trim()) {
      setCommentRequired(true);
      return;
    }
    const signature = JSON.stringify({
      name,
      reportId: data.reportId,
      comment,
    });
    if (intent.current.signature !== signature)
      intent.current = {
        signature,
        key: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      };
    locked.current = true;
    setPending(true);
    setCommentRequired(false);
    dispatch(name, {
      reportId: data.reportId,
      comment,
      idempotencyKey: intent.current.key,
    });
  };
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 18 }}>{w.title}</strong>
        <code className="muted">{data.reportId}</code>
        <span className="tag tag-outline">
          {done
            ? w[data.status as "approved" | "rejected" | "changes_requested"]
            : pending
              ? w.submitting
              : w.pending}
        </span>
        <span className="tag tag-outline" style={{ marginLeft: "auto" }}>
          {w.mock}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        {[
          [w.employee, data.employee],
          [w.department, data.department],
          [w.category, data.category],
          [w.amount, money(data.amount)],
        ].map(([label, value], index) => (
          <div key={label} style={{ padding: "8px 8px 8px 0" }}>
            <div className="muted" style={{ fontSize: 11 }}>
              {label}
            </div>
            <div
              style={{
                fontWeight: index === 3 ? 700 : 600,
                fontSize: index === 3 ? 16 : 13,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".06em",
            marginBottom: 4,
          }}
        >
          {w.items}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "96px minmax(0,1fr) auto",
            gap: "0 12px",
            fontSize: 13,
          }}
        >
          {[w.date, w.description, w.amount].map((text, index) => (
            <span
              className="muted"
              key={text}
              style={{
                fontSize: 11,
                padding: "4px 0",
                borderBottom: "1px solid var(--color-divider)",
                textAlign: index === 2 ? "right" : "left",
              }}
            >
              {text}
            </span>
          ))}
          {data.items.map((item, index) => (
            <Fragment key={index}>
              <span
                style={{
                  padding: "5px 0",
                  borderBottom: "1px solid var(--color-divider)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {item.date}
              </span>
              <span
                style={{
                  padding: "5px 0",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                {item.desc}
              </span>
              <span
                style={{
                  padding: "5px 0",
                  borderBottom: "1px solid var(--color-divider)",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(item.amount)}
              </span>
            </Fragment>
          ))}
          <b style={{ padding: "5px 0" }}>{w.total}</b>
          <span />
          <b style={{ padding: "5px 0", textAlign: "right" }}>
            {money(data.items.reduce((sum, item) => sum + item.amount, 0))}
          </b>
        </div>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 11 }}>
          {w.notes}
        </div>
        <div>{data.notes}</div>
      </div>
      {done ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            border: "1px solid var(--color-accent-300)",
            borderRadius: 10,
            background: "var(--color-accent-100)",
          }}
        >
          <strong>
            {w[data.status as "approved" | "rejected" | "changes_requested"]}
          </strong>
          <div>
            {w.comment}: {comment}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {w.processed}
          </span>
        </div>
      ) : (
        <>
          <label className="a2-field">
            {w.comment}
            <textarea
              className="input"
              placeholder={w.placeholder}
              value={comment}
              disabled={pending}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          {data.requireComment && (
            <span className="muted" style={{ fontSize: 12 }}>
              {w.required}
            </span>
          )}
          {(commentRequired || data.status === "error") && (
            <div role="alert" className="error">
              {commentRequired ? w.required : w.error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() => submit("expense.approve")}
            >
              {pending ? w.submitting : w.approve}
            </button>
            <button
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => submit("expense.requestChanges")}
            >
              {w.changes}
            </button>
            <button
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => submit("expense.reject")}
            >
              {w.reject}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export default definePlugin<Data>({
  id: "expense.approval-form",
  version: "1.0.0",
  Component: ExpenseApproval,
});
