import type { ComponentEntry } from "../../../packages/catalog/src/index";
export type BenchmarkLoad = "cells" | "records" | "fixture";
export function loadKind(entry: ComponentEntry): BenchmarkLoad {
  const rows = entry.defaults.rows;
  if (
    Array.isArray(rows) &&
    rows.length &&
    ["credit", "market", "liquidity", "ops"].every(
      (key) => typeof rows[0][key] === "number",
    )
  )
    return "cells";
  return entry.component === "DataTable" ? "records" : "fixture";
}
export function benchmarkFixture(entry: ComponentEntry, size: number) {
  const data = structuredClone(entry.defaults);
  const kind = loadKind(entry);
  if (kind === "cells") {
    const rows = data.rows as Record<string, unknown>[];
    data.rows = Array.from({ length: size / 4 }, (_, index) => ({
      ...rows[index % rows.length],
      region: `Region ${index + 1}`,
    }));
  } else if (kind === "records") {
    const items = data.items as Record<string, unknown>[];
    data.items = Array.from({ length: size }, (_, index) => ({
      ...items[index % items.length],
      id: index + 1,
      name: `Record ${index + 1}`,
    }));
  }
  return data;
}
/** Each tick changes a rendered field, not a telemetry property ignored by the UI. */
export function updateFixture(
  entry: ComponentEntry,
  fixture: Record<string, unknown>,
  tick: number,
) {
  const data = structuredClone(fixture);
  if (loadKind(entry) === "cells")
    (data.rows as Record<string, unknown>[])[0].credit = tick % 100;
  else if (loadKind(entry) === "records")
    (data.items as Record<string, unknown>[])[0].name = `Record 1 · ${tick}`;
  else if (typeof data.text === "string")
    data.text = `${fixture.text} · ${tick}`;
  else if (typeof data.title === "string")
    data.title = `${fixture.title} · ${tick}`;
  else if (typeof data.value === "string" || typeof data.value === "number")
    data.value =
      typeof data.value === "number"
        ? data.value + tick
        : `${fixture.value} · ${tick}`;
  else if (typeof data.employee === "string")
    data.employee = `${fixture.employee} · ${tick}`;
  else throw new Error("BENCHMARK_VISIBLE_UPDATE_UNAVAILABLE");
  return data;
}
export function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
    : null;
}
/** Diagnostic records, not deduplicated root causes. Builds happen before a run. */
export function countBenchmarkErrors(errors: readonly string[]) {
  const counts = {
    build: null,
    load: 0,
    render: 0,
    bridge: 0,
    measurement: 0,
    other: 0,
  };
  for (const error of errors) {
    if (error.includes("PLUGIN_LOAD_ERROR")) counts.load++;
    else if (error.includes("PLUGIN_RENDER_ERROR")) counts.render++;
    else if (/PREVIEW_|BRIDGE|PLUGIN_ACTION_REJECTED/.test(error))
      counts.bridge++;
    else if (/BENCHMARK_INITIAL_|UPDATE_\d+_(timeout|error)/.test(error))
      counts.measurement++;
    else counts.other++;
  }
  return counts;
}
