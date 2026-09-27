import { query } from "@/lib/db";
import { normalizeTitle } from "@/lib/sources";

/**
 * Les séries suivies et les tomes possédés.
 *
 * Tout ce qui se déduit — tomes manquants, prochain achat — est calculé ici à
 * partir des numéros cochés, jamais stocké : il n'y a qu'une vérité à tenir.
 */

export type SeriesStatus = "ongoing" | "finished";

export type Series = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  status: SeriesStatus | null;
  mangadexId: string | null;
  volumesAuto: number | null;
  volumesManual: number | null;
  volumesCheckedAt: Date | null;
  /** Numéros possédés, triés. */
  owned: number[];
};

export type Progress = {
  /** Tomes parus : la correction manuelle, sinon les sources. `null` si inconnu. */
  total: number | null;
  ownedCount: number;
  /** Plus haut numéro possédé, 0 si aucun. */
  highest: number;
  /** Le tome qui suit le plus haut possédé. `null` quand la série est à jour. */
  next: number | null;
  /** Les trous en dessous du plus haut possédé. */
  gaps: number[];
  /** Tous les tomes parus sont possédés. */
  complete: boolean;
};

export type SeriesInput = {
  title: string;
  author: string | null;
  publisher: string | null;
  mangadexId: string | null;
};

type Row = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  status: SeriesStatus | null;
  mangadex_id: string | null;
  volumes_auto: number | null;
  volumes_manual: number | null;
  volumes_checked_at: string | Date | null;
  owned: number[] | null;
};

const SELECT = `
  select s.id, s.title, s.author, s.publisher, s.status, s.mangadex_id,
         s.volumes_auto, s.volumes_manual, s.volumes_checked_at,
         coalesce(
           (select array_agg(o.number order by o.number)
              from owned_volumes o where o.series_id = s.id),
           '{}'
         ) as owned
    from series s`;

function fromRow(row: Row): Series {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    status: row.status,
    mangadexId: row.mangadex_id,
    volumesAuto: row.volumes_auto,
    volumesManual: row.volumes_manual,
    volumesCheckedAt: row.volumes_checked_at
      ? new Date(row.volumes_checked_at)
      : null,
    owned: (row.owned ?? []).map(Number),
  };
}

export function progressOf(series: Series): Progress {
  const owned = new Set(series.owned);
  const highest = series.owned.length > 0 ? Math.max(...series.owned) : 0;
  const total = series.volumesManual ?? series.volumesAuto;

  const gaps: number[] = [];
  for (let n = 1; n < highest; n += 1) {
    if (!owned.has(n)) gaps.push(n);
  }

  // Sans nombre de tomes connu, on ne peut pas savoir si le suivant est
  // sorti : on le propose quand même, c'est la question qu'on se pose.
  const upToDate = total !== null && highest >= total;
  const complete = upToDate && gaps.length === 0;

  return {
    total,
    ownedCount: owned.size,
    highest,
    next: upToDate ? null : highest + 1,
    gaps,
    complete,
  };
}

/** Nombre de cases à afficher : les tomes parus, ou au moins ce qui est coché. */
export function gridSize(progress: Progress): number {
  return Math.max(progress.total ?? 0, progress.highest, 1);
}

export async function listSeries(): Promise<Series[]> {
  const rows = await query<Row>(`${SELECT} order by lower(s.title)`);
  return rows.map(fromRow);
}

export async function getSeries(id: string): Promise<Series | null> {
  if (!isUuid(id)) return null;
  const rows = await query<Row>(`${SELECT} where s.id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/**
 * La même série chez le même éditeur : l'identifiant MangaDex s'il y en a
 * un, le titre normalisé sinon. Ne sert qu'à l'ajout — modifier ensuite le
 * titre ou l'éditeur ne la change pas.
 */
export function dedupeKey(input: SeriesInput): string {
  const series = input.mangadexId ? `dex:${input.mangadexId}` : `titre:${normalizeTitle(input.title)}`;
  return `${series}|${normalizeTitle(input.publisher ?? "")}`;
}

/**
 * Crée la série, ou renvoie celle qui existe déjà avec la même clé d'ajout
 * (`created: false`) : un formulaire envoyé deux fois ne fait qu'une série.
 * L'index unique tranche même quand les deux envois arrivent ensemble.
 */
export async function createSeries(
  input: SeriesInput,
  ownedUpTo: number,
): Promise<{ series: Series; created: boolean }> {
  const key = dedupeKey(input);
  const inserted = await query<{ id: string }>(
    `insert into series (title, author, publisher, mangadex_id, dedupe_key)
     values ($1, $2, $3, $4, $5)
     on conflict (dedupe_key) where dedupe_key is not null do nothing
     returning id`,
    [input.title, input.author, input.publisher, input.mangadexId, key],
  );

  if (inserted.length === 0) {
    const existing = await query<{ id: string }>(
      `select id from series where dedupe_key = $1`,
      [key],
    );
    return { series: (await getSeries(existing[0].id))!, created: false };
  }

  const id = inserted[0].id;

  if (ownedUpTo > 0) {
    await query(
      `insert into owned_volumes (series_id, number)
       select $1, n from generate_series(1, $2::int) as n
       on conflict do nothing`,
      [id, ownedUpTo],
    );
  }

  return { series: (await getSeries(id))!, created: true };
}

export async function updateSeries(
  id: string,
  fields: { title: string; publisher: string | null; volumesManual: number | null },
): Promise<void> {
  await query(
    `update series
        set title = $2, publisher = $3, volumes_manual = $4, updated_at = now()
      where id = $1`,
    [id, fields.title, fields.publisher, fields.volumesManual],
  );
}

export async function deleteSeries(id: string): Promise<void> {
  await query(`delete from series where id = $1`, [id]);
}

export async function setOwned(
  id: string,
  number: number,
  owned: boolean,
): Promise<void> {
  if (owned) {
    await query(
      `insert into owned_volumes (series_id, number) values ($1, $2)
       on conflict do nothing`,
      [id, number],
    );
  } else {
    await query(
      `delete from owned_volumes where series_id = $1 and number = $2`,
      [id, number],
    );
  }
}

/** Ce que les sources en ligne ont appris sur la série. */
export async function saveSourceInfo(
  id: string,
  info: {
    volumes: number | null;
    status: SeriesStatus | null;
    author: string | null;
  },
): Promise<void> {
  // Une source muette ne doit pas effacer ce qu'une autre avait trouvé.
  await query(
    `update series
        set volumes_auto = coalesce($2, volumes_auto),
            status = coalesce($3, status),
            author = coalesce(author, $4),
            volumes_checked_at = now()
      where id = $1`,
    [id, info.volumes, info.status, info.author],
  );
}

// --- Couvertures -------------------------------------------------------

export type Cover = { number: number; url: string | null; source: string | null };

/** Couvertures déjà cherchées, par série puis par numéro. */
export async function coversFor(
  requests: { seriesId: string; number: number }[],
): Promise<Map<string, string | null>> {
  const found = new Map<string, string | null>();
  if (requests.length === 0) return found;

  const rows = await query<{ series_id: string; number: number; url: string | null }>(
    `select c.series_id, c.number, c.url
       from volume_covers c
       join unnest($1::uuid[], $2::int[]) as r(series_id, number)
         on r.series_id = c.series_id and r.number = c.number`,
    [requests.map((r) => r.seriesId), requests.map((r) => r.number)],
  );
  for (const row of rows) found.set(coverKey(row.series_id, Number(row.number)), row.url);
  return found;
}

export function coverKey(seriesId: string, number: number): string {
  return `${seriesId}:${number}`;
}

export async function allCovers(seriesId: string): Promise<Map<number, string>> {
  const rows = await query<{ number: number; url: string }>(
    `select number, url from volume_covers where series_id = $1 and url is not null`,
    [seriesId],
  );
  return new Map(rows.map((row) => [Number(row.number), row.url]));
}

/**
 * Enregistre les couvertures trouvées. Une couverture déjà connue n'est
 * remplacée que par une source de même rang ou meilleure : l'édition
 * française (Google Books) passe avant la japonaise (MangaDex).
 */
export async function saveCovers(seriesId: string, covers: Cover[]): Promise<void> {
  if (covers.length === 0) return;
  await query(
    `insert into volume_covers (series_id, number, url, source)
     select $1, c.number, c.url, c.source
       from unnest($2::int[], $3::text[], $4::text[]) as c(number, url, source)
     on conflict (series_id, number) do update
       set url = excluded.url, source = excluded.source, fetched_at = now()
       where volume_covers.url is null
          or excluded.url is not null and (
               excluded.source = volume_covers.source
               or excluded.source = 'google'
             )`,
    [
      seriesId,
      covers.map((c) => c.number),
      covers.map((c) => c.url),
      covers.map((c) => c.source),
    ],
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
