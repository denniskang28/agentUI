/** Platform telemetry, deliberately outside the A2UI wire and business DataModel. */
export interface MeasurementTarget {
  surfaceId: string;
  componentId: string;
}
export type MeasurementStage = "ready" | "commit" | "paint";
export interface MeasurementRequest {
  targets: MeasurementTarget[];
  waitFor: "commit" | "paint";
  paintTargets?: MeasurementTarget[];
}
export interface ComponentMeasurement extends MeasurementTarget {
  readyMs?: number;
  commitMs?: number;
  paintMs?: number;
  visible?: boolean;
  observedAt?: Partial<Record<MeasurementStage, number>>;
}
export interface MeasurementResult {
  status: "complete" | "superseded" | "timeout" | "error";
  elapsedMs: number;
  startedAt: number;
  components: ComponentMeasurement[];
}
const key = (target: MeasurementTarget) =>
  JSON.stringify([target.surfaceId, target.componentId]);
/** Uses one Host clock. A newer update cannot borrow an earlier component commit. */
export class MeasurementTracker {
  private requests = new Map<
    string,
    {
      start: number;
      request: MeasurementRequest;
      components: Map<string, ComponentMeasurement>;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private emit: (id: string, result: MeasurementResult) => void,
    private now = () => performance.now(),
    private timeoutMs = 10000,
    private timeOrigin = performance.timeOrigin,
  ) {}
  begin(id: string, request: MeasurementRequest) {
    for (const [oldId, active] of this.requests) {
      if (request.targets.some((target) => active.components.has(key(target))))
        this.finish(oldId, "superseded");
    }
    this.requests.set(id, {
      start: this.now(),
      request,
      components: new Map(
        request.targets.map((target) => [key(target), { ...target }]),
      ),
      timer: setTimeout(() => this.finish(id, "timeout"), this.timeoutMs),
    });
    if (!request.targets.length) this.finish(id, "error");
  }
  report(
    id: string,
    target: MeasurementTarget,
    stage: MeasurementStage,
    visible: boolean,
    observedAt = this.now(),
  ) {
    const active = this.requests.get(id);
    const component = active?.components.get(key(target));
    if (
      !active ||
      !component ||
      !Number.isFinite(observedAt) ||
      observedAt < active.start - 1 ||
      observedAt > this.now() + 1
    )
      return;
    component.visible = visible;
    if (!visible) return;
    component.observedAt ??= {};
    component.observedAt[stage] ??= this.timeOrigin + observedAt;
    const field = `${stage}Ms` as const;
    component[field] ??= Math.max(0, observedAt - active.start);
    component.visible = visible;
    const complete = [...active.components.values()].every((c) => {
      const needsPaint =
        active.request.waitFor === "paint" &&
        (!active.request.paintTargets ||
          active.request.paintTargets.some((target) => key(target) === key(c)));
      return (
        c.commitMs !== undefined &&
        c.visible &&
        (active.request.waitFor !== "paint" || c.readyMs !== undefined) &&
        (!needsPaint || (c.readyMs !== undefined && c.paintMs !== undefined))
      );
    });
    if (complete) this.finish(id, "complete");
  }
  finish(id: string, status: MeasurementResult["status"]) {
    const active = this.requests.get(id);
    if (!active) return;
    clearTimeout(active.timer);
    this.requests.delete(id);
    this.emit(id, {
      status,
      startedAt: this.timeOrigin + active.start,
      elapsedMs: Math.max(0, this.now() - active.start),
      components: [...active.components.values()],
    });
  }
  dispose() {
    for (const active of this.requests.values()) clearTimeout(active.timer);
    this.requests.clear();
  }
}

export interface RuntimeStatistics {
  longTasks: {
    count: number;
    durationMs: number;
    entries: { startTime: number; duration: number; name: string }[];
  } | null;
  memory: {
    usedJSHeapBytes: number;
    initialUsedJSHeapBytes: number | null;
    deltaBytes: number | null;
  } | null;
  scope: "preview-host-document-best-effort";
}
export function isMeasurementRequest(
  value: unknown,
): value is MeasurementRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as MeasurementRequest;
  const target = (t: MeasurementTarget) =>
    t &&
    typeof t.surfaceId === "string" &&
    t.surfaceId.length <= 256 &&
    typeof t.componentId === "string" &&
    t.componentId.length <= 256;
  return (
    Array.isArray(v.targets) &&
    v.targets.length > 0 &&
    v.targets.length <= 20 &&
    v.targets.every(target) &&
    new Set(v.targets.map(key)).size === v.targets.length &&
    ["commit", "paint"].includes(v.waitFor) &&
    (v.paintTargets === undefined ||
      (Array.isArray(v.paintTargets) &&
        v.paintTargets.length > 0 &&
        v.paintTargets.every(
          (t) =>
            target(t) &&
            v.targets.some((candidate) => key(candidate) === key(t)),
        )))
  );
}
