import { cspSchema } from "./protocol";
/** Header policy for a dedicated proxy document; unrelated A2UI pages keep their policy. */
export function sandboxHeaders(
  url: URL,
  allowedParents: string[],
  allowedExternalOrigins: string[] = [],
) {
  for (const value of allowedParents) {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.hostname.includes("*")
    )
      throw Error("Expected exact parent origins");
  }
  const parent = url.searchParams.get("parentOrigin");
  if (!parent || !allowedParents.includes(parent))
    throw Error("Parent origin is not allowed");
  const csp = cspSchema.parse(JSON.parse(url.searchParams.get("csp") ?? "{}"));
  const clean = (values: string[] = []) =>
    values
      .map((value) => {
        const u = new URL(value);
        if (
          u.origin !== value ||
          u.hostname.includes("*") ||
          !["http:", "https:", "wss:"].includes(u.protocol) ||
          !allowedExternalOrigins.includes(value)
        )
          throw Error("Resource origin is not permitted");
        return value;
      })
      .join(" ");
  const resources = clean(csp.resourceDomains),
    connect = clean(csp.connectDomains);
  if (csp.frameDomains?.length || csp.baseUriDomains?.length)
    throw Error("Nested frames and custom base URIs are unsupported");
  return {
    "Content-Security-Policy": `default-src 'none'; script-src 'self' 'unsafe-inline' ${resources}; style-src 'self' 'unsafe-inline' ${resources}; img-src data: ${resources}; font-src ${resources || "'none'"}; media-src data: ${resources}; connect-src 'self' ${connect}; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${allowedParents.join(" ")}`,
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), clipboard-write=()",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}
