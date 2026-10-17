import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ageLabel,
  daysBetween,
  rangeLabel,
  longDate,
  parisToday,
  playersLabel,
  shortDate,
} from "@/lib/format";
import { getGame } from "@/lib/games";

import { Masthead } from "../../masthead";
import { SubmitButton } from "../../submit-button";
import {
  addExpansionAction,
  addPlayAction,
  deleteExpansionAction,
  deleteGameAction,
  deletePlayAction,
  lendGameAction,
  returnGameAction,
  setGameStatusAction,
  toggleExpansionAction,
  updateGameAction,
} from "../actions";
import { GameCover } from "../game-cover";
import { GameFields } from "../game-fields";

export const dynamic = "force-dynamic";

const ICONS = {
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.6c2.3.2 4 1.6 4.8 4.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  cake: (
    <>
      <path d="M5 20h14v-7H5z" />
      <path d="M5 15.5c2 1.3 4.7 1.3 7 0s5-1.3 7 0" />
      <path d="M12 13V9" />
    </>
  ),
};

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ existe?: string; enregistre?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const { existe, enregistre, erreur } = await searchParams;
  const game = await getGame(id);
  if (!game) notFound();

  const today = parisToday();
  const owned = game.expansions.filter((e) => e.status === "owned");
  const expansionNames = new Map(game.expansions.map((e) => [e.id, e.title]));
  const meta = [game.designer, game.publisher, game.year].filter(Boolean).join(" · ");
  const stats = [
    ["joueurs", playersLabel(game.minPlayers, game.maxPlayers), "people"],
    ["minutes", rangeLabel(game.minMinutes, game.maxMinutes), "clock"],
    ["ans", ageLabel(game.minAge), "cake"],
  ] as const;

  const lentDays = game.loan ? daysBetween(game.loan.lentOn, today) : 0;

  return (
    <main className="page narrow games">
      <Masthead />
      <Link href={game.status === "wanted" ? "/jeux?liste=envies" : "/jeux"} className="back-link">
        ‹ Mes jeux
      </Link>

      <div className="game-hero">
        <GameCover url={game.imageUrl} title={game.title} className="game-cover large" />
        <h1 className="page-title">{game.title}</h1>
        {meta ? <p className="subtitle">{meta}</p> : null}
        {game.status === "wanted" ? <span className="badge peach">Dans mes envies</span> : null}
      </div>

      {existe ? <p className="success" role="status">Ce jeu était déjà dans ta liste : le voici.</p> : null}
      {enregistre ? <p className="success" role="status">Modifications enregistrées.</p> : null}

      {game.status === "wanted" ? (
        <form action={setGameStatusAction} className="form buy-form">
          <input type="hidden" name="id" value={game.id} />
          <input type="hidden" name="status" value="owned" />
          <SubmitButton pending="…">Je l&apos;ai acheté</SubmitButton>
        </form>
      ) : null}

      <div className="stat-tiles three">
        {stats.map(([label, value, icon]) => (
          <div className="stat-tile" key={label}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="stat-icon">
              <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[icon]}
              </g>
            </svg>
            <b>{value ?? "—"}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Extensions */}
      <section id="extensions">
        <div className="section-head">
          <h2>Extensions</h2>
          {game.expansions.length > 0 ? <span>{owned.length} sur {game.expansions.length}</span> : null}
        </div>
        <div className="panel list-card">
          {game.expansions.length > 0 ? (
            <ul className="expansion-list">
              {game.expansions.map((e) => (
                <li key={e.id}>
                  <form action={toggleExpansionAction}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value={e.status === "owned" ? "wanted" : "owned"} />
                    <button
                      type="submit"
                      className={e.status === "owned" ? "check on" : "check"}
                      aria-pressed={e.status === "owned"}
                      aria-label={`${e.title} : ${e.status === "owned" ? "possédée, toucher pour la remettre en envie" : "en envie, toucher pour la cocher"}`}
                    >
                      <span className="box">
                        {e.status === "owned" ? (
                          <svg viewBox="0 0 22 22" width="18" height="18" aria-hidden="true">
                            <path d="M6 11.3 9.4 14.5 16 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </span>
                    </button>
                  </form>
                  <div className="expansion-text">
                    <span className={e.status === "owned" ? "" : "muted"}>{e.title}</span>
                    <small className={e.status === "owned" ? "accent-text" : "peach-text"}>
                      {e.status === "owned" ? "Possédée" : "Dans mes envies"}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Aucune extension enregistrée.</p>
          )}
          <form action={addExpansionAction} className="inline-form">
            <input type="hidden" name="gameId" value={game.id} />
            <input name="title" placeholder="Ajouter une extension" aria-label="Nom de l'extension" required />
            <select name="status" aria-label="Possédée ou voulue" defaultValue="owned">
              <option value="owned">Je l&apos;ai</option>
              <option value="wanted">Envie</option>
            </select>
            <SubmitButton pending="…" className="secondary">Ajouter</SubmitButton>
          </form>
        </div>
      </section>

      {/* Prêt : un ticket quand le jeu est sorti, un champ sinon */}
      {game.status === "owned" ? (
        <section id="pret">
          {game.loan ? (
            <div className="loan-ticket">
              <div>
                <span className="ticket-label">Prêté à</span>
                <strong>{game.loan.borrower}</strong>
                <span>
                  depuis le {longDate(game.loan.lentOn)}
                  {lentDays > 0 ? ` · ${lentDays} jour${lentDays > 1 ? "s" : ""}` : " · aujourd'hui"}
                </span>
              </div>
              <form action={returnGameAction}>
                <input type="hidden" name="gameId" value={game.id} />
                <SubmitButton pending="…" className="ticket-button">Il est revenu</SubmitButton>
              </form>
            </div>
          ) : (
            <>
              <div className="section-head">
                <h2>Prêt</h2>
              </div>
              <form action={lendGameAction} className="inline-form single">
                <input type="hidden" name="gameId" value={game.id} />
                <input name="borrower" placeholder="Prêter à…" aria-label="Prêter à" required />
                <SubmitButton pending="…" className="secondary">Prêter</SubmitButton>
              </form>
            </>
          )}
        </section>
      ) : null}

      {/* Parties */}
      {game.status === "owned" ? (
        <section id="parties">
          <details className="play-form">
            <summary className="section-head">
              <h2>
                Parties{game.playCount > 0 ? ` · ${game.playCount}` : ""}
              </h2>
              <span className="pill-button small">+ Partie</span>
            </summary>
            <form action={addPlayAction} className="panel form">
              <input type="hidden" name="gameId" value={game.id} />
              <div className="row">
                <label className="grow">
                  Date
                  <input type="date" name="playedOn" defaultValue={today} required />
                </label>
                <label className="narrow">
                  Joueurs
                  <input name="players" inputMode="numeric" pattern="[0-9]*" placeholder="4" />
                </label>
              </div>
              <label>
                Gagnant
                <input name="winner" placeholder="Facultatif" />
              </label>
              {owned.length > 0 ? (
                <fieldset className="check-group">
                  <legend>Avec les extensions</legend>
                  {owned.map((e) => (
                    <label key={e.id} className="check-row">
                      <input type="checkbox" name="expansions" value={e.id} />
                      <span>{e.title}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <label>
                Note
                <input name="notes" placeholder="Facultatif" />
              </label>
              {erreur === "date" ? <p className="error">La date est obligatoire.</p> : null}
              <SubmitButton pending="Enregistrement…">Enregistrer la partie</SubmitButton>
            </form>
          </details>

          {game.plays.length > 0 ? (
            <ul className="panel list-card play-list">
              {game.plays.map((p) => {
                const used = p.expansions.map((x) => expansionNames.get(x)).filter(Boolean);
                const line = [
                  p.players ? `${p.players} joueur${p.players > 1 ? "s" : ""}` : null,
                  used.length ? `avec ${used.join(", ")}` : null,
                ].filter(Boolean).join(" · ");
                return (
                  <li key={p.id}>
                    <strong className="play-date">{shortDate(p.playedOn)}</strong>
                    <div className="play-text">
                      <span>{line || "Partie"}</span>
                      {p.winner ? (
                        <small className="winner">
                          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                            <path d="M4 17h16l1-10-5 4-4-6-4 6-5-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                          {p.winner}
                        </small>
                      ) : null}
                      {p.notes ? <small>{p.notes}</small> : null}
                    </div>
                    <form action={deletePlayAction}>
                      <input type="hidden" name="gameId" value={game.id} />
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="icon-button" aria-label={`Supprimer la partie du ${shortDate(p.playedOn)}`} title="Supprimer">
                        ×
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hint">Aucune partie enregistrée.</p>
          )}
        </section>
      ) : null}

      <details className="panel settings">
        <summary>Modifier le jeu</summary>
        <form action={updateGameAction} className="form">
          <input type="hidden" name="id" value={game.id} />
          <GameFields game={game} />
          {erreur === "titre" ? <p className="error">Le titre est obligatoire.</p> : null}
          <SubmitButton pending="Enregistrement…">Enregistrer</SubmitButton>
        </form>

        {game.expansions.length > 0 ? (
          <div className="form">
            <p className="hint">Retirer une extension enregistrée par erreur :</p>
            <ul className="plain-list">
              {game.expansions.map((e) => (
                <li key={e.id} className="remove-row">
                  <span>{e.title}</span>
                  <form action={deleteExpansionAction}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="link-button">Retirer</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form action={deleteGameAction} className="form danger-zone">
          <input type="hidden" name="id" value={game.id} />
          <label className="check-row">
            <input type="checkbox" name="confirm" required />
            <span>Je veux retirer ce jeu, ses extensions, ses prêts et ses parties</span>
          </label>
          {erreur === "confirmation" ? <p className="error">Coche la case pour confirmer.</p> : null}
          <button type="submit" className="danger">Retirer de ma collection</button>
        </form>
      </details>
    </main>
  );
}
