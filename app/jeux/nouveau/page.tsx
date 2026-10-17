import Link from "next/link";

import { bggThing, isBggConfigured, searchBgg, type BggThing } from "@/lib/bgg";
import { playersLabel } from "@/lib/format";

import { Masthead } from "../../masthead";
import { SubmitButton } from "../../submit-button";
import { createGameAction } from "../actions";
import { GameFields } from "../game-fields";

export const dynamic = "force-dynamic";

/**
 * Ajout d'un jeu : recherche BoardGameGeek quand le jeton est configuré, puis
 * confirmation des champs pré-remplis. Sans jeton, ou si le jeu n'est pas
 * trouvé, saisie à la main.
 */
export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bgg?: string; manuel?: string; envie?: string; erreur?: string }>;
}) {
  const { q, bgg, manuel, envie, erreur } = await searchParams;
  const query = q?.trim() ?? "";
  const configured = isBggConfigured();

  let picked: BggThing | null = null;
  let results: BggThing[] = [];
  let searchError: string | null = null;

  if (configured && bgg) {
    try {
      picked = await bggThing(bgg);
    } catch (error) {
      searchError = error instanceof Error ? error.message : String(error);
    }
  } else if (configured && query && !manuel) {
    try {
      results = await searchBgg(query);
    } catch (error) {
      searchError = error instanceof Error ? error.message : String(error);
    }
  }

  const showForm = Boolean(picked || manuel || !configured);

  return (
    <main className="page narrow">
      <Masthead />
      <Link href="/jeux" className="back-link">‹ Mes jeux</Link>
      <h1 className="page-title">Ajouter un jeu</h1>

      {!configured ? (
        <p className="hint">
          Recherche BoardGameGeek indisponible : la variable <code>BGG_API_TOKEN</code>{" "}
          n&apos;est pas définie. Le jeu se saisit à la main en attendant.
        </p>
      ) : null}

      {showForm ? (
        <form action={createGameAction} className="panel form">
          <input type="hidden" name="bggId" value={picked?.id ?? ""} />
          <GameFields
            game={
              picked
                ? { ...picked, status: envie ? "wanted" : "owned", imageUrl: picked.imageUrl }
                : { title: query, status: envie ? "wanted" : "owned" }
            }
          />
          {picked && picked.expansions.length > 0 ? (
            <p className="hint">
              BoardGameGeek connaît {picked.expansions.length} extension
              {picked.expansions.length > 1 ? "s" : ""} : tu les ajoutes depuis la fiche du jeu.
            </p>
          ) : null}
          {erreur === "titre" ? <p className="error">Le titre est obligatoire.</p> : null}
          <SubmitButton pending="Ajout en cours…">Ajouter le jeu</SubmitButton>
        </form>
      ) : (
        <>
          <form className="panel form" action="/jeux/nouveau">
            <label>
              Nom du jeu
              <input name="q" type="search" defaultValue={query} placeholder="Catan, Azul…" autoFocus required />
            </label>
            {envie ? <input type="hidden" name="envie" value="1" /> : null}
            <SubmitButton pending="Recherche…">Chercher</SubmitButton>
          </form>

          {searchError ? (
            <p className="error">La recherche n&apos;a pas abouti ({searchError}). Tu peux saisir le jeu à la main.</p>
          ) : null}
          {query && !searchError && results.length === 0 ? (
            <p className="hint">Aucun résultat pour « {query} ».</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="search-results">
              {results.map((r) => {
                const params = new URLSearchParams({ q: query, bgg: r.id });
                if (envie) params.set("envie", "1");
                return (
                  <li key={r.id}>
                    <Link href={`/jeux/nouveau?${params}`} className="search-result">
                      {r.thumbnailUrl ? (
                        <img src={r.thumbnailUrl} alt="" className="game-cover small" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="game-cover small game-cover-empty" aria-hidden="true" />
                      )}
                      <div>
                        <span className="series-name">{r.title}</span>
                        <span className="subtitle">
                          {[r.year, playersLabel(r.minPlayers, r.maxPlayers, true), r.publisher].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {query ? (
            <p className="hint">
              Pas dans la liste ?{" "}
              <Link href={`/jeux/nouveau?${new URLSearchParams({ q: query, manuel: "1", ...(envie ? { envie: "1" } : {}) })}`}>
                Saisir le jeu à la main
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
