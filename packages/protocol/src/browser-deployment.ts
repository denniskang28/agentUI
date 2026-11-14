/** Build-time public addresses; uploaded code runs only on Preview Host. */
export const mainOrigin = new URL(
  import.meta.env?.VITE_MAIN_ORIGIN ?? "http://localhost:5173",
).origin;
export const previewOrigin = new URL(
  import.meta.env?.VITE_PREVIEW_ORIGIN ?? "http://127.0.0.1:4173",
).origin;
export const apiBase = `${import.meta.env?.BASE_URL ?? "/"}api/v1`;
