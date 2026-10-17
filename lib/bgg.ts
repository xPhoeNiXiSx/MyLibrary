/**
 * BoardGameGeek — serveur uniquement.
 *
 * Depuis juillet 2025, l'API XML de BGG exige une application enregistrée et
 * son jeton (`BGG_API_TOKEN`, envoyé en `Authorization: Bearer`). Sans jeton,
 * l'application fonctionne quand même : la recherche est simplement absente
 * et le jeu se saisit à la main.
 *
 * L'API répond en XML. Pas de dépendance pour si peu : les quelques balises
 * utiles sont lues par expressions régulières (`readThings`, testé sur des
 * réponses réelles dans `scripts/test-db.ts`).
 */

const API = "https://boardgamegeek.com/xmlapi2";
const TIMEOUT_MS = 8000;

export function isBggConfigured(): boolean {
  return Boolean(process.env.BGG_API_TOKEN);
}

async function getXml(path: string): Promise<string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new Error("BGG_API_TOKEN n'est pas définie");
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`BoardGameGeek a répondu ${response.status}`);
  return response.text();
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Attributs d'une balise : `type="primary" value="Catan"` → objet. */
function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z_:-]+)="([^"]*)"/g)) out[m[1]] = decodeEntities(m[2]);
  return out;
}

function tags(chunk: string, tag: string): Record<string, string>[] {
  return [...chunk.matchAll(new RegExp(`<${tag}\\b([^>]*?)/?>`, "g"))].map((m) => attributes(m[1]));
}

function intValue(chunk: string, tag: string): number | null {
  const value = Number(tags(chunk, tag)[0]?.value);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export type BggThing = {
  id: string;
  title: string;
  year: number | null;
  designer: string | null;
  publisher: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  minAge: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  /** Extensions connues de BGG, pour les proposer à la saisie. */
  expansions: string[];
};

/**
 * Éditeurs français reconnus : BGG liste tous les éditeurs du monde, on
 * préfère montrer celui de la boîte qu'on a en main.
 */
const FRENCH_PUBLISHERS =
  /asmodee|iello|repos production|gigamic|days of wonder|libellud|matagot|filosofia|space cowboys|ludonaute|blue orange|funforge|bombyx|scorpion masqu|catch up|origames|super meeple|lucky duck|pixie games|ludically|nuts publishing|hurrican|cocktail games|\(france\)/i;

export function readThings(xml: string): BggThing[] {
  const items = xml.split(/<item\b/).slice(1).map((part) => part.split("</item>")[0]);
  return items.map((chunk) => {
    const head = attributes(chunk.slice(0, chunk.indexOf(">")));
    const names = tags(chunk, "name");
    const links = tags(chunk, "link");
    const publishers = links.filter((l) => l.type === "boardgamepublisher").map((l) => l.value);
    const image = /<image>\s*([^<]+?)\s*<\/image>/.exec(chunk)?.[1] ?? null;
    const thumb = /<thumbnail>\s*([^<]+?)\s*<\/thumbnail>/.exec(chunk)?.[1] ?? null;
    const minMinutes = intValue(chunk, "minplaytime") ?? intValue(chunk, "playingtime");
    const maxMinutes = intValue(chunk, "maxplaytime") ?? minMinutes;
    return {
      id: head.id,
      title: names.find((n) => n.type === "primary")?.value ?? names[0]?.value ?? "Sans titre",
      year: intValue(chunk, "yearpublished"),
      designer: links.find((l) => l.type === "boardgamedesigner")?.value ?? null,
      publisher:
        publishers.find((p) => FRENCH_PUBLISHERS.test(p) && p !== "(Unknown)") ??
        publishers.find((p) => p !== "(Unknown)") ??
        null,
      minPlayers: intValue(chunk, "minplayers"),
      maxPlayers: intValue(chunk, "maxplayers"),
      minMinutes,
      maxMinutes,
      minAge: intValue(chunk, "minage"),
      imageUrl: image ? decodeEntities(image) : null,
      thumbnailUrl: thumb ? decodeEntities(thumb) : null,
      expansions: links
        .filter((l) => l.type === "boardgameexpansion" && l.inbound !== "true")
        .map((l) => l.value),
    };
  });
}

/** Identifiants des résultats d'une recherche, dans l'ordre de BGG. */
export function readSearchIds(xml: string): string[] {
  return [...xml.matchAll(/<item\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]);
}

/** Recherche, puis fiches des dix premiers résultats (pour leurs visuels). */
export async function searchBgg(title: string): Promise<BggThing[]> {
  const params = new URLSearchParams({ query: title, type: "boardgame" });
  const ids = [...new Set(readSearchIds(await getXml(`/search?${params}`)))].slice(0, 10);
  if (ids.length === 0) return [];
  const things = readThings(await getXml(`/thing?id=${ids.join(",")}`));
  // `thing` ne garantit pas l'ordre : on remet celui de la recherche.
  return ids.map((id) => things.find((t) => t.id === id)).filter((t): t is BggThing => Boolean(t));
}

export async function bggThing(id: string): Promise<BggThing | null> {
  if (!/^\d+$/.test(id)) return null;
  return readThings(await getXml(`/thing?id=${id}`))[0] ?? null;
}
