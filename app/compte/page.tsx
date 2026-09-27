import { lastMigrationRun } from "@/lib/db";

import { logoutAction } from "../login/actions";
import { Masthead } from "../masthead";
import { migrateAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Date du dernier passage des migrations, à l'heure de Paris. La base peut ne
 * pas être joignable — la page du compte doit s'afficher quand même, c'est
 * justement là qu'on vient quand quelque chose cloche.
 */
async function lastRunLabel(): Promise<string> {
  try {
    const at = await lastMigrationRun();
    if (!at) return "Jamais appliquées depuis cet écran.";
    const when = at.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Dernière application : ${when.replace(" ", " à ")}.`;
  } catch {
    return "Dernière application : inconnue (base injoignable ou vide).";
  }
}

export default async function ComptePage() {
  const dernierPassage = await lastRunLabel();

  return (
    <main className="page narrow">
      <Masthead account={false} />
      <h1 className="page-title">Mon compte</h1>

      <div className="panel">
        <h2>Session</h2>
        <p className="hint">
          Tu es connecté. L&apos;accès à l&apos;application est protégé par un
          mot de passe unique, défini dans les variables d&apos;environnement.
        </p>
        <form action={logoutAction} className="form">
          <button type="submit">Se déconnecter</button>
        </form>
      </div>

      <div className="panel">
        <h2>Base de données</h2>
        <p className="hint">
          À lancer après une mise à jour qui ajoute des tables ou des champs.
          L&apos;opération est sans risque et peut être rejouée : elle ne crée
          que ce qui manque et ne supprime jamais rien.
        </p>
        <p className="hint">{dernierPassage}</p>
        <form action={migrateAction} className="form">
          <button type="submit">Appliquer les migrations</button>
        </form>
      </div>
    </main>
  );
}
