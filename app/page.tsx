import Link from "next/link";

import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import { formatGaps } from "@/lib/format";
import {
  coverKey,
  coversFor,
  listSeries,
  progressOf,
} from "@/lib/series";

import { Cover } from "./cover";
import { DatabaseErrorScreen, SetupScreen } from "./db-screens";
import { Masthead } from "./masthead";
import { migrateAction } from "./compte/actions";

export const dynamic = "force-dynamic";

/**
 * Accueil : une carte par série, avec la couverture du prochain tome à
 * acheter — c'est elle qu'on cherche des yeux en rayon.
 */
export default async function HomePage() {
  const missing = [
    !isDatabaseConfigured() && "DATABASE_URL",
    !process.env.APP_PASSWORD && "APP_PASSWORD",
    !process.env.AUTH_SECRET && "AUTH_SECRET",
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    return <SetupScreen title="Ma bibliothèque" missing={missing} />;
  }

  let ready: boolean;
  try {
    ready = await isSchemaReady();
  } catch (error) {
    return (
      <DatabaseErrorScreen
        title="Ma bibliothèque"
        message={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  if (!ready) {
    return (
      <main className="page narrow">
        <Masthead />
        <h1 className="page-title">Ma bibliothèque</h1>
        <div className="panel">
          <h2>Base à initialiser</h2>
          <p className="hint">
            La base répond mais il lui manque des tables. Un clic les crée ;
            rien n&apos;est à faire à la main, et rien n&apos;est effacé.
          </p>
          <form action={migrateAction} className="form">
            <button type="submit">Initialiser la base</button>
          </form>
        </div>
      </main>
    );
  }

  const series = await listSeries();
  const rows = series.map((item) => {
    const progress = progressOf(item);
    // Série à jour : on montre le dernier tome, sinon celui à acheter.
    const shown = progress.next ?? Math.max(progress.highest, 1);
    return { item, progress, shown };
  });
  const covers = await coversFor(
    rows.map(({ item, shown }) => ({ seriesId: item.id, number: shown })),
  );

  // Ce qui reste à acheter d'abord, les séries à jour ensuite.
  rows.sort(
    (a, b) =>
      Number(a.progress.next === null && a.progress.gaps.length === 0) -
      Number(b.progress.next === null && b.progress.gaps.length === 0),
  );

  const volumes = rows.reduce((sum, row) => sum + row.progress.ownedCount, 0);

  return (
    <main className="page narrow">
      <Masthead />

      <div className="title-row">
        <div>
          <h1 className="page-title">Ma bibliothèque</h1>
          <p className="subtitle">
            {series.length} série{series.length > 1 ? "s" : ""} · {volumes} tome
            {volumes > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/series/nouvelle" className="pill-button">
          + Série
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <h2>Aucune série pour l&apos;instant</h2>
          <p className="hint">
            Ajoute ta première série : cherche-la par son titre, indique
            jusqu&apos;où tu l&apos;as, et le reste se remplit tout seul.
          </p>
        </div>
      ) : (
        <>
          <p className="section-label">À acheter ensuite</p>
          <ul className="series-list">
            {rows.map(({ item, progress, shown }) => (
              <li key={item.id}>
                <Link href={`/series/${item.id}`} className="series-card">
                  <Cover url={covers.get(coverKey(item.id, shown))} number={shown} />
                  <div className="series-card-body">
                    <div className="series-card-head">
                      <span className="series-name">{item.title}</span>
                      <span className="series-count">
                        {progress.ownedCount}
                        {progress.total !== null ? `/${progress.total}` : ""}
                      </span>
                    </div>
                    {progress.next !== null ? (
                      <span className="series-next">Prochain : tome {progress.next}</span>
                    ) : progress.gaps.length === 0 ? (
                      <span className="series-done">Série complète</span>
                    ) : (
                      <span className="series-done">À jour</span>
                    )}
                    {progress.total !== null ? (
                      <div className="bar" aria-hidden="true">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round((progress.ownedCount / progress.total) * 100))}%`,
                          }}
                        />
                      </div>
                    ) : null}
                    {progress.gaps.length > 0 ? (
                      <span className="series-gaps">Trous : {formatGaps(progress.gaps)}</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
