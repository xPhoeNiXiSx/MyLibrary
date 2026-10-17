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

/** « 2–4 », « 2 » — `null` si inconnu. */
export function rangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min === null || max === null || min === max) return String(min ?? max);
  return `${min}–${max}`;
}

export function playersLabel(min: number | null, max: number | null, long = false): string | null {
  const range = rangeLabel(min, max);
  if (!range) return null;
  if (!long) return range;
  return `${range} joueur${(max ?? min ?? 0) > 1 ? "s" : ""}`;
}

export function durationLabel(min: number | null, max: number | null): string | null {
  const range = rangeLabel(min, max);
  return range ? `${range} min` : null;
}

export function ageLabel(age: number | null): string | null {
  return age === null ? null : `${age}+`;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 11 oct. » depuis « 2026-10-11 ». */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** « 11 octobre » depuis « 2026-10-11 ». */
export function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_LONG[m - 1]}`;
}

/** Jours écoulés entre deux dates `AAAA-MM-JJ`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Aujourd'hui à Paris, en `AAAA-MM-JJ`. */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}
