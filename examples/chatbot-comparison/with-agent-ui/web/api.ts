export const apiUrl = (url: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, "")}${url}`;

export async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.ok) throw Error(await response.text());
  return response.json() as Promise<T>;
}
