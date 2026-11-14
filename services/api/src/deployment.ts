/** Explicit public addresses, independent of untrusted request Host headers. */
export const mainUrl = new URL(
  process.env.PUBLIC_MAIN_URL ?? "http://localhost:5173/",
);
if (!mainUrl.pathname.endsWith("/")) mainUrl.pathname += "/";
export const mainOrigin = mainUrl.origin;
export const previewOrigin = new URL(
  process.env.PUBLIC_PREVIEW_ORIGIN ?? "http://127.0.0.1:4173",
).origin;
if (mainOrigin === previewOrigin) {
  throw new Error("Main and Preview Host must use separate origins");
}
export const publicApiUrl = new URL("api/v1", mainUrl).href;
