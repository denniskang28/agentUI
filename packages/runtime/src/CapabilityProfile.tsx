import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CapabilityProfileData } from "../../protocol/src/capability";
import { useTranslation } from "../../i18n/src/index";
import "./capability.css";

type SelectionField = "scenarioId" | "selectedDimensionId";
export function CapabilityProfile({
  data,
  onSelect,
}: {
  data: CapabilityProfileData;
  /** Returns true when selection was written to the official bound model. */
  onSelect: (field: SelectionField, value: string) => boolean;
}) {
  const { t, locale } = useTranslation();
  const chart = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  // Only literal (unbound) data needs local presentation selection.
  const [localScenario, setLocalScenario] = useState<{
    source?: string;
    id: string;
  }>();
  const [localDimension, setLocalDimension] = useState<{
    source?: string;
    id: string;
  }>();
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const scenarioId =
    localScenario && localScenario.source === data.scenarioId
      ? localScenario.id
      : data.scenarioId;
  const dimensionId =
    localDimension && localDimension.source === data.selectedDimensionId
      ? localDimension.id
      : data.selectedDimensionId;
  const scenario =
    data.scenarios.find((s) => s.id === scenarioId) ?? data.scenarios[0];
  const selected =
    data.dimensions.find((d) => d.id === dimensionId) ?? data.dimensions[0];
  const selectScenario = (value: string) => {
    if (!onSelect("scenarioId", value))
      setLocalScenario({ source: data.scenarioId, id: value });
  };
  const selectDimension = (value: string) => {
    if (!onSelect("selectedDimensionId", value))
      setLocalDimension({ source: data.selectedDimensionId, id: value });
  };
  const format = (value: number | null | undefined) =>
    value == null
      ? t("未评估")
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
          value,
        );
  const percent = (
    value: number,
    dimension: CapabilityProfileData["dimensions"][number],
  ) =>
    ((value - (dimension.min ?? 0)) /
      ((dimension.max ?? 100) - (dimension.min ?? 0))) *
    100;
  const w = Math.max(240, width),
    cy = 150,
    radius = Math.min(100, w * 0.27);
  const point = (index: number, value: number) => {
    const angle =
      (((index * 360) / data.dimensions.length - 90) * Math.PI) / 180;
    return {
      x: w / 2 + (Math.cos(angle) * radius * value) / 100,
      y: cy + (Math.sin(angle) * radius * value) / 100,
    };
  };
  const polygon = (values: number[]) =>
    values
      .map((v, i) => {
        const p = point(i, v);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  const allScores = data.dimensions.every(
    (d) => typeof data.scores[d.id] === "number",
  );
  const allTargets = data.dimensions.every(
    (d) => typeof scenario.targets[d.id] === "number",
  );
  const selectedScore = data.scores[selected.id],
    target = scenario.targets[selected.id];
  const gap =
    typeof selectedScore === "number" && typeof target === "number"
      ? selectedScore - target
      : null;
  const normalized = data.dimensions.some(
    (d) => (d.min ?? 0) !== 0 || (d.max ?? 100) !== 100,
  );
  const showDimensions = data.showDimensions !== false;
  const styles = {
    ...(data.currentColor ? { "--cp-current": data.currentColor } : {}),
    ...(data.targetColor ? { "--cp-target": data.targetColor } : {}),
    "--cp-opacity": `${data.fillOpacity ?? 12}%`,
  } as CSSProperties;
  return (
    <article
      className="capability-profile"
      style={styles}
      aria-label={data.title}
    >
      <header className="cp-header">
        <h3>{data.title}</h3>
        {data.sampleData && <span className="cp-badge">{t("示例数据")}</span>}
      </header>
      <div className="cp-profile">
        <div className="cp-person">
          <span className="cp-avatar" aria-hidden="true">
            {Array.from(data.subjectName)[0]}
          </span>
          <div>
            <strong>{data.subjectName}</strong>
            {data.subtitle && <div className="cp-muted">{data.subtitle}</div>}
          </div>
        </div>
        {data.scenarios.length > 1 && (
          <label className="cp-scenario">
            {t("评估场景")}
            <select
              className="input"
              value={scenario.id}
              onChange={(e) => selectScenario(e.target.value)}
            >
              {data.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={`cp-body${showDimensions ? "" : " cp-chart-only"}`}>
        <section
          className="cp-chart-area"
          ref={chart}
          aria-label={t("能力雷达图")}
        >
          <div className="cp-legend">
            <span>
              <i />
              {t("当前能力")}
            </span>
            <span>
              <i className="cp-target-line" />
              {t("场景目标")}
            </span>
            <span className="cp-scale">
              {t(normalized ? "归一化刻度" : "百分制刻度")}
            </span>
          </div>
          <svg
            className="cp-radar"
            viewBox={`0 0 ${w} 300`}
            role="img"
            aria-label={`${data.title} · ${scenario.label}`}
          >
            <title>{data.title}</title>
            <desc>
              {data.dimensions
                .map(
                  (d) =>
                    `${d.label}: ${format(data.scores[d.id])} / ${format(scenario.targets[d.id])}`,
                )
                .join("; ")}
            </desc>
            {[20, 40, 60, 80, 100].map((v) => (
              <polygon
                key={v}
                points={polygon(data.dimensions.map(() => v))}
                className="cp-grid"
              />
            ))}
            {data.dimensions.map((d, i) => {
              const p = point(i, 100);
              return (
                <line
                  key={d.id}
                  x1={w / 2}
                  y1={cy}
                  x2={p.x}
                  y2={p.y}
                  className="cp-grid"
                />
              );
            })}
            {[20, 60, 100].map((v) => (
              <text key={v} x={w / 2 + 5} y={cy - (radius * v) / 100 + 4}>
                {v}
              </text>
            ))}
            {allTargets && (
              <polygon
                className="cp-target-polygon"
                points={polygon(
                  data.dimensions.map((d) =>
                    percent(scenario.targets[d.id]!, d),
                  ),
                )}
              />
            )}
            {allScores && (
              <polygon
                className="cp-score-polygon"
                points={polygon(
                  data.dimensions.map((d) => percent(data.scores[d.id]!, d)),
                )}
              />
            )}
            {data.dimensions.map((d, i) => {
              const value = data.scores[d.id],
                p = point(i, typeof value === "number" ? percent(value, d) : 0),
                label = point(i, 128);
              const maxLabelLength = w < 340 ? 4 : 8;
              const shortLabel =
                Array.from(d.label).slice(0, maxLabelLength).join("") +
                (Array.from(d.label).length > maxLabelLength ? "…" : "");
              const labelHalfWidth = Array.from(shortLabel).length * 6 + 4;
              const title = `${d.label}: ${format(value)} / ${format(scenario.targets[d.id])}`;
              return (
                <g key={d.id}>
                  {typeof value === "number" && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={d.id === selected.id ? 4.5 : 3}
                      className="cp-point"
                    >
                      <title>{title}</title>
                    </circle>
                  )}
                  <text
                    className="cp-axis-label"
                    x={Math.max(
                      labelHalfWidth,
                      Math.min(w - labelHalfWidth, label.x),
                    )}
                    y={label.y + 4}
                    textAnchor="middle"
                  >
                    <title>{title}</title>
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
          {!allScores && (
            <div className="cp-incomplete" role="status">
              {t("部分维度尚未评估，完整数据到达后显示能力轮廓。")}
            </div>
          )}
        </section>
        {showDimensions && (
          <section className="cp-breakdown" aria-label={t("能力维度明细")}>
            <div className="cp-list-heading">
              <span>{t("能力维度")}</span>
              <span>{t("当前 / 目标")}</span>
            </div>
            <div className="cp-dimensions">
              {data.dimensions.map((d) => {
                const score = data.scores[d.id],
                  goal = scenario.targets[d.id];
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="cp-dimension"
                    aria-pressed={d.id === selected.id}
                    aria-label={`${d.label}: ${format(score)} / ${format(goal)}`}
                    onClick={() => selectDimension(d.id)}
                  >
                    <span className="cp-row">
                      <span>{d.label}</span>
                      <span className="cp-numbers">
                        <b>{format(score)}</b> / {format(goal)}
                      </span>
                    </span>
                    <span className="cp-track">
                      {typeof score === "number" && (
                        <span
                          className="cp-bar"
                          style={{ width: `${percent(score, d)}%` }}
                        />
                      )}
                      {typeof goal === "number" && (
                        <span
                          className="cp-marker"
                          style={{ left: `${percent(goal, d)}%` }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {data.showDetails !== false && (
        <section
          className="cp-detail"
          aria-live="polite"
          aria-label={t("维度评价说明")}
        >
          <div className="cp-detail-top">
            {showDimensions ? (
              <strong>{selected.label}</strong>
            ) : (
              <label>
                {t("查看维度")}
                <select
                  className="input"
                  value={selected.id}
                  onChange={(e) => selectDimension(e.target.value)}
                >
                  {data.dimensions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="cp-muted">
              {gap === null
                ? t("尚无完整评分与目标")
                : gap < 0
                  ? t("距场景目标分数", { value: format(-gap) })
                  : gap > 0
                    ? t("高于场景目标分数", { value: format(gap) })
                    : t("达到场景目标")}
            </span>
          </div>
          {selected.description && <p>{selected.description}</p>}
          {selected.evidence && (
            <div className="cp-evidence">
              <span>{t(data.sampleData ? "评价依据示例" : "评价依据")}</span>
              {selected.evidence}
            </div>
          )}
          {normalized && (
            <div className="cp-muted">
              {t("原始刻度范围", {
                min: format(selected.min ?? 0),
                max: format(selected.max ?? 100),
              })}
            </div>
          )}
        </section>
      )}
      <footer className="cp-footer">
        <span>
          {t("维度模型")}
          {data.modelVersion ? ` v${data.modelVersion}` : ""}
        </span>
        {data.sampleData && <span>{t("分数与目标均为演示设定")}</span>}
      </footer>
    </article>
  );
}
