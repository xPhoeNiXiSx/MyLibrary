/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import {
  isSchemaReady,
  lastMigrationRun,
  query,
  runMigrations,
  setQueryRunner,
} from "../lib/db";
import { formatGaps } from "../lib/format";
import { SCHEMA_STATEMENTS } from "../lib/schema";
import { formatCents, parseEuros, percentChange } from "../lib/money";
import { isStale, refreshSeries } from "../lib/refresh";
import {
  allCovers,
  coverKey,
  coversFor,
  createSeries,
  deleteSeries,
  getSeries,
  gridSize,
  listSeries,
  progressOf,
  saveCovers,
  saveSourceInfo,
  setOwned,
  updateSeries,
} from "../lib/series";
import {
  normalizeTitle,
  readDexCovers,
  readDexManga,
  readGoogleItems,
  volumeNumberOf,
} from "../lib/sources";
import {
  MAX_FAILURES,
  clearFailures,
  lockedMinutes,
  recordFailure,
} from "../lib/throttle";
import { newToken, safeEquals, signPayload, verifyToken } from "../lib/session";

const checks: string[] = [];

function ok(label: string) {
  checks.push(label);
}

async function main() {
  const pg = new PGlite();
  setQueryRunner(async (text, params = []) => {
    const result = await pg.query(text, params as unknown[]);
    return result.rows as never[];
  });

  // --- Schéma -----------------------------------------------------------

  assert.equal(await isSchemaReady(), false);
  ok("une base vide est détectée comme non initialisée");

  // Une base initialisée avant le dernier ajout au schéma doit le voir.
  for (const statement of SCHEMA_STATEMENTS.slice(0, -1)) await query(statement);
  assert.equal(await isSchemaReady(), false);
  ok("une base en retard d'une évolution est détectée comme à mettre à jour");

  await runMigrations();
  assert.equal(await isSchemaReady(), true);
  ok("le schéma s'applique depuis l'application");

  // Rejouer le schéma ne doit rien casser : le bouton reste cliquable.
  await runMigrations();
  ok("le schéma est idempotent");

  const passage = await lastMigrationRun();
  assert.ok(passage instanceof Date);
  assert.ok(Date.now() - passage.getTime() < 60_000);
  ok("la date du dernier passage est enregistrée à chaque application");

  // --- Séries et tomes ---------------------------------------------------

  const { series: onePiece } = await createSeries(
    { title: "One Piece", author: null, publisher: "Glénat", mangadexId: null },
    86,
  );
  assert.equal(onePiece.owned.length, 86);
  assert.deepEqual(onePiece.owned.slice(0, 3), [1, 2, 3]);
  ok("une série se crée avec ses tomes 1 à N cochés");

  await setOwned(onePiece.id, 12, false);
  await setOwned(onePiece.id, 51, false);
  await setOwned(onePiece.id, 51, false);
  let op = (await getSeries(onePiece.id))!;
  let progress = progressOf(op);
  assert.equal(progress.ownedCount, 84);
  assert.equal(progress.highest, 86);
  assert.deepEqual(progress.gaps, [12, 51]);
  assert.equal(progress.total, null);
  assert.equal(progress.next, 87);
  ok("trous et prochain tome se déduisent des tomes cochés");

  await setOwned(onePiece.id, 12, true);
  await setOwned(onePiece.id, 12, true);
  op = (await getSeries(onePiece.id))!;
  assert.deepEqual(progressOf(op).gaps, [51]);
  ok("cocher deux fois le même tome est sans effet");

  await saveSourceInfo(onePiece.id, { volumes: 108, status: "ongoing", author: "Eiichirō Oda" });
  await saveSourceInfo(onePiece.id, { volumes: null, status: null, author: "Autre" });
  op = (await getSeries(onePiece.id))!;
  assert.equal(op.volumesAuto, 108);
  assert.equal(op.status, "ongoing");
  assert.equal(op.author, "Eiichirō Oda");
  assert.ok(op.volumesCheckedAt instanceof Date);
  assert.equal(progressOf(op).total, 108);
  assert.equal(gridSize(progressOf(op)), 108);
  ok("une source muette n'efface pas ce qu'une autre avait trouvé");

  await updateSeries(onePiece.id, { title: "One Piece", publisher: "Glénat", volumesManual: 86 });
  op = (await getSeries(onePiece.id))!;
  progress = progressOf(op);
  assert.equal(progress.total, 86);
  assert.equal(progress.next, null);
  assert.equal(progress.complete, false);
  ok("la correction manuelle du nombre de tomes fait autorité");

  await setOwned(onePiece.id, 51, true);
  assert.equal(progressOf((await getSeries(onePiece.id))!).complete, true);
  ok("tous les tomes parus cochés : la série est complète");

  await updateSeries(onePiece.id, { title: "One Piece", publisher: "Glénat", volumesManual: null });
  assert.equal(progressOf((await getSeries(onePiece.id))!).next, 87);
  ok("vider la correction rend la main aux sources");

  const { series: blueLock } = await createSeries(
    { title: "Blue Lock", author: null, publisher: null, mangadexId: null },
    0,
  );
  assert.equal(progressOf(blueLock).next, 1);
  assert.equal(gridSize(progressOf(blueLock)), 1);
  assert.deepEqual(
    (await listSeries()).map((s) => s.title),
    ["Blue Lock", "One Piece"],
  );
  ok("une série sans tome propose le tome 1, la liste est triée par titre");

  // Le formulaire envoyé deux fois, l'un après l'autre puis en même temps.
  const ownedBefore = (await getSeries(onePiece.id))!.owned.length;
  const again = await createSeries(
    { title: "  one  PIECE ", author: null, publisher: "glenat", mangadexId: null },
    3,
  );
  assert.equal(again.created, false);
  assert.equal(again.series.id, onePiece.id);
  assert.equal(again.series.owned.length, ownedBefore);
  const twins = await Promise.all(
    [1, 2].map(() =>
      createSeries({ title: "Kaiju n°8", author: null, publisher: "Kazé", mangadexId: "dex-kaiju" }, 2),
    ),
  );
  assert.deepEqual(twins.map((t) => t.created).sort(), [false, true]);
  assert.equal(twins[0].series.id, twins[1].series.id);
  assert.equal(
    (await query(`select 1 from series where mangadex_id = 'dex-kaiju'`)).length,
    1,
  );
  await deleteSeries(twins[0].series.id);
  ok("un double envoi du formulaire ne crée qu'une série, sans toucher à ses tomes");

  const otherPublisher = await createSeries(
    { title: "One Piece", author: null, publisher: "Glénat Collector", mangadexId: null },
    0,
  );
  assert.equal(otherPublisher.created, true);
  await deleteSeries(otherPublisher.series.id);
  ok("la même série chez un autre éditeur reste possible");

  assert.equal(await getSeries("pas-un-uuid"), null);
  assert.equal(await getSeries("00000000-0000-0000-0000-000000000000"), null);
  ok("un identifiant inconnu ou mal formé ne lève pas");

  // --- Couvertures -------------------------------------------------------

  await saveCovers(blueLock.id, [
    { number: 1, url: "https://dex.test/1.jpg", source: "mangadex" },
    { number: 2, url: "https://books.test/2.jpg", source: "google" },
    { number: 3, url: null, source: null },
  ]);
  await saveCovers(blueLock.id, [
    { number: 1, url: "https://books.test/1.jpg", source: "google" },
    { number: 2, url: "https://dex.test/2.jpg", source: "mangadex" },
    { number: 3, url: null, source: null },
  ]);
  let covers = await allCovers(blueLock.id);
  assert.equal(covers.get(1), "https://books.test/1.jpg");
  assert.equal(covers.get(2), "https://books.test/2.jpg");
  assert.equal(covers.has(3), false);
  ok("la couverture française remplace la japonaise, jamais l'inverse");

  const lookups = await coversFor([
    { seriesId: blueLock.id, number: 2 },
    { seriesId: blueLock.id, number: 3 },
    { seriesId: onePiece.id, number: 87 },
  ]);
  assert.equal(lookups.get(coverKey(blueLock.id, 2)), "https://books.test/2.jpg");
  assert.equal(lookups.get(coverKey(blueLock.id, 3)), null);
  assert.equal(lookups.has(coverKey(onePiece.id, 87)), false);
  ok("« cherché, rien trouvé » se distingue de « jamais cherché »");

  await saveCovers(blueLock.id, [{ number: 3, url: "https://dex.test/3.jpg", source: "mangadex" }]);
  assert.equal((await allCovers(blueLock.id)).get(3), "https://dex.test/3.jpg");
  ok("une couverture trouvée plus tard remplit la case vide");

  await deleteSeries(blueLock.id);
  assert.equal(await getSeries(blueLock.id), null);
  assert.equal(
    (await query(`select 1 from volume_covers where series_id = $1`, [blueLock.id])).length,
    0,
  );
  ok("supprimer une série emporte ses tomes et ses couvertures");

  // --- Lecture des sources ---------------------------------------------

  assert.equal(normalizeTitle("  Jujutsu Kaisen — Édition "), "jujutsu kaisen edition");
  assert.equal(volumeNumberOf("One Piece", "One Piece - Édition originale - Tome 108"), 108);
  assert.equal(volumeNumberOf("One Piece", "One Piece", "Tome 01 : À l'aube d'une grande aventure"), 1);
  assert.equal(volumeNumberOf("One Piece", "One Piece T45"), 45);
  assert.equal(volumeNumberOf("One Piece", "One Piece 12"), 12);
  assert.equal(volumeNumberOf("One Piece", "One Piece Party 3"), null);
  assert.equal(volumeNumberOf("One Piece", "One Piece - Coffret Tome 1 à 12"), null);
  assert.equal(volumeNumberOf("One Piece", "Naruto 12"), null);
  assert.equal(volumeNumberOf("One Piece", "One Piece Red"), null);
  ok("seul un tome de la série régulière est reconnu");

  const edition = readGoogleItems(
    "Blue Lock",
    "Pika",
    [
      { volumeInfo: { title: "Blue Lock T01", publisher: "Pika", language: "fr", publishedDate: "2021-04-07", imageLinks: { thumbnail: "http://books.google.com/x?id=1&edge=curl" } } },
      { volumeInfo: { title: "Blue Lock T02", publisher: "Pika Édition", language: "fr", publishedDate: "2021-05" } },
      { volumeInfo: { title: "Blue Lock T30", publisher: "Pika", language: "fr", publishedDate: "2099-01-01" } },
      { volumeInfo: { title: "Blue Lock 31", publisher: "Kodansha", language: "ja" } },
      { volumeInfo: { title: "Blue Lock 29", publisher: "Kana", language: "fr" } },
      { volumeInfo: { title: "Blue Lock - Episode Nagi T03", publisher: "Pika", language: "fr" } },
      {},
    ],
    "2026-09-27",
  );
  assert.equal(edition.volumes, 2);
  assert.equal(edition.covers.get(1), "https://books.google.com/x?id=1");
  assert.equal(edition.covers.size, 1);
  ok("Google Books : précommandes, autres éditeurs et autres langues écartés");

  const dexCovers = readDexCovers("m1", [
    { attributes: { volume: "1", fileName: "ja1.jpg", locale: "ja" } },
    { attributes: { volume: "1", fileName: "fr1.jpg", locale: "fr" } },
    { attributes: { volume: "1", fileName: "en1.jpg", locale: "en" } },
    { attributes: { volume: "2", fileName: "en2.jpg", locale: "en" } },
    { attributes: { volume: null, fileName: "x.jpg", locale: "ja" } },
    { attributes: { volume: "1.5", fileName: "y.jpg", locale: "ja" } },
  ]);
  assert.equal(dexCovers.get(1), "https://uploads.mangadex.org/covers/m1/fr1.jpg.512.jpg");
  assert.equal(dexCovers.get(2), "https://uploads.mangadex.org/covers/m1/en2.jpg.512.jpg");
  assert.equal(dexCovers.size, 2);
  ok("MangaDex : la couverture française d'abord, puis la japonaise");

  const match = readDexManga({
    id: "m1",
    attributes: {
      title: { en: "Attack on Titan" },
      altTitles: [{ ja: "進撃の巨人" }, { fr: "L'Attaque des Titans" }],
      status: "completed",
      year: 2009,
    },
    relationships: [
      { type: "author", attributes: { name: "Isayama Hajime" } },
      { type: "cover_art", attributes: { fileName: "c.jpg" } },
    ],
  });
  assert.equal(match.title, "L'Attaque des Titans");
  assert.equal(match.author, "Isayama Hajime");
  assert.equal(match.status, "finished");
  assert.equal(match.coverUrl, "https://uploads.mangadex.org/covers/m1/c.jpg.512.jpg");
  ok("MangaDex : titre français, auteur et statut");

  // --- Actualisation depuis les sources (réseau simulé) -----------------

  const realFetch = globalThis.fetch;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  let googleDown = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host === "www.googleapis.com") {
      if (googleDown) return new Response("quota", { status: 429 });
      if (url.searchParams.get("startIndex") !== "0") return json({ items: [] });
      return json({
        items: [1, 2, 3].map((n) => ({
          volumeInfo: {
            title: `Dandadan T0${n}`,
            publisher: "Crunchyroll",
            language: "fr",
            publishedDate: "2023-01-01",
            imageLinks: n === 1 ? { thumbnail: "https://books.test/d1.jpg" } : undefined,
          },
        })),
      });
    }
    if (url.pathname === "/manga/dex-dandadan") {
      return json({
        data: {
          id: "dex-dandadan",
          attributes: { title: { en: "Dandadan" }, status: "ongoing", lastVolume: "" },
          relationships: [{ type: "author", attributes: { name: "Tatsu Yukinobu" } }],
        },
      });
    }
    if (url.pathname === "/cover") {
      return json({
        total: 2,
        data: [
          { attributes: { volume: "1", fileName: "j1.jpg", locale: "ja" } },
          { attributes: { volume: "2", fileName: "j2.jpg", locale: "ja" } },
        ],
      });
    }
    return new Response("inconnu", { status: 404 });
  }) as typeof fetch;

  try {
    const { series: dandadan } = await createSeries(
      { title: "Dandadan", author: null, publisher: "Crunchyroll", mangadexId: "dex-dandadan" },
      1,
    );
    assert.equal(isStale(dandadan), true);

    const report = await refreshSeries(dandadan);
    assert.deepEqual(report, { volumes: 3, failures: [] });
    const refreshed = (await getSeries(dandadan.id))!;
    assert.equal(refreshed.volumesAuto, 3);
    assert.equal(refreshed.status, "ongoing");
    assert.equal(refreshed.author, "Tatsu Yukinobu");
    assert.equal(isStale(refreshed), false);
    ok("le nombre de tomes vient de l'édition française, l'auteur de MangaDex");

    const dcovers = await allCovers(dandadan.id);
    assert.equal(dcovers.get(1), "https://books.test/d1.jpg");
    assert.equal(dcovers.get(2), "https://uploads.mangadex.org/covers/dex-dandadan/j2.jpg.512.jpg");
    assert.equal(dcovers.has(3), false);
    const tried = await coversFor([{ seriesId: dandadan.id, number: 3 }]);
    assert.equal(tried.get(coverKey(dandadan.id, 3)), null);
    ok("les couvertures se complètent d'une source à l'autre");

    googleDown = true;
    const partial = await refreshSeries(refreshed);
    assert.equal(partial.failures.length, 1);
    assert.match(partial.failures[0], /Google Books/);
    assert.equal((await getSeries(dandadan.id))!.volumesAuto, 3);
    ok("une source en panne est signalée sans effacer le reste");
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(formatGaps([12, 51]), "T12, T51");
  assert.equal(formatGaps([1, 2, 3, 4, 5], 3), "T1, T2, T3 et 2 autres");
  ok("mise en forme des tomes manquants");

  // --- Limitation des connexions ---------------------------------------

  const ip = "203.0.113.7";
  assert.equal(await lockedMinutes(ip), 0);
  for (let attempt = 1; attempt < MAX_FAILURES; attempt++) {
    await recordFailure(ip);
  }
  assert.equal(await lockedMinutes(ip), 0);
  ok("les premiers échecs ne bloquent pas");

  await recordFailure(ip);
  const attente = await lockedMinutes(ip);
  assert.ok(attente >= 1 && attente <= 15, `attente : ${attente}`);
  ok("au-delà de la limite, l'adresse est bloquée pour la fenêtre");

  // Une autre adresse n'est pas touchée : un inconnu ne bloque pas le
  // propriétaire en échouant exprès.
  assert.equal(await lockedMinutes("198.51.100.1"), 0);
  ok("le blocage est propre à une adresse");

  // Des échecs hors de la fenêtre ne comptent plus.
  await query(
    `update login_failures set failed_at = now() - interval '16 minutes' where ip = $1`,
    [ip],
  );
  assert.equal(await lockedMinutes(ip), 0);
  ok("les échecs anciens ne comptent plus");

  await recordFailure(ip);
  await clearFailures(ip);
  assert.equal(
    (await query(`select 1 from login_failures where ip = $1`, [ip])).length,
    0,
  );
  ok("une connexion réussie efface les échecs");

  // --- Montants ---------------------------------------------------------
  // --- Montants ---------------------------------------------------------

  assert.equal(parseEuros("12,50"), 1250);
  assert.equal(parseEuros("12.50"), 1250);
  assert.equal(parseEuros("1 299,99 €"), 129999);
  assert.equal(parseEuros(""), undefined);
  assert.equal(parseEuros(null), undefined);
  assert.equal(parseEuros("abc"), null);
  assert.equal(parseEuros("-3"), null);
  ok("lecture des montants saisis");

  assert.equal(formatCents(129999).replace(/ | /g, " "), "1 299,99 €");
  assert.equal(percentChange(10000, 12500), 25);
  assert.equal(percentChange(0, 100), undefined);
  ok("formatage et variation");

  // --- Session ----------------------------------------------------------

  process.env.AUTH_SECRET = "secret-de-test";

  const token = await newToken();
  assert.equal(await verifyToken(token), true);
  ok("un jeton fraîchement émis est accepté");

  assert.equal(await verifyToken(undefined), false);
  assert.equal(await verifyToken("nimportequoi"), false);
  assert.equal(await verifyToken("1700000000.signaturebidon"), false);
  ok("un jeton absent ou mal signé est refusé");

  // Rejouer un jeton signé avec une autre clé ne doit rien donner.
  const [issued] = token.split(".");
  process.env.AUTH_SECRET = "une-autre-clef";
  assert.equal(await verifyToken(token), false);
  ok("un jeton signé avec une autre clé est refusé");

  process.env.AUTH_SECRET = "secret-de-test";
  // Un jeton daté d'il y a plus de 30 jours est périmé.
  const vieux = Number(issued) - 31 * 24 * 3600 * 1000;
  const { signPayload } = await import("../lib/session");
  assert.equal(
    await verifyToken(`${vieux}.${await signPayload(String(vieux))}`),
    false,
  );
  ok("un jeton de plus de 30 jours est périmé");

  assert.equal(safeEquals("abc", "abc"), true);
  assert.equal(safeEquals("abc", "abd"), false);
  assert.equal(safeEquals("abc", "abcd"), false);
  ok("comparaison à temps constant");

  await pg.close();

  console.log(checks.map((check) => `  ✓ ${check}`).join("\n"));
  console.log(`\n${checks.length} vérifications passées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
