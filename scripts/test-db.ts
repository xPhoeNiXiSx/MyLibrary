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
import { formatCents, parseEuros, percentChange } from "../lib/money";
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
