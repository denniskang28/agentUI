import { expect, it } from "vitest";
import { createServer } from "../../services/api/src/server";

it("discovers the capability schema, creates each template and rejects unsafe display values", async () => {
  const server = await createServer();
  try {
    const response = await server.app.inject(
      "/api/v1/components/capability-profile",
    );
    expect(response.statusCode).toBe(200);
    const entry = response.json();
    expect(entry.schema.properties.dimensions).toMatchObject({
      minItems: 3,
      maxItems: 8,
    });
    expect(
      entry.fields.find((f: { key: string }) => f.key === "currentColor").type,
    ).toBe("color");
    for (const id of entry.templateIds) {
      const result = await server.app.inject({
        method: "POST",
        url: `/api/v1/templates/${id}/instantiate`,
        payload: {},
      });
      expect(result.statusCode, id).toBe(200);
    }
    const invalid = await server.app.inject({
      method: "POST",
      url: "/api/v1/templates/capability-profile~full/instantiate",
      payload: { values: { currentColor: "url(https://example.com/image)" } },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().code).toBe("INVALID_TEMPLATE_VALUES");
  } finally {
    await server.app.close();
  }
});
