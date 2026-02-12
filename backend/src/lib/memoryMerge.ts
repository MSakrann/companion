/**
 * Non-destructive memory merge: only set keys that are present and not null in updates.
 * Pure utility, no Firebase dependency.
 */

export function mergeMemory(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        (out as Record<string, unknown>)[k] = mergeMemory(
          (existing[k] as Record<string, unknown>) || {},
          v as Record<string, unknown>
        );
      } else {
        (out as Record<string, unknown>)[k] = v;
      }
    }
  }
  return out;
}
