"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { refreshSeries } from "@/lib/refresh";
import {
  createSeries,
  deleteSeries,
  getSeries,
  setOwned,
  updateSeries,
} from "@/lib/series";

/**
 * Le proxy ferme déjà l'application, mais une action serveur s'appelle
 * directement par POST : chacune vérifie la session elle-même.
 */
async function requireSession(next: string): Promise<void> {
  if (!(await isAuthenticated())) redirect(`/login?next=${encodeURIComponent(next)}`);
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

/** Entier strictement positif, ou `null` si le champ est vide ou inexploitable. */
function positiveInt(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null || !/^\d{1,4}$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null;
}

export async function createSeriesAction(form: FormData): Promise<void> {
  await requireSession("/series/nouvelle");

  const title = text(form, "title");
  if (!title) redirect("/series/nouvelle?manuel=1&erreur=titre");

  const { series, created } = await createSeries(
    {
      title,
      author: text(form, "author"),
      publisher: text(form, "publisher"),
      mangadexId: text(form, "mangadexId"),
    },
    positiveInt(form, "ownedUpTo") ?? 0,
  );

  // Déjà là (double envoi, ou série ajoutée plus tôt) : on l'ouvre, sans
  // rien y toucher.
  if (!created) redirect(`/series/${series.id}?existe=1`);

  // Attendu, pas lancé en tâche de fond : la série doit s'ouvrir avec son
  // nombre de tomes et ses couvertures. Un échec n'empêche pas la création.
  try {
    await refreshSeries(series);
  } catch (error) {
    console.warn("[series] première recherche impossible", error);
  }

  revalidatePath("/");
  redirect(`/series/${series.id}`);
}

export async function toggleVolumeAction(
  seriesId: string,
  number: number,
  owned: boolean,
): Promise<void> {
  await requireSession(`/series/${seriesId}`);
  if (!Number.isInteger(number) || number <= 0 || number > 9999) return;

  await setOwned(seriesId, number, owned);
  revalidatePath("/");
  revalidatePath(`/series/${seriesId}`);
}

export async function updateSeriesAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/series/${id}`);

  const series = await getSeries(id);
  if (!series) redirect("/");

  const title = text(form, "title") ?? series.title;
  const publisher = text(form, "publisher");
  await updateSeries(id, {
    title,
    publisher,
    volumesManual: positiveInt(form, "volumesManual"),
  });

  // Titre ou éditeur changés : la recherche Google Books n'est plus la même.
  if (title !== series.title || publisher !== series.publisher) {
    try {
      await refreshSeries({ ...series, title, publisher });
    } catch (error) {
      console.warn("[series] actualisation impossible", error);
    }
  }

  revalidatePath("/");
  redirect(`/series/${id}?enregistre=1`);
}

export async function refreshSeriesAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/series/${id}`);

  const series = await getSeries(id);
  if (!series) redirect("/");

  let ok = false;
  try {
    const report = await refreshSeries(series);
    ok = report.failures.length === 0;
  } catch (error) {
    console.warn("[series] actualisation impossible", error);
  }

  revalidatePath("/");
  redirect(`/series/${id}?actualise=${ok ? "ok" : "partiel"}`);
}

export async function deleteSeriesAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/series/${id}`);

  // Une case à cocher plutôt qu'une boîte de dialogue : rien ne part sur un
  // simple toucher malheureux.
  if (form.get("confirm") !== "on") redirect(`/series/${id}?erreur=confirmation`);

  await deleteSeries(id);
  revalidatePath("/");
  redirect("/");
}
