import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";

import { DatabaseErrorScreen, SetupScreen } from "./db-screens";
import { Masthead } from "./masthead";
import { migrateAction } from "./compte/actions";

export const dynamic = "force-dynamic";

/**
 * Accueil provisoire : il vérifie que la chaîne complète — configuration,
 * base, schéma — est en place. La collection de mangas viendra ici.
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

  return (
    <main className="page narrow">
      <Masthead />
      <h1 className="page-title">Ma bibliothèque</h1>

      {ready ? (
        <div className="panel">
          <h2>Tout est en place</h2>
          <p className="hint">
            La base répond et le schéma est appliqué. Les collections de mangas
            arrivent bientôt.
          </p>
        </div>
      ) : (
        <div className="panel">
          <h2>Base à initialiser</h2>
          <p className="hint">
            La base répond mais elle est vide. Un clic crée les tables ; rien
            n&apos;est à faire à la main.
          </p>
          <form action={migrateAction} className="form">
            <button type="submit">Initialiser la base</button>
          </form>
        </div>
      )}
    </main>
  );
}
