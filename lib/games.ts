import { query } from "@/lib/db";
import { normalizeTitle } from "@/lib/sources";

/**
 * Les jeux de société : collection et envies, extensions, prêts, parties.
 *
 * Un jeu voulu et un jeu possédé sont la même ligne à deux moments de sa vie
 * (`status`) ; l'achat n'est qu'une bascule. Les dates circulent en texte
 * `AAAA-MM-JJ`, converties en SQL : le pilote Neon et celui des tests ne
 * rendent pas les colonnes `date` de la même façon.
 */

export type ItemStatus = "owned" | "wanted";

export type Expansion = { id: string; title: string; status: ItemStatus };

export type Loan = { borrower: string; lentOn: string };

export type Play = {
  id: string;
  playedOn: string;
  players: number | null;
  winner: string | null;
  expansions: string[];
  notes: string | null;
};

export type Game = {
  id: string;
  title: string;
  status: ItemStatus;
  designer: string | null;
  publisher: string | null;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  minAge: number | null;
  imageUrl: string | null;
  bggId: string | null;
  ownedExpansions: number;
  loan: Loan | null;
  playCount: number;
  lastPlayed: string | null;
};

export type GameDetail = Game & { expansions: Expansion[]; plays: Play[] };

export type GameInput = {
  title: string;
  status: ItemStatus;
  designer: string | null;
  publisher: string | null;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  minAge: number | null;
  imageUrl: string | null;
  bggId: string | null;
};

export type GameList = "collection" | "envies" | "pretes";
export type PlayersFilter = "2" | "3-4" | "5+";
export type DurationFilter = "30" | "60" | "plus";

export const PLAYERS_FILTERS: PlayersFilter[] = ["2", "3-4", "5+"];
export const DURATION_FILTERS: DurationFilter[] = ["30", "60", "plus"];

type Row = {
  id: string;
  title: string;
  status: ItemStatus;
  designer: string | null;
  publisher: string | null;
  year: number | null;
  min_players: number | null;
  max_players: number | null;
  min_minutes: number | null;
  max_minutes: number | null;
  min_age: number | null;
  image_url: string | null;
  bgg_id: string | null;
  owned_expansions: number | string;
  borrower: string | null;
  lent_on: string | null;
  play_count: number | string;
  last_played: string | null;
};

const SELECT = `
  select g.id, g.title, g.status, g.designer, g.publisher, g.year,
         g.min_players, g.max_players, g.min_minutes, g.max_minutes, g.min_age,
         g.image_url, g.bgg_id,
         (select count(*) from game_expansions e
           where e.game_id = g.id and e.status = 'owned') as owned_expansions,
         l.borrower, to_char(l.lent_on, 'YYYY-MM-DD') as lent_on,
         (select count(*) from game_plays p where p.game_id = g.id) as play_count,
         (select to_char(max(p.played_on), 'YYYY-MM-DD')
            from game_plays p where p.game_id = g.id) as last_played
    from games g
    left join game_loans l on l.game_id = g.id and l.returned_on is null`;

function fromRow(row: Row): Game {
  const n = (value: number | null) => (value === null ? null : Number(value));
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    designer: row.designer,
    publisher: row.publisher,
    year: n(row.year),
    minPlayers: n(row.min_players),
    maxPlayers: n(row.max_players),
    minMinutes: n(row.min_minutes),
    maxMinutes: n(row.max_minutes),
    minAge: n(row.min_age),
    imageUrl: row.image_url,
    bggId: row.bgg_id,
    ownedExpansions: Number(row.owned_expansions),
    loan: row.borrower ? { borrower: row.borrower, lentOn: row.lent_on! } : null,
    playCount: Number(row.play_count),
    lastPlayed: row.last_played,
  };
}

/**
 * Les filtres de la liste, en SQL. Un jeu dont l'info manque n'apparaît pas
 * quand on filtre dessus : mieux vaut un jeu absent qu'un jeu qui ne tient
 * pas dans la soirée.
 */
const PLAYERS_SQL: Record<PlayersFilter, string> = {
  "2": `g.min_players <= 2 and coalesce(g.max_players, g.min_players) >= 2`,
  "3-4": `g.min_players <= 4 and coalesce(g.max_players, g.min_players) >= 3`,
  "5+": `coalesce(g.max_players, g.min_players) >= 5`,
};
const DURATION_SQL: Record<DurationFilter, string> = {
  "30": `coalesce(g.max_minutes, g.min_minutes) <= 30`,
  "60": `coalesce(g.max_minutes, g.min_minutes) <= 60`,
  plus: `coalesce(g.max_minutes, g.min_minutes) > 60`,
};

export async function listGames(
  options: { list?: GameList; players?: PlayersFilter | null; duration?: DurationFilter | null } = {},
): Promise<Game[]> {
  const where: string[] = [];
  const list = options.list ?? "collection";
  if (list === "collection") where.push(`g.status = 'owned'`);
  if (list === "envies") where.push(`g.status = 'wanted'`);
  if (list === "pretes") where.push(`l.borrower is not null`);
  if (options.players) where.push(PLAYERS_SQL[options.players]);
  if (options.duration) where.push(DURATION_SQL[options.duration]);

  const rows = await query<Row>(
    `${SELECT} ${where.length ? `where ${where.join(" and ")}` : ""}
     order by ${list === "pretes" ? "l.lent_on," : ""} lower(g.title)`,
  );
  return rows.map(fromRow);
}

/** Compteurs des trois listes, pour leurs onglets. */
export async function gameCounts(): Promise<Record<GameList, number>> {
  const rows = await query<{ owned: number | string; wanted: number | string; lent: number | string }>(
    `select count(*) filter (where status = 'owned') as owned,
            count(*) filter (where status = 'wanted') as wanted,
            (select count(*) from game_loans where returned_on is null) as lent
       from games`,
  );
  const row = rows[0];
  return {
    collection: Number(row?.owned ?? 0),
    envies: Number(row?.wanted ?? 0),
    pretes: Number(row?.lent ?? 0),
  };
}

/** Extensions voulues de jeux possédés : elles vont dans les envies. */
export async function wantedExpansions(): Promise<
  { id: string; title: string; gameId: string; gameTitle: string }[]
> {
  const rows = await query<{ id: string; title: string; game_id: string; game_title: string }>(
    `select e.id, e.title, g.id as game_id, g.title as game_title
       from game_expansions e join games g on g.id = e.game_id
      where e.status = 'wanted'
      order by lower(g.title), lower(e.title)`,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, gameId: r.game_id, gameTitle: r.game_title }));
}

export async function getGame(id: string): Promise<GameDetail | null> {
  if (!isUuid(id)) return null;
  const rows = await query<Row>(`${SELECT} where g.id = $1`, [id]);
  if (!rows[0]) return null;

  const [expansions, plays] = await Promise.all([
    query<{ id: string; title: string; status: ItemStatus }>(
      `select id, title, status from game_expansions
        where game_id = $1 order by status, lower(title)`,
      [id],
    ),
    query<{
      id: string;
      played_on: string;
      players: number | null;
      winner: string | null;
      expansions: string[] | null;
      notes: string | null;
    }>(
      `select id, to_char(played_on, 'YYYY-MM-DD') as played_on, players, winner,
              expansions, notes
         from game_plays where game_id = $1
        order by played_on desc, created_at desc
        limit 20`,
      [id],
    ),
  ]);

  return {
    ...fromRow(rows[0]),
    expansions,
    plays: plays.map((p) => ({
      id: p.id,
      playedOn: p.played_on,
      players: p.players === null ? null : Number(p.players),
      winner: p.winner,
      expansions: p.expansions ?? [],
      notes: p.notes,
    })),
  };
}

/** Même jeu, même édition : l'identifiant BoardGameGeek, sinon le titre. */
export function gameDedupeKey(input: Pick<GameInput, "title" | "bggId">): string {
  return input.bggId ? `bgg:${input.bggId}` : `titre:${normalizeTitle(input.title)}`;
}

/**
 * Crée le jeu, ou renvoie celui qui existe déjà avec la même clé
 * (`created: false`) — double envoi, ou jeu déjà dans la liste.
 */
export async function createGame(
  input: GameInput,
): Promise<{ id: string; created: boolean }> {
  const key = gameDedupeKey(input);
  const inserted = await query<{ id: string }>(
    `insert into games (title, status, designer, publisher, year, min_players,
                        max_players, min_minutes, max_minutes, min_age, image_url,
                        bgg_id, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (dedupe_key) where dedupe_key is not null do nothing
     returning id`,
    [
      input.title, input.status, input.designer, input.publisher, input.year,
      input.minPlayers, input.maxPlayers, input.minMinutes, input.maxMinutes,
      input.minAge, input.imageUrl, input.bggId, key,
    ],
  );
  if (inserted[0]) return { id: inserted[0].id, created: true };

  const existing = await query<{ id: string }>(
    `select id from games where dedupe_key = $1`,
    [key],
  );
  return { id: existing[0].id, created: false };
}

export async function updateGame(
  id: string,
  input: Omit<GameInput, "bggId">,
): Promise<void> {
  await query(
    `update games
        set title = $2, status = $3, designer = $4, publisher = $5, year = $6,
            min_players = $7, max_players = $8, min_minutes = $9,
            max_minutes = $10, min_age = $11, image_url = $12, updated_at = now()
      where id = $1`,
    [
      id, input.title, input.status, input.designer, input.publisher, input.year,
      input.minPlayers, input.maxPlayers, input.minMinutes, input.maxMinutes,
      input.minAge, input.imageUrl,
    ],
  );
}

export async function setGameStatus(id: string, status: ItemStatus): Promise<void> {
  await query(`update games set status = $2, updated_at = now() where id = $1`, [id, status]);
}

export async function deleteGame(id: string): Promise<void> {
  await query(`delete from games where id = $1`, [id]);
}

// --- Extensions ----------------------------------------------------------

/** Ajoute une extension ; une homonyme du même jeu n'est pas dédoublée. */
export async function addExpansion(
  gameId: string,
  title: string,
  status: ItemStatus,
): Promise<void> {
  await query(
    `insert into game_expansions (game_id, title, status) values ($1, $2, $3)
     on conflict (game_id, lower(title)) do nothing`,
    [gameId, title, status],
  );
}

export async function setExpansionStatus(id: string, status: ItemStatus): Promise<void> {
  await query(`update game_expansions set status = $2 where id = $1`, [id, status]);
}

export async function deleteExpansion(id: string): Promise<void> {
  await query(`delete from game_expansions where id = $1`, [id]);
}

// --- Prêts ---------------------------------------------------------------

/** Prête le jeu. Sans effet s'il est déjà prêté : un seul prêt à la fois. */
export async function lendGame(gameId: string, borrower: string, lentOn: string | null): Promise<void> {
  await query(
    `insert into game_loans (game_id, borrower, lent_on)
     values ($1, $2, coalesce($3::date, current_date))
     on conflict (game_id) where returned_on is null do nothing`,
    [gameId, borrower, lentOn],
  );
}

export async function returnGame(gameId: string): Promise<void> {
  await query(
    `update game_loans set returned_on = current_date
      where game_id = $1 and returned_on is null`,
    [gameId],
  );
}

// --- Parties -------------------------------------------------------------

export async function addPlay(
  gameId: string,
  play: Omit<Play, "id">,
): Promise<void> {
  await query(
    `insert into game_plays (game_id, played_on, players, winner, expansions, notes)
     values ($1, $2::date, $3, $4, $5::uuid[], $6)`,
    [gameId, play.playedOn, play.players, play.winner, play.expansions, play.notes],
  );
}

export async function deletePlay(id: string): Promise<void> {
  await query(`delete from game_plays where id = $1`, [id]);
}

// --- Réglage de vue ------------------------------------------------------

export type GamesView = "cartes" | "liste";
const VIEW_KEY = "jeux.vue";

/** La vue choisie suit d'un appareil à l'autre : elle vit en base. */
export async function getGamesView(): Promise<GamesView> {
  try {
    const rows = await query<{ value: unknown }>(
      `select value from app_settings where key = $1`,
      [VIEW_KEY],
    );
    return rows[0]?.value === "liste" ? "liste" : "cartes";
  } catch {
    return "cartes";
  }
}

export async function setGamesView(view: GamesView): Promise<void> {
  await query(
    `insert into app_settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [VIEW_KEY, JSON.stringify(view)],
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
