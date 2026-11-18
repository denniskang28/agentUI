import { z } from "zod";
import type {
  CallToolResult,
  Tool,
  ReadResourceResult,
} from "@modelcontextprotocol/client";
import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
export type { CallToolResult, Tool, ReadResourceResult, McpUiResourceCsp };
export const HOST_VERSION = "0.1.0";
export const MAX_BYTES = 2_000_000;
export const idSchema = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/);
export const createAppSchema = z
  .object({
    runId: idSchema,
    tool: z.string().min(1).max(200),
    arguments: z.record(z.string(), z.unknown()),
    requestId: idSchema,
  })
  .strict();
export type CreateApp = z.infer<typeof createAppSchema>;
export const callSchema = z
  .object({
    name: z.string().min(1).max(200),
    arguments: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const readSchema = z
  .object({ uri: z.string().min(1).max(2048) })
  .strict();
export const cspSchema = z
  .object({
    connectDomains: z.array(z.string()).max(20).optional(),
    resourceDomains: z.array(z.string()).max(20).optional(),
    frameDomains: z.array(z.string()).max(20).optional(),
    baseUriDomains: z.array(z.string()).max(20).optional(),
  })
  .strict();
export interface ConnectionInfo {
  id: string;
  serverId: string;
  tools: Tool[];
  ownerToken: string;
}
export interface UiResource {
  uri: string;
  html: string;
  csp: McpUiResourceCsp;
}
export interface AppSnapshot {
  id: string;
  serverConnectionId: string;
  runId: string;
  toolCallId: string;
  tool: Tool;
  input: Record<string, unknown>;
  resource?: UiResource;
  resourceError?: string;
  status: "running" | "complete" | "cancelled" | "error";
  result?: CallToolResult;
  error?: string;
}
export interface GatewayEvent {
  id: number;
  type: string;
  appInstanceId: string;
  runId: string;
  at: string;
  payload: unknown;
}
export interface HostTransport {
  snapshot(signal?: AbortSignal): Promise<AppSnapshot>;
  callTool(
    params: { name: string; arguments?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<CallToolResult>;
  readResource(
    params: { uri: string },
    signal?: AbortSignal,
  ): Promise<ReadResourceResult>;
  events(after: number, signal?: AbortSignal): Promise<GatewayEvent[]>;
  destroy(): Promise<void>;
}
export class HostError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function boundedJson<T>(value: T): T {
  if (BufferByteLength(JSON.stringify(value)) > MAX_BYTES)
    throw new HostError("PAYLOAD_LIMIT", "Payload exceeds 2 MB", 413);
  return value;
}
function BufferByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}
export function httpTransport(
  baseUrl: string,
  connection: Pick<ConnectionInfo, "id" | "ownerToken">,
  appId: string,
): HostTransport {
  const root = `${baseUrl.replace(/\/$/, "")}/connections/${encodeURIComponent(connection.id)}/apps/${encodeURIComponent(appId)}`;
  const request = async <T>(
    suffix: string,
    body?: unknown,
    signal?: AbortSignal,
    method?: string,
  ): Promise<T> => {
    const response = await fetch(root + suffix, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        "x-mcp-owner": connection.ownerToken,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      signal,
    });
    const value = await response.json();
    if (!response.ok)
      throw new HostError(
        value.code ?? "GATEWAY_ERROR",
        value.message ?? "Gateway request failed",
        response.status,
      );
    return value as T;
  };
  return {
    snapshot: (s) => request("", undefined, s),
    callTool: (p, s) => request("/tool-calls", p, s),
    readResource: (p, s) => request("/resource-reads", p, s),
    events: (after, s) => request(`/events?after=${after}`, undefined, s),
    destroy: () => request("", undefined, undefined, "DELETE"),
  };
}
