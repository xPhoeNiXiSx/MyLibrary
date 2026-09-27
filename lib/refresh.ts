import {
  gridSize,
  progressOf,
  saveCovers,
  saveSourceInfo,
  type Cover,
  type Series,
} from "@/lib/series";
import { googleEdition, mangaInfo } from "@/lib/sources";

/** Au-delà, le nombre de tomes parus est redemandé aux sources. */
export const STALE_AFTER_DAYS = 7;

export function isStale(series: Series, now = Date.now()): boolean {
  if (!series.volumesCheckedAt) return true;
  return now - series.volumesCheckedAt.getTime() > STALE_AFTER_DAYS * 86_400_000;
}

export type RefreshReport = {
  volumes: number | null;
  /** Message lisible par source qui n'a pas répondu. */
  failures: string[];
};

/**
 * Interroge les deux sources et enregistre ce qu'elles savent.
 *
 * Pour le nombre de tomes, l'édition française (Google Books) prime : c'est
 * elle qu'on achète, et le Japon a souvent quelques tomes d'avance. MangaDex
 * ne sert qu'à défaut. Une correction manuelle, elle, reste intacte.
 */
export async function refreshSeries(series: Series): Promise<RefreshReport> {
  const [google, dex] = await Promise.allSettled([
    googleEdition(series.title, series.publisher),
    series.mangadexId ? mangaInfo(series.mangadexId) : Promise.resolve(null),
  ]);

  const failures: string[] = [];
  if (google.status === "rejected") {
    failures.push(`Google Books : ${reason(google.reason)}`);
  }
  if (dex.status === "rejected") {
    failures.push(`MangaDex : ${reason(dex.reason)}`);
  }

  const edition = google.status === "fulfilled" ? google.value : null;
  const manga = dex.status === "fulfilled" ? dex.value : null;

  // Google Books en panne : garder le compte déjà relevé plutôt que de le
  // remplacer par celui du Japon. MangaDex ne comble qu'un vide.
  const fallback =
    edition === null && series.volumesAuto !== null ? null : (manga?.volumes ?? null);
  const volumes = edition?.volumes ?? fallback;

  // Toutes les sources en échec : ne rien écrire, sinon la date de relevé
  // ferait croire que la série est à jour.
  if (!edition && !manga) return { volumes: null, failures };

  await saveSourceInfo(series.id, {
    volumes,
    status: manga?.status ?? null,
    author: manga?.author ?? null,
  });

  const covers: Cover[] = [];
  const seen = new Set<number>();
  for (const [number, url] of edition?.covers ?? []) {
    covers.push({ number, url, source: "google" });
    seen.add(number);
  }
  for (const [number, url] of manga?.covers ?? []) {
    if (seen.has(number)) continue;
    covers.push({ number, url, source: "mangadex" });
    seen.add(number);
  }

  // Marquer « cherché, rien trouvé » les tomes restés sans couverture, pour
  // que l'affichage n'aille pas les redemander.
  const size = gridSize(
    progressOf({ ...series, volumesAuto: volumes ?? series.volumesAuto }),
  );
  for (let number = 1; number <= size + 1; number += 1) {
    if (!seen.has(number)) covers.push({ number, url: null, source: null });
  }

  await saveCovers(series.id, covers);
  return { volumes: volumes ?? series.volumesAuto, failures };
}

function reason(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "TimeoutError" ? "pas de réponse" : error.message;
  }
  return String(error);
}
