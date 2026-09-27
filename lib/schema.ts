/**
 * Schéma de la base — source unique de vérité.
 *
 * Il vit dans le code plutôt que dans un fichier .sql à part pour une raison
 * précise : l'app doit pouvoir l'appliquer elle-même depuis une fonction
 * serveur (voir `runMigrations`). Personne n'a à ouvrir un éditeur SQL, ni au
 * premier déploiement ni aux évolutions suivantes.
 *
 * Règle à tenir : chaque instruction doit être rejouable sans erreur sur une
 * base déjà à jour. `if not exists` partout, jamais de `drop`.
 *
 * Les tables de la collection de mangas viendront ici.
 */
export const SCHEMA_STATEMENTS: string[] = [
  // Réglages de l'application, une ligne par réglage. Une table clé-valeur
  // plutôt qu'une colonne par réglage : en ajouter un ne demande pas de
  // migration, et il n'y a qu'un utilisateur.
  `create table if not exists app_settings (
     key         text primary key,
     value       jsonb not null,
     updated_at  timestamptz not null default now()
   )`,

  // Essais de connexion ratés, pour ralentir qui devine le mot de passe.
  `create table if not exists login_failures (
     ip         text not null,
     failed_at  timestamptz not null default now()
   )`,

  `create index if not exists login_failures_ip_idx
     on login_failures (ip, failed_at)`,
];
