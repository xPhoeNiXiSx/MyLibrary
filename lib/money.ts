/**
 * Les montants circulent en centimes d'euro d'un bout à l'autre : jamais de
 * flottant sur de l'argent. La conversion ne se fait qu'à l'affichage et à la
 * saisie.
 */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formatCents(cents: number): string {
  return EUR.format(cents / 100);
}

/** Version signée, pour les plus-values : « +12,50 € ». */
export function formatSignedCents(cents: number): string {
  const formatted = formatCents(Math.abs(cents));
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`;
  return formatted;
}

/**
 * Lit un montant saisi à la main. Accepte « 12,50 », « 12.50 », « 12,50 € »
 * et les espaces de milliers. Renvoie `undefined` si le champ est vide,
 * `null` si la saisie est inexploitable.
 */
export function parseEuros(input: string | null): number | undefined | null {
  if (input === null) return undefined;

  const cleaned = input.replace(/[\s €]/g, "").replace(",", ".");
  if (cleaned === "") return undefined;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

/** Pourcentage de variation, arrondi à une décimale. `undefined` si base nulle. */
export function percentChange(
  from: number,
  to: number,
): number | undefined {
  if (from === 0) return undefined;
  return Math.round(((to - from) / from) * 1000) / 10;
}
