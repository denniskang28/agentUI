import { apiBase } from "../../../packages/protocol/src/browser-deployment";
export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(apiBase + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(`${error.code ?? response.status}: ${error.message}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function download(name: string, value: unknown, raw = false) {
  const url = URL.createObjectURL(
    new Blob([raw ? String(value) : JSON.stringify(value, null, 2)], {
      type: raw ? "text/plain;charset=utf-8" : "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
