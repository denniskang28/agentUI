import {
  Catalog,
  MessageProcessor,
  type ComponentApi,
} from "@a2ui/web_core/v1_0";
import { z } from "zod";
import type { Message } from "./index";

// Platform rendering adapter only. Original Agent messages remain unchanged in
// API validation, session history, playback, and exports.
export const fallbackCatalogId = "urn:enterprise:agent-ui:render-fallback:1";
export const unsupportedApi = {
  name: "UnsupportedComponent",
  schema: z.object({ originalType: z.string(), originalCatalogId: z.string() }),
};
export const fallbackCatalog = new Catalog(fallbackCatalogId, "1.0", [
  unsupportedApi,
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Resolve unknown leaf types to an inert view, leaving all known schemas and
 * unknown catalog errors to official Core. Process sequentially so streamed
 * updates resolve against the Surface that the preceding message created. */
export function processWithFallback<T extends ComponentApi>(
  processor: MessageProcessor<T>,
  messages: Message[],
) {
  return messages.flatMap((source) => {
    // Core takes ownership of DataModel values. A later patch can mutate that
    // object, so never hand it the playback/session history's own references.
    const message = structuredClone(source);
    let rendered = message;
    const operation = record(message.createSurface)
      ? "createSurface"
      : record(message.updateComponents)
        ? "updateComponents"
        : undefined;
    if (message.version === "1.0" && operation) {
      const body = message[operation] as Record<string, unknown>;
      if (Array.isArray(body.components)) {
        const surface = processor.getSurface(String(body.surfaceId));
        const catalogs = processor.catalogs;
        const defaultId =
          operation === "createSurface"
            ? body.catalogId
            : surface?.defaultCatalog?.id;
        const components = body.components.map((component: unknown) => {
          if (
            !record(component) ||
            typeof component.component !== "string" ||
            !component.component
          )
            return component;
          const catalogId = component.catalogId ?? defaultId;
          const catalog = catalogs.find(
            (candidate) => candidate.id === catalogId,
          );
          if (!catalog || catalog.components.has(component.component))
            return component;
          return {
            id: component.id,
            component: unsupportedApi.name,
            catalogId: fallbackCatalogId,
            originalType: component.component,
            originalCatalogId: catalog.id,
            ...(component.metadata === undefined
              ? {}
              : { metadata: component.metadata }),
            ...(component.accessibility === undefined
              ? {}
              : { accessibility: component.accessibility }),
          };
        });
        rendered = { ...message, [operation]: { ...body, components } };
      }
    }
    return processor.processMessagesWithErrors([rendered]);
  });
}
