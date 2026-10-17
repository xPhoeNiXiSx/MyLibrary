/**
 * Teintes des visuels de remplacement, quand aucune source n'a d'image : un
 * dégradé tiré du titre, toujours le même pour une même série ou un même jeu.
 */
const PALETTES: [string, string][] = [
  ["#7c2d12", "#f97316"],
  ["#1e3a8a", "#38bdf8"],
  ["#312e81", "#a78bfa"],
  ["#134e4a", "#5eead4"],
  ["#4c0519", "#f43f5e"],
  ["#713f12", "#facc15"],
  ["#831843", "#f9a8d4"],
  ["#14532d", "#4ade80"],
];

export function gradientFor(seed: string): string {
  let hash = 0;
  for (const char of seed.toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const [from, to] = PALETTES[hash % PALETTES.length];
  return `linear-gradient(125deg, ${from}, ${to})`;
}
