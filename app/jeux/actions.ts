"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { bggThing, isBggConfigured } from "@/lib/bgg";
import {
  addExpansion,
  addPlay,
  createGame,
  deleteExpansion,
  deleteGame,
  deletePlay,
  lendGame,
  returnGame,
  setExpansionStatus,
  setGamesView,
  setGameStatus,
  updateGame,
  type GameInput,
  type ItemStatus,
} from "@/lib/games";

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

function positiveInt(form: FormData, name: string): number | null {
  const value = text(form, name);
  if (value === null || !/^\d{1,4}$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null;
}

function status(form: FormData, name = "status"): ItemStatus {
  return form.get(name) === "wanted" ? "wanted" : "owned";
}

/** Une date `AAAA-MM-JJ` valide, ou `null`. */
function isoDate(form: FormData, name: string): string | null {
  const value = text(form, name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** Le champ finit dans le `src` d'une balise `img` : http et https seulement. */
function imageUrl(form: FormData): string | null {
  const value = text(form, "imageUrl");
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Min et max dans le bon ordre, quel que soit celui de la saisie. */
function range(min: number | null, max: number | null): [number | null, number | null] {
  if (min !== null && max !== null && min > max) return [max, min];
  return [min, max ?? min];
}

function gameFields(form: FormData): Omit<GameInput, "bggId" | "title"> {
  const [minPlayers, maxPlayers] = range(positiveInt(form, "minPlayers"), positiveInt(form, "maxPlayers"));
  const [minMinutes, maxMinutes] = range(positiveInt(form, "minMinutes"), positiveInt(form, "maxMinutes"));
  return {
    status: status(form),
    designer: text(form, "designer"),
    publisher: text(form, "publisher"),
    year: positiveInt(form, "year"),
    minPlayers,
    maxPlayers,
    minMinutes,
    maxMinutes,
    minAge: positiveInt(form, "minAge"),
    imageUrl: imageUrl(form),
  };
}

function refresh(gameId?: string) {
  revalidatePath("/jeux");
  if (gameId) revalidatePath(`/jeux/${gameId}`);
}

export async function createGameAction(form: FormData): Promise<void> {
  await requireSession("/jeux/nouveau");

  const title = text(form, "title");
  if (!title) redirect("/jeux/nouveau?manuel=1&erreur=titre");

  const bggId = text(form, "bggId");
  const fields = gameFields(form);

  // Choisi dans la recherche : la fiche BGG complète ce qui n'a pas été saisi.
  if (bggId && isBggConfigured()) {
    try {
      const thing = await bggThing(bggId);
      if (thing) {
        fields.designer ??= thing.designer;
        fields.publisher ??= thing.publisher;
        fields.year ??= thing.year;
        fields.minPlayers ??= thing.minPlayers;
        fields.maxPlayers ??= thing.maxPlayers;
        fields.minMinutes ??= thing.minMinutes;
        fields.maxMinutes ??= thing.maxMinutes;
        fields.minAge ??= thing.minAge;
        fields.imageUrl ??= thing.imageUrl;
      }
    } catch (error) {
      console.warn("[jeux] fiche BGG indisponible", error);
    }
  }

  const { id, created } = await createGame({ ...fields, title, bggId });
  refresh();
  redirect(`/jeux/${id}${created ? "" : "?existe=1"}`);
}

export async function updateGameAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/jeux/${id}`);
  const title = text(form, "title");
  if (!title) redirect(`/jeux/${id}?erreur=titre`);
  await updateGame(id, { ...gameFields(form), title });
  refresh(id);
  redirect(`/jeux/${id}?enregistre=1`);
}

export async function setGameStatusAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/jeux/${id}`);
  await setGameStatus(id, status(form));
  refresh(id);
  redirect(`/jeux/${id}`);
}

export async function deleteGameAction(form: FormData): Promise<void> {
  const id = text(form, "id") ?? "";
  await requireSession(`/jeux/${id}`);
  // Une case à cocher plutôt qu'une boîte de dialogue : rien ne part sur un
  // toucher malheureux.
  if (form.get("confirm") !== "on") redirect(`/jeux/${id}?erreur=confirmation`);
  await deleteGame(id);
  refresh();
  redirect("/jeux");
}

export async function addExpansionAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const title = text(form, "title");
  if (title) await addExpansion(gameId, title, status(form));
  refresh(gameId);
  redirect(`/jeux/${gameId}#extensions`);
}

export async function toggleExpansionAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const id = text(form, "id");
  if (id) await setExpansionStatus(id, status(form));
  refresh(gameId);
  redirect(`/jeux/${gameId}#extensions`);
}

export async function deleteExpansionAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const id = text(form, "id");
  if (id) await deleteExpansion(id);
  refresh(gameId);
  redirect(`/jeux/${gameId}#extensions`);
}

export async function lendGameAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const borrower = text(form, "borrower");
  if (borrower) await lendGame(gameId, borrower, isoDate(form, "lentOn"));
  refresh(gameId);
  redirect(`/jeux/${gameId}#pret`);
}

export async function returnGameAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  await returnGame(gameId);
  refresh(gameId);
  redirect(`/jeux/${gameId}#pret`);
}

export async function addPlayAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const playedOn = isoDate(form, "playedOn");
  if (!playedOn) redirect(`/jeux/${gameId}?erreur=date#parties`);
  await addPlay(gameId, {
    playedOn,
    players: positiveInt(form, "players"),
    winner: text(form, "winner"),
    expansions: form
      .getAll("expansions")
      .filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)),
    notes: text(form, "notes"),
  });
  refresh(gameId);
  redirect(`/jeux/${gameId}#parties`);
}

export async function deletePlayAction(form: FormData): Promise<void> {
  const gameId = text(form, "gameId") ?? "";
  await requireSession(`/jeux/${gameId}`);
  const id = text(form, "id");
  if (id) await deletePlay(id);
  refresh(gameId);
  redirect(`/jeux/${gameId}#parties`);
}

export async function setGamesViewAction(form: FormData): Promise<void> {
  await requireSession("/jeux");
  await setGamesView(form.get("view") === "liste" ? "liste" : "cartes");
  const back = text(form, "back");
  // Retour sur la même liste filtrée, et seulement vers un chemin interne.
  redirect(back && /^\/jeux(\?[^\s]*)?$/.test(back) ? back : "/jeux");
}
