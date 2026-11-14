/** MessagePort inputs may be cyclic, BigInt, arrays or oversized structured clones. */
export function isJsonEnvelope(
  value: unknown,
  limit: number,
): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return JSON.stringify(value).length <= limit;
  } catch {
    return false;
  }
}
export function isPluginAction(
  value: unknown,
  allowedActions: readonly string[],
): value is { name: string; context: Record<string, unknown> } {
  if (
    !isJsonEnvelope(value, 65536) ||
    typeof value.name !== "string" ||
    !allowedActions.includes(value.name)
  )
    return false;
  return (
    value.context !== null &&
    typeof value.context === "object" &&
    !Array.isArray(value.context)
  );
}
