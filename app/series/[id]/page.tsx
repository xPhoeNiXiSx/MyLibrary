import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { PUBLISHERS } from "@/lib/publishers";
import { isStale, refreshSeries } from "@/lib/refresh";
import { allCovers, getSeries, gridSize, progressOf } from "@/lib/series";

import { Cover } from "../../cover";
import { Masthead } from "../../masthead";
import { SubmitButton } from "../../submit-button";
import {
  deleteSeriesAction,
  refreshSeriesAction,
  updateSeriesAction,
} from "../actions";
import { VolumeGrid } from "./volume-grid";

export const dynamic = "force-dynamic";

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    enregistre?: string;
    actualise?: string;
    erreur?: string;
    existe?: string;
  }>;
}) {
  const { id } = await params;
  const { enregistre, actualise, erreur, existe } = await searchParams;

  const series = await getSeries(id);
  if (!series) notFound();

  // Le nombre de tomes parus bouge : on le redemande de temps en temps, après
  // la réponse, pour ne pas faire attendre l'affichage. La visite suivante
  // montre le résultat.
  if (isStale(series)) {
    after(async () => {
      try {
        await refreshSeries(series);
      } catch (error) {
        console.warn("[series] actualisation de fond impossible", error);
      }
    });
  }

  const progress = progressOf(series);
  const covers = await allCovers(series.id);
  const headerCover = Math.max(progress.highest, 1);

  const meta = [
    series.author,
    series.publisher,
  ].filter(Boolean).join(" · ");
  const state = [
    series.status === "finished" ? "Terminée" : series.status === "ongoing" ? "En cours" : null,
    progress.total !== null
      ? `${progress.total} tome${progress.total > 1 ? "s" : ""} parus`
      : "Nombre de tomes inconnu",
  ].filter(Boolean).join(" · ");

  return (
    <main className="page narrow">
      <Masthead />
      <Link href="/" className="back-link">‹ Mes séries</Link>

      <div className="series-header">
        <Cover
          url={covers.get(headerCover) ?? covers.get(1)}
          number={headerCover}
          className="cover large"
        />
        <div>
          <h1 className="page-title">{series.title}</h1>
          {meta ? <p className="subtitle">{meta}</p> : null}
          <p className="subtitle">
            {state}
            {series.volumesManual !== null ? " (corrigé à la main)" : ""}
          </p>
        </div>
      </div>

      {existe ? (
        <p className="success" role="status">
          Cette série était déjà dans ta bibliothèque : la voici.
        </p>
      ) : null}
      {enregistre ? <p className="success" role="status">Modifications enregistrées.</p> : null}
      {actualise === "ok" ? (
        <p className="success" role="status">Infos actualisées depuis les sources.</p>
      ) : null}
      {actualise === "partiel" ? (
        <p className="error" role="status">
          Une source n&apos;a pas répondu : ce qui a pu être lu est enregistré.
        </p>
      ) : null}

      <VolumeGrid
        seriesId={series.id}
        owned={series.owned}
        size={gridSize(progress)}
        total={progress.total}
      />

      <details className="panel settings">
        <summary>Modifier la série</summary>
        <form action={updateSeriesAction} className="form">
          <input type="hidden" name="id" value={series.id} />
          <label>
            Titre
            <input name="title" defaultValue={series.title} required />
          </label>
          <label>
            Éditeur français
            <input
              name="publisher"
              defaultValue={series.publisher ?? ""}
              list="publishers"
              placeholder="Glénat, Kana, Pika…"
            />
            <small>Sert à retrouver les couvertures et les tomes de l&apos;édition française.</small>
          </label>
          <label>
            Tomes parus
            <input
              name="volumesManual"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={series.volumesManual ?? ""}
              placeholder={
                series.volumesAuto !== null ? `${series.volumesAuto} d'après les sources` : "Inconnu"
              }
            />
            <small>
              À remplir seulement si le nombre trouvé automatiquement est faux.
              Vide, c&apos;est le nombre des sources qui s&apos;applique.
            </small>
          </label>
          <SubmitButton pending="Enregistrement…">Enregistrer</SubmitButton>
        </form>

        <form action={refreshSeriesAction} className="form">
          <input type="hidden" name="id" value={series.id} />
          <p className="hint">
            Nombre de tomes et couvertures sont revus chaque semaine. Pour
            forcer la mise à jour :
          </p>
          <SubmitButton className="secondary" pending="Actualisation…">
            Actualiser maintenant
          </SubmitButton>
        </form>

        <form action={deleteSeriesAction} className="form danger-zone">
          <input type="hidden" name="id" value={series.id} />
          <label className="check-row">
            <input type="checkbox" name="confirm" required />
            <span>Je veux supprimer cette série et ses tomes cochés</span>
          </label>
          {erreur === "confirmation" ? (
            <p className="error">Coche la case pour confirmer.</p>
          ) : null}
          <button type="submit" className="danger">Supprimer la série</button>
        </form>
      </details>

      <datalist id="publishers">
        {PUBLISHERS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </main>
  );
}
