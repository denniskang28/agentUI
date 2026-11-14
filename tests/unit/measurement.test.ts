import { describe, it, expect, vi } from "vitest";
import {
  MeasurementTracker,
  isMeasurementRequest,
} from "../../packages/protocol/src/measurement";
const a = { surfaceId: "one", componentId: "root" },
  b = { surfaceId: "two", componentId: "root" };
describe("render measurements", () => {
  it("waits for every target's actual visible stage, not ready or another component", () => {
    let clock = 0;
    const emit = vi.fn(),
      tracker = new MeasurementTracker(emit, () => clock);
    tracker.begin("r", { targets: [a, b], waitFor: "paint" });
    clock = 3;
    tracker.report("r", a, "ready", true);
    tracker.report("r", a, "commit", true);
    tracker.report("r", b, "ready", true);
    tracker.report("r", b, "commit", true);
    tracker.report("r", a, "paint", true);
    clock = 8;
    tracker.report("r", b, "paint", false);
    expect(emit).not.toHaveBeenCalled();
    clock = 12;
    tracker.report("r", b, "paint", true);
    expect(emit).toHaveBeenCalledWith(
      "r",
      expect.objectContaining({
        status: "complete",
        elapsedMs: 12,
        components: [
          expect.objectContaining({ readyMs: 3, commitMs: 3, paintMs: 3 }),
          expect.objectContaining({ commitMs: 3, paintMs: 12 }),
        ],
      }),
    );
    tracker.dispose();
  });
  it("marks replaced requests as superseded and ignores late commits and unrelated IDs", () => {
    const emit = vi.fn(),
      tracker = new MeasurementTracker(emit);
    tracker.begin("old", { targets: [a], waitFor: "commit" });
    tracker.begin("new", { targets: [a], waitFor: "commit" });
    expect(emit).toHaveBeenCalledWith(
      "old",
      expect.objectContaining({ status: "superseded" }),
    );
    tracker.report("old", a, "commit", true);
    tracker.report("new", b, "commit", true);
    expect(emit).toHaveBeenCalledTimes(1);
    tracker.report("new", a, "commit", true);
    expect(emit).toHaveBeenCalledWith(
      "new",
      expect.objectContaining({ status: "complete" }),
    );
    tracker.dispose();
  });
  it("reports missing instrumentation as timeout and clears pending work on reset", () => {
    vi.useFakeTimers();
    const emit = vi.fn(),
      tracker = new MeasurementTracker(emit, () => 0, 100);
    tracker.begin("missing", { targets: [a], waitFor: "commit" });
    vi.advanceTimersByTime(100);
    expect(emit).toHaveBeenCalledWith(
      "missing",
      expect.objectContaining({ status: "timeout" }),
    );
    tracker.begin("reset", { targets: [b], waitFor: "paint" });
    tracker.dispose();
    vi.advanceTimersByTime(1000);
    expect(emit).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

it("measures the event timestamp rather than Sandbox return transport, with explicit first-instance paint", () => {
  let clock = 10;
  const emit = vi.fn(),
    tracker = new MeasurementTracker(emit, () => clock, 10000, 1000);
  tracker.begin("initial", {
    targets: [a, b],
    waitFor: "paint",
    paintTargets: [a],
  });
  clock = 30;
  tracker.report("initial", a, "ready", true, 15);
  tracker.report("initial", a, "commit", true, 15);
  tracker.report("initial", a, "paint", true, 25);
  tracker.report("initial", b, "commit", true, 20);
  expect(emit).not.toHaveBeenCalled();
  tracker.report("initial", b, "ready", true, 20);
  expect(emit).toHaveBeenCalledWith(
    "initial",
    expect.objectContaining({
      status: "complete",
      startedAt: 1010,
      elapsedMs: 20,
      components: [
        expect.objectContaining({ commitMs: 5, paintMs: 15 }),
        expect.objectContaining({ commitMs: 10, readyMs: 10 }),
      ],
    }),
  );
  tracker.dispose();
});

it("rejects ambiguous targets and paint targets outside the measured instance set", () => {
  expect(
    isMeasurementRequest({ targets: [a], waitFor: "paint", paintTargets: [a] }),
  ).toBe(true);
  for (const value of [
    null,
    { targets: [], waitFor: "commit" },
    { targets: [a, a], waitFor: "commit" },
    { targets: [a], waitFor: "paint", paintTargets: [b] },
    { targets: [a], waitFor: "paint", paintTargets: "all" },
    { targets: [a], waitFor: "ack" },
  ])
    expect(isMeasurementRequest(value)).toBe(false);
});
