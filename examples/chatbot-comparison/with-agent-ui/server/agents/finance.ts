import type { DomainEvent } from "../../shared/domain";
import type { DemoBusinessService } from "../business/services";
export async function financeAgent(
  service: DemoBusinessService,
  surfaceId: string,
  emit: (event: DomainEvent) => void,
) {
  emit({
    kind: "risk",
    phase: "ready",
    surfaceId,
    data: structuredClone(service.risk),
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  service.risk.rows[1].market = 76;
  emit({
    kind: "risk",
    phase: "update",
    surfaceId,
    data: structuredClone(service.risk),
  });
}
