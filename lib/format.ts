/**
 * Mises en forme sans dépendance à la base : utilisables côté navigateur.
 */

/** « T12, T51 » — au-delà de `max`, la suite est résumée. */
export function formatGaps(gaps: number[], max = 6): string {
  const shown = gaps.slice(0, max).map((n) => `T${n}`);
  const rest = gaps.length - shown.length;
  return rest > 0
    ? `${shown.join(", ")} et ${rest} autre${rest > 1 ? "s" : ""}`
    : shown.join(", ");
}
