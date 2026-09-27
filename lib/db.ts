import { neon } from "@neondatabase/serverless";

import { SCHEMA_STATEMENTS } from "@/lib/schema";

/**
 * Accès Postgres. Une seule fonction `query`, volontairement bas niveau :
 * elle permet de rejouer exactement les mêmes requêtes contre une base de test
 * en mémoire (voir `scripts/test-db.ts`), ce qu'un client à template balisé
 * ne permettrait pas aussi simplement.
 */

export type QueryRunner = <T>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

let runner: QueryRunner | undefined;

/** Permet aux tests d'injecter une base locale à la place de Neon. */
export function setQueryRunner(custom: QueryRunner): void {
  runner = custom;
}

function neonRunner(): QueryRunner {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas définie. Ajoute la chaîne de connexion Postgres dans les variables d'environnement Vercel.",
    );
  }

  const sql = neon(url);
  return async <T>(text: string, params: unknown[] = []) =>
    (await sql.query(text, params)) as T[];
}

export async function query<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  runner ??= neonRunner();
  return runner<T>(text, params);
}

/** `true` si une base est configurée, sans tenter de s'y connecter. */
export function isDatabaseConfigured(): boolean {
  return Boolean(runner ?? process.env.DATABASE_URL);
}

/** Clé de `app_settings` qui garde la date du dernier passage des migrations. */
const LAST_RUN_KEY = "migrations.last_run";

/**
 * Applique le schéma. Rejouable : chaque instruction est idempotente.
 *
 * Les instructions partent une par une, et pas en un seul bloc, parce que le
 * pilote HTTP de Neon refuse les requêtes multi-instructions.
 */
export async function runMigrations(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await query(statement);
  }

  // Sans cette trace, le bouton renverrait un écran inchangé et on ne saurait
  // pas s'il s'est passé quelque chose.
  await query(
    `insert into app_settings (key, value) values ($1, to_jsonb(now()))
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [LAST_RUN_KEY],
  );
}

/** Date du dernier passage des migrations, ou `null` s'il n'y en a jamais eu. */
export async function lastMigrationRun(): Promise<Date | null> {
  const rows = await query<{ value: unknown }>(
    `select value from app_settings where key = $1`,
    [LAST_RUN_KEY],
  );
  const value = rows[0]?.value;
  return typeof value === "string" ? new Date(value) : null;
}

/** `true` si le schéma a déjà été appliqué. */
export async function isSchemaReady(): Promise<boolean> {
  const rows = await query<{ present: boolean }>(
    `select to_regclass('public.app_settings') is not null as present`,
  );
  return rows[0]?.present === true;
}
