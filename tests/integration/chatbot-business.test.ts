import { describe, expect, it } from "vitest";
import { Orchestrator as Baseline } from "../../examples/chatbot-comparison/baseline/server/orchestrator";
import { Orchestrator as Integrated } from "../../examples/chatbot-comparison/with-agent-ui/server/orchestrator";
import type {
  BusinessAction,
  DomainEvent,
} from "../../examples/chatbot-comparison/baseline/shared/domain";

for (const [name, Factory] of [
  ["baseline", Baseline],
  ["with-agent-ui", Integrated],
] as const) {
  describe(`${name} actual demo business boundary`, () => {
    it("guards ownership/readiness, deduplicates concurrent approvals and validates intent reuse", async () => {
      const agent = new Factory();
      const events: DomainEvent[] = [];
      const work = agent.message(
        "EXP-001",
        (event) => events.push(event),
        () => {},
      );
      const surfaceId = events[0].surfaceId;
      const action: BusinessAction = {
        name: "expense.approve",
        surfaceId,
        context: {
          reportId: "EXP-001",
          idempotencyKey: "intent-1",
          comment: "checked",
        },
      };
      const submit = (value = action) =>
        agent.action(
          value,
          "demo-approver",
          (event) => events.push(event),
          () => true,
        );
      await expect(
        submit({ ...action, surfaceId: "another-session" }),
      ).rejects.toThrow("SURFACE_NOT_OWNED");
      await expect(submit()).rejects.toThrow("SURFACE_NOT_READY");
      await work;
      await expect(
        agent.action(
          action,
          "other-user",
          () => {},
          () => true,
        ),
      ).rejects.toThrow("FORBIDDEN");
      await Promise.all([submit(), submit()]);
      expect(agent.service.expense).toMatchObject({
        status: "approved",
        resultVersion: 1,
      });
      await expect(
        submit({ ...action, name: "expense.reject" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    });
    it("rejects late work and deleted Surfaces, and derives risk values from server state", async () => {
      const agent = new Factory();
      const events: DomainEvent[] = [];
      const emit = (event: DomainEvent) => {
        events.push(event);
      };
      await agent.message("risk", emit, () => {});
      const surfaceId = events[0].surfaceId;
      const action = {
        name: "finance.risk.drilldown",
        surfaceId,
        context: { region: "Japan", metric: "credit", value: 999 },
      };
      await expect(
        agent.action(action, "demo-approver", emit, () => false),
      ).rejects.toThrow("STALE_RUN");
      await agent.action(action, "demo-approver", emit, () => true);
      expect(agent.service.risk.detail).toMatchObject({
        region: "Japan",
        metric: "credit",
        value: 42,
      });
      await expect(
        agent.action(
          {
            ...action,
            context: { region: "Japan", metric: "unknown", value: 1 },
          },
          "demo-approver",
          emit,
          () => true,
        ),
      ).rejects.toThrow("METRIC_NOT_FOUND");
      await agent.message("composition", emit, () => {});
      const composition = events.at(-1)!.surfaceId;
      await agent.action(
        { name: "composition.delete", surfaceId: composition, context: {} },
        "demo-approver",
        emit,
        () => true,
      );
      await expect(
        agent.action(
          { name: "composition.update", surfaceId: composition, context: {} },
          "demo-approver",
          emit,
          () => true,
        ),
      ).rejects.toThrow("SURFACE_NOT_OWNED");
    });
  });
}
