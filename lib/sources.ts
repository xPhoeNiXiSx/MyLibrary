/**
 * Sources en ligne — serveur uniquement.
 *
 * - **Google Books** connaît les éditions françaises : c'est lui qui donne le
 *   nombre de tomes parus en France et les vraies couvertures Glénat, Kana…
 *   Sa couverture est inégale, d'où la seconde source.
 * - **MangaDex** a une couverture pour presque chaque tome, surtout
 *   japonaise, ainsi que l'auteur et le statut (en cours / terminée). Son
 *   nombre de tomes est celui du Japon, souvent en avance sur la France.
 *
 * Aucune n'est indispensable : chaque appel est borné dans le temps et une
 * source muette renvoie simplement « rien trouvé ».
 */

import type { SeriesStatus } from "@/lib/series";

const TIMEOUT_MS = 8000;

/** MangaDex refuse les requêtes sans User-Agent identifiable. */
const HEADERS = { "User-Agent": "MyLibrary/0.1 (collection personnelle)" };

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).host} a répondu ${response.status}`);
  }
  return response.json();
}

/** Minuscules, sans accents ni ponctuation superflue : de quoi comparer des titres. */
export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Google Books ------------------------------------------------------

export type EditionInfo = {
  /** Plus haut numéro paru en France, `null` si rien de reconnaissable. */
  volumes: number | null;
  covers: Map<number, string>;
};

type GoogleItem = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    publisher?: string;
    publishedDate?: string;
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

/** Tout ce qui porte un numéro sans être un tome de la série régulière. */
const NOT_A_VOLUME =
  /\b(coffret|pack|collector|integrale|artbook|art book|guide|roman|anime comics|film|databook|fanbook|magazine|coloriage|calendrier|lot)\b/;

/**
 * Le numéro de tome d'un résultat, ou `null` s'il ne s'agit pas d'un tome de
 * cette série. Le titre doit commencer par celui de la série, suivi du seul
 * numéro : « One Piece Party 3 » n'est pas le tome 3 de One Piece.
 */
export function volumeNumberOf(
  seriesTitle: string,
  title: string,
  subtitle = "",
): number | null {
  const series = normalizeTitle(seriesTitle);
  const full = normalizeTitle(`${title} ${subtitle}`);
  if (!series || !full.startsWith(series)) return null;
  if (NOT_A_VOLUME.test(full)) return null;

  const rest = full
    .slice(series.length)
    .replace(/\bedition originale\b/g, " ")
    .replace(/\bnouvelle edition\b/g, " ")
    .trim();

  const match = /^(?:(?:tome|t|vol|volume|n|no)\s*)?(\d{1,3})(?!\d)/.exec(rest);
  if (!match) return null;
  const number = Number(match[1]);
  return number > 0 ? number : null;
}

function httpsImage(url: string): string {
  return url.replace(/^http:/, "https:").replace(/&edge=curl/g, "");
}

/**
 * Lit une page de résultats Google Books. Écarté : ce qui n'est pas en
 * français, pas chez l'éditeur demandé, ou pas encore paru — une
 * précommande ne doit pas devenir le « prochain tome ».
 */
export function readGoogleItems(
  seriesTitle: string,
  publisher: string | null,
  items: GoogleItem[],
  today: string,
): EditionInfo {
  const wanted = publisher ? normalizeTitle(publisher) : null;
  const covers = new Map<number, string>();
  let volumes: number | null = null;

  for (const item of items) {
    const info = item.volumeInfo;
    if (!info?.title) continue;
    if (info.language && info.language !== "fr") continue;
    if (wanted && !normalizeTitle(info.publisher ?? "").includes(wanted)) continue;
    if (info.publishedDate && info.publishedDate.slice(0, 10) > today) continue;

    const number = volumeNumberOf(seriesTitle, info.title, info.subtitle);
    if (number === null) continue;

    volumes = Math.max(volumes ?? 0, number);
    const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
    if (image && !covers.has(number)) covers.set(number, httpsImage(image));
  }

  return { volumes, covers };
}

export async function googleEdition(
  seriesTitle: string,
  publisher: string | null,
): Promise<EditionInfo> {
  const terms = [`intitle:"${seriesTitle}"`];
  if (publisher) terms.push(`inpublisher:"${publisher}"`);

  const params = new URLSearchParams({
    q: terms.join(" "),
    langRestrict: "fr",
    printType: "books",
    maxResults: "40",
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);

  const today = new Date().toISOString().slice(0, 10);
  const items: GoogleItem[] = [];
  // Trois pages de 40 couvrent les séries longues ; au-delà, les résultats
  // ne sont plus pertinents.
  for (const start of [0, 40, 80]) {
    params.set("startIndex", String(start));
    const page = (await getJson(
      `https://www.googleapis.com/books/v1/volumes?${params}`,
    )) as { items?: GoogleItem[] };
    if (!page.items?.length) break;
    items.push(...page.items);
    if (page.items.length < 40) break;
  }

  return readGoogleItems(seriesTitle, publisher, items, today);
}

// --- MangaDex ----------------------------------------------------------

const MANGADEX = "https://api.mangadex.org";

export type MangaMatch = {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  status: SeriesStatus | null;
  coverUrl: string | null;
};

type DexManga = {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Record<string, string>[];
    status?: string;
    lastVolume?: string | null;
    year?: number | null;
  };
  relationships?: {
    type: string;
    attributes?: { name?: string; fileName?: string };
  }[];
};

type DexCover = {
  attributes: { volume: string | null; fileName: string; locale?: string | null };
};

function dexStatus(status: string | undefined): SeriesStatus | null {
  if (status === "completed") return "finished";
  if (status === "ongoing" || status === "hiatus") return "ongoing";
  return null;
}

/** Le titre français s'il existe, sinon l'anglais, sinon le premier venu. */
function dexTitle(manga: DexManga): string {
  const fr = manga.attributes.altTitles?.find((t) => t.fr)?.fr;
  return (
    fr ??
    manga.attributes.title.en ??
    Object.values(manga.attributes.title)[0] ??
    "Sans titre"
  );
}

export function coverFileUrl(mangaId: string, fileName: string): string {
  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`;
}

export function readDexManga(manga: DexManga): MangaMatch {
  const author =
    manga.relationships?.find((r) => r.type === "author")?.attributes?.name ??
    null;
  const cover = manga.relationships?.find((r) => r.type === "cover_art")
    ?.attributes?.fileName;
  return {
    id: manga.id,
    title: dexTitle(manga),
    author,
    year: manga.attributes.year ?? null,
    status: dexStatus(manga.attributes.status),
    coverUrl: cover ? coverFileUrl(manga.id, cover) : null,
  };
}

export async function searchManga(title: string): Promise<MangaMatch[]> {
  const params = new URLSearchParams({ title, limit: "10" });
  params.append("includes[]", "author");
  params.append("includes[]", "cover_art");
  params.append("order[relevance]", "desc");
  const page = (await getJson(`${MANGADEX}/manga?${params}`)) as {
    data?: DexManga[];
  };
  return (page.data ?? []).map(readDexManga);
}

export type MangaInfo = {
  author: string | null;
  status: SeriesStatus | null;
  /** Tomes parus au Japon, d'après les couvertures ou le dernier tome annoncé. */
  volumes: number | null;
  covers: Map<number, string>;
};

/**
 * Une couverture par tome. Plusieurs peuvent exister pour un même numéro
 * (japonaise, française, anglaise…) : la française d'abord, puis la
 * japonaise, puis n'importe laquelle.
 */
export function readDexCovers(mangaId: string, covers: DexCover[]): Map<number, string> {
  const rank = (locale: string | null | undefined) =>
    locale === "fr" ? 0 : locale === "ja" ? 1 : 2;
  const best = new Map<number, { url: string; rank: number }>();

  for (const cover of covers) {
    const number = Number(cover.attributes.volume);
    if (!Number.isInteger(number) || number <= 0) continue;
    const candidate = {
      url: coverFileUrl(mangaId, cover.attributes.fileName),
      rank: rank(cover.attributes.locale),
    };
    const current = best.get(number);
    if (!current || candidate.rank < current.rank) best.set(number, candidate);
  }

  return new Map([...best].map(([number, { url }]) => [number, url]));
}

export async function mangaInfo(mangaId: string): Promise<MangaInfo> {
  const params = new URLSearchParams();
  params.append("includes[]", "author");
  const manga = (
    (await getJson(`${MANGADEX}/manga/${mangaId}?${params}`)) as { data: DexManga }
  ).data;
  const match = readDexManga(manga);

  const all: DexCover[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const coverParams = new URLSearchParams({
      limit: "100",
      offset: String(offset),
    });
    coverParams.append("manga[]", mangaId);
    coverParams.append("order[volume]", "asc");
    const page = (await getJson(`${MANGADEX}/cover?${coverParams}`)) as {
      data?: DexCover[];
      total?: number;
    };
    all.push(...(page.data ?? []));
    if (!page.total || all.length >= page.total) break;
  }

  const covers = readDexCovers(mangaId, all);
  const lastVolume = Number(manga.attributes.lastVolume);
  const volumes =
    match.status === "finished" && Number.isInteger(lastVolume) && lastVolume > 0
      ? lastVolume
      : covers.size > 0
        ? Math.max(...covers.keys())
        : null;

  return { author: match.author, status: match.status, volumes, covers };
}
