import type { BusinessAction, DomainEvent } from "../../shared/domain";
export const variant: string = "baseline";
export class Presenter {
  constructor(
    readonly runId: string,
    readonly mode: "template" | "raw",
  ) {}
  present(event: DomainEvent): unknown {
    return event;
  }
  action(source: unknown): BusinessAction {
    if (!source || typeof source !== "object") throw Error("INVALID_ACTION");
    const value = source as BusinessAction;
    if (
      typeof value.name !== "string" ||
      typeof value.surfaceId !== "string" ||
      !value.context ||
      typeof value.context !== "object" ||
      Array.isArray(value.context)
    )
      throw Error("INVALID_ACTION");
    return value;
  }
  dispose() {}
}
