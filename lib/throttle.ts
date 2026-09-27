import { isDatabaseConfigured, query } from "@/lib/db";

/**
 * Freine qui devine le mot de passe. Il n'y a qu'un mot de passe et l'app est
 * en ligne : sans limite, rien n'empêche de l'essayer en boucle.
 *
 * Au-delà de `MAX_FAILURES` échecs en `WINDOW_MINUTES` depuis une même
 * adresse, la connexion est refusée jusqu'à ce que le plus ancien sorte de la
 * fenêtre. Compter par adresse, et pas globalement, évite qu'un inconnu
 * bloque le propriétaire en échouant exprès.
 *
 * Les échecs vivent en base : une fonction serverless ne garde rien en
 * mémoire d'un appel à l'autre.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

/** Minutes à attendre avant de pouvoir réessayer. 0 = pas de blocage. */
export async function lockedMinutes(ip: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const rows = await query<{ failures: number | string; oldest: string | Date | null }>(
      `select count(*) as failures, min(failed_at) as oldest
         from login_failures
        where ip = $1 and failed_at > now() - make_interval(mins => $2)`,
      [ip, WINDOW_MINUTES],
    );
    const failures = Number(rows[0]?.failures ?? 0);
    const oldest = rows[0]?.oldest;
    if (failures < MAX_FAILURES || !oldest) return 0;

    const unlock = new Date(oldest).getTime() + WINDOW_MINUTES * 60_000;
    return Math.max(1, Math.ceil((unlock - Date.now()) / 60_000));
  } catch (error) {
    // Table absente (schéma pas encore appliqué) ou base injoignable : ne pas
    // enfermer dehors le seul utilisateur, qui n'aurait aucun moyen d'entrer
    // pour appliquer le schéma.
    console.warn("[throttle] lecture impossible", error);
    return 0;
  }
}

export async function recordFailure(ip: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await query(`insert into login_failures (ip) values ($1)`, [ip]);
    // Ménage au passage : au-delà de la fenêtre, un échec ne sert plus à rien.
    await query(
      `delete from login_failures
        where failed_at < now() - make_interval(mins => $1)`,
      [WINDOW_MINUTES],
    );
  } catch (error) {
    console.warn("[throttle] écriture impossible", error);
  }
}

/** Une connexion réussie efface l'ardoise de son adresse. */
export async function clearFailures(ip: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await query(`delete from login_failures where ip = $1`, [ip]);
  } catch (error) {
    console.warn("[throttle] effacement impossible", error);
  }
}
