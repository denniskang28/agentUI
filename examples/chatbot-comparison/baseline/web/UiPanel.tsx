import { useMemo, useRef, useState } from "react";
import type {
  BusinessAction,
  DomainEvent,
  Expense,
  Locale,
  Risk,
  SessionInfo,
  StreamEvent,
} from "../shared/domain";
import { translate } from "../shared/i18n";
export const variant: string = "baseline";
export interface UiPanelProps {
  session: SessionInfo;
  events: StreamEvent[];
  locale: Locale;
  theme: string;
  runtimeMode: "native" | "sandbox";
  onAction: (action: unknown) => Promise<void>;
  onError: (error: string) => void;
}
function Approval({
  event,
  locale,
  onAction,
  onError,
}: {
  event: Extract<DomainEvent, { kind: "expense" }>;
  locale: Locale;
  onAction: UiPanelProps["onAction"];
  onError: UiPanelProps["onError"];
}) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const locked = useRef(false),
    intent = useRef({ signature: "", key: "" });
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  if (event.phase === "loading" || event.phase === "data")
    return (
      <div className="card waiting" role="status">
        <strong>{t("waiting")}</strong>
        <p>{t("waitingDetail")}</p>
        <div className="skeleton" />
      </div>
    );
  const data = event.data as Expense;
  const done = ["approved", "rejected", "changes_requested"].includes(
    data.status ?? "",
  );
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: data.currency,
    }).format(value);
  async function submit(name: string) {
    if (locked.current || done) return;
    if (name !== "expense.approve" && !comment.trim()) {
      onError(t("commentRequired"));
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
    const action: BusinessAction = {
      name,
      surfaceId: event.surfaceId,
      context: {
        reportId: data.reportId,
        comment,
        idempotencyKey: intent.current.key,
      },
    };
    try {
      await onAction(action);
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <div className="card approval">
      <div className="card-head">
        <div>
          <small>{t("report")}</small>
          <h2>{data.reportId}</h2>
          <p>
            {data.employee} · {data.department}
          </p>
        </div>
        <strong className="amount">{money(data.amount)}</strong>
      </div>
      <p>{data.notes}</p>
      <table>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i}>
              <td>{item.date}</td>
              <td>{item.desc}</td>
              <td>{money(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>{t("total")}</td>
            <td>{money(data.amount)}</td>
          </tr>
        </tfoot>
      </table>
      {data.status && (
        <p role="status" className={`result ${data.status}`}>
          {t(
            data.status as
              "approved" | "rejected" | "changes_requested" | "error",
          )}
        </p>
      )}
      {!done && (
        <>
          <label className="comment">
            {t("comment")}
            <textarea
              aria-label={t("comment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="actions">
            {(["approve", "reject", "changes"] as const).map((key, i) => (
              <button
                key={key}
                className={i === 0 ? "primary" : ""}
                disabled={pending}
                onClick={() =>
                  void submit(
                    [
                      "expense.approve",
                      "expense.reject",
                      "expense.requestChanges",
                    ][i],
                  ).catch((reason) => onError(String(reason)))
                }
              >
                {pending ? t("pending") : t(key)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function RiskCard({
  data,
  surfaceId,
  locale,
  onAction,
  onError,
}: {
  data: Risk;
  surfaceId: string;
  locale: Locale;
  onAction: UiPanelProps["onAction"];
  onError: UiPanelProps["onError"];
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="card">
      <h2>{data.title}</h2>
      <p className="muted">{data.asOf}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("region")}</th>
              {(["credit", "market", "liquidity", "ops"] as const).map(
                (key) => (
                  <th key={key}>{t(key)}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.region}>
                <th>{row.region}</th>
                {(["credit", "market", "liquidity", "ops"] as const).map(
                  (key) => (
                    <td key={key}>
                      <button
                        className={`risk-cell ${row[key] >= 65 ? "high" : ""}`}
                        aria-label={`${row.region} ${t(key)} ${row[key]}`}
                        onClick={() =>
                          void onAction({
                            name: "finance.risk.drilldown",
                            surfaceId,
                            context: {
                              region: row.region,
                              metric: key,
                              value: row[key],
                            },
                          }).catch((reason) => onError(String(reason)))
                        }
                      >
                        {row[key]}
                      </button>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.detail && (
        <div className="detail">
          {data.detail.summary} ·{" "}
          {new Intl.NumberFormat(locale).format(data.detail.exposure)}
        </div>
      )}
    </div>
  );
}
export function UiPanel({ events, locale, onAction, onError }: UiPanelProps) {
  const latest = useMemo(() => {
    const map = new Map<string, DomainEvent>();
    for (const item of events) {
      const event = item.payload as DomainEvent;
      if (event.kind === "composition" && event.phase === "delete")
        map.delete(event.surfaceId);
      else map.set(event.surfaceId, event);
    }
    return [...map.values()];
  }, [events]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="ui-surfaces">
      {latest.map((event) => (
        <section key={event.surfaceId} data-surface={event.surfaceId}>
          {event.kind === "expense" ? (
            <Approval
              event={event}
              locale={locale}
              onAction={onAction}
              onError={onError}
            />
          ) : event.kind === "risk" ? (
            <RiskCard
              data={event.data}
              surfaceId={event.surfaceId}
              locale={locale}
              onAction={onAction}
              onError={onError}
            />
          ) : (
            <div className="card">
              <h2>
                {event.phase === "update" ? t("note") : "Agent UI composition"}
              </h2>
              <div className="actions">
                <button
                  onClick={() =>
                    void onAction({
                      name: "composition.update",
                      surfaceId: event.surfaceId,
                      context: {},
                    }).catch((reason) => onError(String(reason)))
                  }
                >
                  {t("changed")}
                </button>
                <button
                  onClick={() =>
                    void onAction({
                      name: "composition.delete",
                      surfaceId: event.surfaceId,
                      context: {},
                    }).catch((reason) => onError(String(reason)))
                  }
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
