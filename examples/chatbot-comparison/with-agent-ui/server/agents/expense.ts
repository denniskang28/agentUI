import type { DomainEvent } from "../../shared/domain";
import type { DemoBusinessService } from "../business/services";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function expenseAgent(
  service: DemoBusinessService,
  surfaceId: string,
  emit: (event: DomainEvent) => void,
) {
  emit({ kind: "expense", phase: "loading", surfaceId, data: {} });
  await pause(250);
  emit({
    kind: "expense",
    phase: "data",
    surfaceId,
    data: structuredClone(service.expense),
  });
  await pause(650);
  emit({
    kind: "expense",
    phase: "ready",
    surfaceId,
    data: structuredClone(service.expense),
  });
}
