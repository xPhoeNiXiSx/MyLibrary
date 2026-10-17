import Link from "next/link";

import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import {
  ageLabel,
  daysBetween,
  durationLabel,
  longDate,
  parisToday,
  playersLabel,
} from "@/lib/format";
import {
  DURATION_FILTERS,
  PLAYERS_FILTERS,
  gameCounts,
  getGamesView,
  listGames,
  wantedExpansions,
  type DurationFilter,
  type Game,
  type GameList,
  type PlayersFilter,
} from "@/lib/games";

import { migrateAction } from "../compte/actions";
import { DatabaseErrorScreen, SetupScreen } from "../db-screens";
import { Masthead } from "../masthead";
import { SubmitButton } from "../submit-button";
import { setGamesViewAction } from "./actions";
import { GameCover } from "./game-cover";

export const dynamic = "force-dynamic";

const LISTS: { key: GameList; label: string }[] = [
  { key: "collection", label: "Collection" },
  { key: "envies", label: "Envies" },
  { key: "pretes", label: "Prêtés" },
];
const PLAYERS_LABELS: Record<PlayersFilter, string> = { "2": "2", "3-4": "3–4", "5+": "5+" };
const PLAYERS_ACTIVE: Record<PlayersFilter, string> = { "2": "2 joueurs", "3-4": "3–4 joueurs", "5+": "5 joueurs et +" };
const DURATION_LABELS: Record<DurationFilter, string> = { "30": "< 30 min", "60": "< 1 h", plus: "1 h +" };

type Params = { liste?: string; joueurs?: string; duree?: string; filtres?: string };

/** Filtres et liste passent par l'URL : une liste filtrée se partage et le retour fonctionne. */
function hrefWith(current: Params, changes: Partial<Record<keyof Params, string | null>>): string {
  const next = new URLSearchParams();
  const merged = { ...current, ...changes };
  for (const key of ["liste", "joueurs", "duree", "filtres"] as const) {
    const value = merged[key];
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/jeux?${qs}` : "/jeux";
}

function infoLine(game: Game, long: boolean): string {
  return [
    playersLabel(game.minPlayers, game.maxPlayers, long),
    durationLabel(game.minMinutes, game.maxMinutes),
    long ? ageLabel(game.minAge) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function extensionsLabel(count: number): string | null {
  return count > 0 ? `+ ${count} extension${count > 1 ? "s" : ""}` : null;
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;

  if (!isDatabaseConfigured()) {
    return <SetupScreen title="Mes jeux" missing={["DATABASE_URL"]} />;
  }
  let ready: boolean;
  try {
    ready = await isSchemaReady();
  } catch (error) {
    return (
      <DatabaseErrorScreen title="Mes jeux" message={error instanceof Error ? error.message : String(error)} />
    );
  }
  if (!ready) {
    return (
      <main className="page narrow">
        <Masthead />
        <h1 className="page-title">Mes jeux</h1>
        <div className="panel">
          <h2>Base à mettre à jour</h2>
          <p className="hint">
            Les jeux de société ont besoin de nouvelles tables. Un clic les crée ;
            rien n&apos;est effacé.
          </p>
          <form action={migrateAction} className="form">
            <SubmitButton pending="Mise à jour…">Mettre à jour la base</SubmitButton>
          </form>
        </div>
      </main>
    );
  }

  const list: GameList = params.liste === "envies" || params.liste === "pretes" ? params.liste : "collection";
  const players = PLAYERS_FILTERS.find((f) => f === params.joueurs) ?? null;
  const duration = DURATION_FILTERS.find((f) => f === params.duree) ?? null;
  const current: Params = {
    liste: list === "collection" ? undefined : list,
    joueurs: players ?? undefined,
    duree: duration ?? undefined,
    filtres: params.filtres === "1" ? "1" : undefined,
  };

  const filteringNow = Boolean(players || duration);
  const [games, counts, view, expansions, tonight] = await Promise.all([
    listGames({ list, players, duration }),
    gameCounts(),
    getGamesView(),
    list === "envies" ? wantedExpansions() : Promise.resolve([]),
    // La carte « Ce soir » n'apparaît que sur la collection non filtrée.
    list === "collection" && !filteringNow
      ? listGames({ list: "collection", players: "3-4", duration: "60" })
      : Promise.resolve([]),
  ]);
  const today = parisToday();
  const filtering = filteringNow;
  const filtersOpen = current.filtres === "1";

  return (
    <main className="page narrow">
      <Masthead />

      <div className="title-row">
        <div>
          <h1 className="page-title">Mes jeux</h1>
          <p className="subtitle">
            {counts.collection} jeu{counts.collection > 1 ? "x" : ""}
            {counts.pretes > 0 ? ` · ${counts.pretes} prêté${counts.pretes > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <Link href="/jeux/nouveau" className="pill-button">+ Jeu</Link>
      </div>

      <div className="games-tools">
        <nav className="segmented" aria-label="Listes">
          {LISTS.map(({ key, label }) => (
            <Link
              key={key}
              href={hrefWith(current, { liste: key === "collection" ? null : key })}
              className={list === key ? "active" : undefined}
              aria-current={list === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={setGamesViewAction} className="view-toggle" aria-label="Affichage">
          <input type="hidden" name="back" value={hrefWith(current, {})} />
          <button
            type="submit"
            name="view"
            value="cartes"
            className={view === "cartes" ? "active" : ""}
            aria-pressed={view === "cartes"}
            aria-label="Vue en cartes"
            title="Vue en cartes"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13" y="4" width="7" height="7" rx="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1.5" />
                <rect x="13" y="13" width="7" height="7" rx="1.5" />
              </g>
            </svg>
          </button>
          <button
            type="submit"
            name="view"
            value="liste"
            className={view === "liste" ? "active" : ""}
            aria-pressed={view === "liste"}
            aria-label="Vue en liste"
            title="Vue en liste"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>
      </div>

      {tonight.length > 0 ? (
        <Link href={hrefWith(current, { joueurs: "3-4", duree: "60", filtres: null })} className="tonight-card">
          <div className="tonight-text">
            <span className="badge peach">Ce soir</span>
            <strong>3 ou 4 joueurs,</strong>
            <em>moins d&apos;une heure</em>
            <span className="subtitle">
              {tonight.length} jeu{tonight.length > 1 ? "x correspondent" : " correspond"}
            </span>
          </div>
          <div className="tonight-stack" aria-hidden="true">
            {tonight.slice(0, 3).map((game) => (
              <GameCover key={game.id} url={game.imageUrl} title={game.title} className="game-cover mini" />
            ))}
          </div>
        </Link>
      ) : null}

      <div className="filter-bar">
        <Link
          href={hrefWith(current, { filtres: filtersOpen ? null : "1" })}
          className={filtersOpen ? "filter-button open" : "filter-button"}
          aria-expanded={filtersOpen}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Filtrer
        </Link>
        {players ? (
          <Link href={hrefWith(current, { joueurs: null })} className="chip active" aria-label={`Retirer le filtre ${PLAYERS_ACTIVE[players]}`}>
            {PLAYERS_ACTIVE[players]} ×
          </Link>
        ) : null}
        {duration ? (
          <Link href={hrefWith(current, { duree: null })} className="chip active" aria-label={`Retirer le filtre ${DURATION_LABELS[duration]}`}>
            {DURATION_LABELS[duration]} ×
          </Link>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="filters">
          <p className="section-label">Joueurs</p>
          <div className="chip-row">
            <Link href={hrefWith(current, { joueurs: null })} className={players ? "chip" : "chip active"}>Tous</Link>
            {PLAYERS_FILTERS.map((f) => (
              <Link key={f} href={hrefWith(current, { joueurs: f })} className={players === f ? "chip active" : "chip"}>
                {PLAYERS_LABELS[f]}
              </Link>
            ))}
          </div>
          <p className="section-label">Durée</p>
          <div className="chip-row">
            <Link href={hrefWith(current, { duree: null })} className={duration ? "chip" : "chip active"}>Toutes</Link>
            {DURATION_FILTERS.map((f) => (
              <Link key={f} href={hrefWith(current, { duree: f })} className={duration === f ? "chip active" : "chip"}>
                {DURATION_LABELS[f]}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {games.length === 0 && !(list === "envies" && expansions.length > 0) ? (
        <div className="panel">
          <h2>
            {filtering
              ? "Aucun jeu ne correspond"
              : list === "envies"
                ? "Aucune envie pour l'instant"
                : list === "pretes"
                  ? "Aucun jeu prêté"
                  : "Aucun jeu pour l'instant"}
          </h2>
          <p className="hint">
            {filtering
              ? "Élargis les filtres : un jeu dont le nombre de joueurs ou la durée est inconnu n'apparaît pas quand on filtre dessus."
              : list === "pretes"
                ? "Un jeu se prête depuis sa fiche."
                : "Ajoute un jeu avec le bouton « + Jeu »."}
          </p>
        </div>
      ) : games.length === 0 ? null : view === "cartes" ? (
        <ul className="game-grid">
          {games.map((game) => {
            const tag = game.loan ? `Prêté à ${game.loan.borrower}` : extensionsLabel(game.ownedExpansions);
            return (
              <li key={game.id}>
                <Link href={`/jeux/${game.id}`} className="game-tile">
                  <div className="game-tile-art">
                    <GameCover url={game.imageUrl} title={game.title} />
                    {tag ? <span className={game.loan ? "tag loan" : "tag"}>{tag}</span> : null}
                  </div>
                  <span className="series-name">{game.title}</span>
                  <GameMeta game={game} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="series-list game-list">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/jeux/${game.id}`} className="series-card">
                <GameCover url={game.imageUrl} title={game.title} className="game-cover small" />
                <div className="series-card-body">
                  <span className="series-name">{game.title}</span>
                  {infoLine(game, true) ? <span className="game-info">{infoLine(game, true)}</span> : null}
                  {extensionsLabel(game.ownedExpansions) ? (
                    <span className="series-gaps">{extensionsLabel(game.ownedExpansions)}</span>
                  ) : null}
                  {game.loan ? (
                    <span className="tag loan inline">
                      Prêté à {game.loan.borrower}
                      {list === "pretes" ? ` · ${daysBetween(game.loan.lentOn, today)} j` : ""}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list === "pretes" && games.length > 0 ? (
        <p className="hint">
          Le plus ancien prêt date du {longDate(games[0].loan!.lentOn)}.
        </p>
      ) : null}

      {list === "envies" && expansions.length > 0 ? (
        <>
          <p className="section-label">Extensions voulues</p>
          <ul className="plain-list">
            {expansions.map((e) => (
              <li key={e.id}>
                <Link href={`/jeux/${e.gameId}#extensions`}>
                  <strong>{e.title}</strong> <span className="subtitle">· {e.gameTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}

/** Joueurs et durée, avec leurs pictogrammes : ce qu'on regarde pour choisir. */
function GameMeta({ game }: { game: Game }) {
  const players = playersLabel(game.minPlayers, game.maxPlayers);
  const duration = durationLabel(game.minMinutes, game.maxMinutes);
  if (!players && !duration) return null;
  return (
    <span className="game-meta">
      {players ? (
        <span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="9" cy="8" r="3" />
              <path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M15.5 14.6c2.3.2 4 1.6 4.8 4.4" />
            </g>
          </svg>
          {players}
        </span>
      ) : null}
      {duration ? (
        <span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7.5V12l3 2" />
            </g>
          </svg>
          {duration}
        </span>
      ) : null}
    </span>
  );
}
