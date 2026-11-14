import type { BusinessAction, DomainEvent } from "../../shared/domain";
import { DemoBusinessService } from "../business/services";
import { expenseAgent } from "../agents/expense";
import { financeAgent } from "../agents/finance";
export class Orchestrator {
  readonly service = new DemoBusinessService();
  private surfaces = new Map<string, "expense" | "risk" | "composition">();
  private ready = new Set<string>();
  async message(
    text: string,
    emit: (event: DomainEvent) => void,
    trace: (message: string) => void,
  ) {
    const kind = /风险|risk/i.test(text)
      ? "risk"
      : /组合|composition/i.test(text)
        ? "composition"
        : "expense";
    const surfaceId = `${kind}-${crypto.randomUUID()}`;
    this.surfaces.set(surfaceId, kind);
    trace(`orchestrator → ${kind} agent (deterministic demo routing)`);
    if (kind === "composition") {
      this.ready.add(surfaceId);
      emit({ kind, phase: "create", surfaceId });
      return;
    }
    const forward = (event: DomainEvent) => {
      if (event.phase === "ready") this.ready.add(event.surfaceId);
      emit(event);
    };
    await (kind === "expense"
      ? expenseAgent(this.service, surfaceId, forward)
      : financeAgent(this.service, surfaceId, forward));
  }
  async action(
    action: BusinessAction,
    user: string,
    emit: (event: DomainEvent) => void,
    active: () => boolean,
  ) {
    const kind = this.surfaces.get(action.surfaceId);
    if (!kind) throw Error("SURFACE_NOT_OWNED");
    if (!this.ready.has(action.surfaceId)) throw Error("SURFACE_NOT_READY");
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!active()) throw Error("STALE_RUN");
    if (kind === "expense")
      emit({
        kind,
        phase: "result",
        surfaceId: action.surfaceId,
        data: this.service.approve(action, user),
      });
    else if (kind === "risk" && action.name === "finance.risk.drilldown")
      emit({
        kind,
        phase: "result",
        surfaceId: action.surfaceId,
        data: this.service.drilldown(action),
      });
    else if (
      kind === "composition" &&
      ["composition.update", "composition.delete"].includes(action.name)
    ) {
      emit({
        kind,
        phase: action.name === "composition.delete" ? "delete" : "update",
        surfaceId: action.surfaceId,
      });
      if (action.name === "composition.delete") {
        this.surfaces.delete(action.surfaceId);
        this.ready.delete(action.surfaceId);
      }
    } else throw Error("UNKNOWN_ACTION");
  }
}
