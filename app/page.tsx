import Link from "next/link";

import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import { formatGaps } from "@/lib/format";
import {
  coverKey,
  coversFor,
  listSeries,
  progressOf,
  type Progress,
  type Series,
} from "@/lib/series";

import { Cover } from "./cover";
import { DatabaseErrorScreen, SetupScreen } from "./db-screens";
import { Masthead } from "./masthead";
import { ProgressBar } from "./progress-bar";
import { migrateAction } from "./compte/actions";

export const dynamic = "force-dynamic";

/**
 * Accueil des mangas : une carte forte pour le prochain achat — c'est la
 * couverture qu'on cherche des yeux en rayon — puis les séries en cours et
 * les séries complètes, en lignes identiques.
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

  // La carte principale : la première série dont un tome reste à acheter.
  const hero = rows.find((row) => row.progress.next !== null) ?? null;
  const ongoing = rows.filter((row) => row !== hero && (row.progress.next !== null || row.progress.gaps.length > 0));
  const done = rows.filter((row) => row !== hero && !ongoing.includes(row));
  const volumes = rows.reduce((sum, row) => sum + row.progress.ownedCount, 0);

  return (
    <main className="page narrow">
      <Masthead />

      <div className="title-row">
        <div>
          <h1 className="page-title">Mes séries</h1>
          <p className="subtitle">
            {series.length} série{series.length > 1 ? "s" : ""} · {volumes} tome
            {volumes > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/series/nouvelle" className="pill-button">+ Série</Link>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <h2>Aucune série pour l&apos;instant</h2>
          <p className="hint">
            Ajoute ta première série : cherche-la par son titre, indique
            jusqu&apos;où tu l&apos;as, et le reste se remplit tout seul.
          </p>
        </div>
      ) : null}

      {hero ? (
        <Link href={`/series/${hero.item.id}`} className="hero-card">
          <Cover
            url={covers.get(coverKey(hero.item.id, hero.shown))}
            number={hero.shown}
            title={hero.item.title}
            className="cover hero-cover"
          />
          <div className="hero-body">
            <span className="badge">Prochain achat</span>
            <span className="hero-title">{hero.item.title}</span>
            <span className="hero-volume">
              Tome <em>{hero.progress.next}</em>
            </span>
            <ProgressBar owned={hero.progress.ownedCount} total={hero.progress.total} gaps={hero.progress.gaps} />
            <span className="series-count">
              {hero.progress.ownedCount}
              {hero.progress.total !== null ? ` / ${hero.progress.total}` : ""}
              {hero.progress.gaps.length > 0
                ? ` · ${hero.progress.gaps.length} trou${hero.progress.gaps.length > 1 ? "s" : ""}`
                : ""}
            </span>
          </div>
        </Link>
      ) : null}

      {ongoing.length > 0 ? (
        <SeriesSection title="En cours" rows={ongoing} covers={covers} />
      ) : null}
      {done.length > 0 ? <SeriesSection title="Complètes" rows={done} covers={covers} /> : null}
    </main>
  );
}

type Row = { item: Series; progress: Progress; shown: number };

function SeriesSection({
  title,
  rows,
  covers,
}: {
  title: string;
  rows: Row[];
  covers: Map<string, string | null>;
}) {
  return (
    <section>
      <div className="section-head">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      <ul className="series-list">
        {rows.map(({ item, progress, shown }) => (
          <li key={item.id}>
            <Link href={`/series/${item.id}`} className="series-card">
              <Cover url={covers.get(coverKey(item.id, shown))} number={shown} title={item.title} />
              <div className="series-card-body">
                <div className="series-card-head">
                  <span className="series-name">{item.title}</span>
                  <span className="series-count">
                    {progress.ownedCount}
                    {progress.total !== null ? `/${progress.total}` : ""}
                  </span>
                </div>
                <ProgressBar owned={progress.ownedCount} total={progress.total} gaps={progress.gaps} />
                <span className="series-line">
                  {progress.next !== null ? (
                    <span className="series-next">Prochain : T{progress.next}</span>
                  ) : progress.gaps.length === 0 ? (
                    <span className="series-done">
                      {progress.total ?? progress.ownedCount} / {progress.total ?? progress.ownedCount} · série complète
                    </span>
                  ) : (
                    <span className="series-done">À jour</span>
                  )}
                  {progress.gaps.length > 0 ? (
                    <span className="series-gaps">
                      {" · "}
                      {progress.gaps.length > 1 ? "Trous" : "Trou"} : {formatGaps(progress.gaps, 3)}
                    </span>
                  ) : null}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
