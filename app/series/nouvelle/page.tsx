import Link from "next/link";

import { PUBLISHERS } from "@/lib/publishers";
import { searchManga, type MangaMatch } from "@/lib/sources";

import { Masthead } from "../../masthead";
import { createSeriesAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Ajout d'une série, en deux temps : chercher le titre (MangaDex), puis
 * confirmer éditeur et tomes déjà possédés. Tout passe par l'URL, rendue côté
 * serveur : pas de script, et le bouton retour ramène aux résultats.
 */
export default async function NewSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    id?: string;
    titre?: string;
    auteur?: string;
    manuel?: string;
    erreur?: string;
  }>;
}) {
  const { q, id, titre, auteur, manuel, erreur } = await searchParams;
  const query = q?.trim() ?? "";
  const choosing = Boolean(id || manuel);

  let results: MangaMatch[] = [];
  let searchError: string | null = null;
  if (query && !choosing) {
    try {
      results = await searchManga(query);
    } catch (error) {
      searchError = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <main className="page narrow">
      <Masthead />
      <Link href="/" className="back-link">‹ Mes séries</Link>
      <h1 className="page-title">Ajouter une série</h1>

      {choosing ? (
        <form action={createSeriesAction} className="panel form">
          <input type="hidden" name="mangadexId" value={id ?? ""} />
          <input type="hidden" name="author" value={auteur ?? ""} />
          <label>
            Titre
            <input name="title" defaultValue={titre ?? query} required autoFocus={!titre} />
          </label>
          {auteur ? <p className="hint">{auteur}</p> : null}
          <label>
            Éditeur français
            <input name="publisher" list="publishers" placeholder="Glénat, Kana, Pika…" />
            <small>Sert à retrouver les couvertures et le nombre de tomes parus en France.</small>
          </label>
          <label>
            J&apos;ai déjà les tomes 1 à…
            <input name="ownedUpTo" inputMode="numeric" pattern="[0-9]*" placeholder="0" />
            <small>Les trous éventuels se décochent ensuite, tome par tome.</small>
          </label>
          {erreur === "titre" ? <p className="error">Le titre est obligatoire.</p> : null}
          <button type="submit">Ajouter la série</button>
          <datalist id="publishers">
            {PUBLISHERS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </form>
      ) : (
        <>
          <form className="panel form" action="/series/nouvelle">
            <label>
              Titre de la série
              <input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="One Piece, Blue Lock…"
                autoFocus
                required
              />
            </label>
            <button type="submit">Chercher</button>
          </form>

          {searchError ? (
            <p className="error">
              La recherche n&apos;a pas abouti ({searchError}). Tu peux saisir la
              série à la main.
            </p>
          ) : null}

          {query && !searchError && results.length === 0 ? (
            <p className="hint">Aucun résultat pour « {query} ».</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="search-results">
              {results.map((result) => {
                const params = new URLSearchParams({ q: query, id: result.id, titre: result.title });
                if (result.author) params.set("auteur", result.author);
                return (
                  <li key={result.id}>
                    <Link href={`/series/nouvelle?${params}`} className="search-result">
                      {result.coverUrl ? (
                        <img
                          src={result.coverUrl}
                          alt=""
                          className="cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="cover cover-empty" aria-hidden="true" />
                      )}
                      <div>
                        <span className="series-name">{result.title}</span>
                        <span className="subtitle">
                          {[result.author, result.year, result.status === "finished" ? "terminée" : result.status === "ongoing" ? "en cours" : null]
                            .filter(Boolean)
                            .join(" · ")}
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
              <Link href={`/series/nouvelle?${new URLSearchParams({ q: query, manuel: "1" })}`}>
                Saisir la série à la main
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
