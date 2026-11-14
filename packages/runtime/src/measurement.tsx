import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  MeasurementStage,
  MeasurementTarget,
} from "../../protocol/src/measurement";
export interface RuntimeProbe {
  input?: (target: MeasurementTarget, at: number) => void;
  requestId?: string;
  report: (
    requestId: string,
    target: MeasurementTarget,
    stage: MeasurementStage,
    visible: boolean,
    at?: number,
  ) => void;
}
export const RuntimeMeasurement = createContext<RuntimeProbe>({
  report: () => {},
});
export const useRuntimeMeasurement = () => useContext(RuntimeMeasurement);
/** Built-in DOM commits; uploaded roots report from their own trusted build wrapper. */
export function CommitProbe({
  target,
  children,
}: {
  target: MeasurementTarget;
  children: ReactNode;
}) {
  const probe = useRuntimeMeasurement();
  const root = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  useLayoutEffect(() => {
    if (!probe.requestId) return;
    const id = probe.requestId;
    const visible = () =>
      !!root.current &&
      [...root.current.querySelectorAll("*")].some(
        (node) => node.getBoundingClientRect().height > 0,
      ) &&
      document.visibilityState === "visible";
    probe.report(
      id,
      target,
      "commit",
      visible(),
      performance.timeOrigin + performance.now(),
    );
    if (!ready.current) {
      ready.current = true;
      probe.report(
        id,
        target,
        "ready",
        visible(),
        performance.timeOrigin + performance.now(),
      );
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        probe.report(id, target, "paint", visible()),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [probe, target.surfaceId, target.componentId]);
  return (
    <div
      ref={root}
      onClickCapture={() =>
        probe.input?.(target, performance.timeOrigin + performance.now())
      }
      style={{ display: "contents" }}
    >
      {children}
    </div>
  );
}
