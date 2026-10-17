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

  // Une série suivie : One Piece chez Glénat, par exemple. Le nombre de tomes
  // parus vient des sources en ligne (`volumes_auto`) ; `volumes_manual` le
  // corrige quand elles se trompent, et fait alors autorité.
  `create table if not exists series (
     id                  uuid primary key default gen_random_uuid(),
     title               text not null,
     author              text,
     publisher           text,
     -- 'ongoing' ou 'finished', tel que les sources le donnent.
     status              text check (status in ('ongoing', 'finished')),
     mangadex_id         text,
     volumes_auto        integer check (volumes_auto > 0),
     volumes_manual      integer check (volumes_manual > 0),
     volumes_checked_at  timestamptz,
     created_at          timestamptz not null default now(),
     updated_at          timestamptz not null default now()
   )`,

  // Un tome possédé = une ligne. Pas de prix ni de date : on coche, c'est tout.
  `create table if not exists owned_volumes (
     series_id   uuid not null references series (id) on delete cascade,
     number      integer not null check (number > 0),
     created_at  timestamptz not null default now(),
     primary key (series_id, number)
   )`,

  // Couvertures trouvées en ligne, tome par tome. Une ligne sans `url` veut
  // dire « cherché, rien trouvé » : sans elle, chaque affichage relancerait
  // la recherche.
  `create table if not exists volume_covers (
     series_id   uuid not null references series (id) on delete cascade,
     number      integer not null check (number > 0),
     url         text,
     source      text,
     fetched_at  timestamptz not null default now(),
     primary key (series_id, number)
   )`,

  // Clé d'ajout : un double envoi du formulaire (un second toucher pendant
  // que les sources répondent) ne doit pas créer la série deux fois. Index
  // partiel : les séries d'avant cette colonne restent sans clé, doublons
  // compris — rien n'est supprimé à leur place.
  `alter table series add column if not exists dedupe_key text`,

  `create unique index if not exists series_dedupe_key_idx
     on series (dedupe_key) where dedupe_key is not null`,

  // --- Jeux de société ---------------------------------------------------

  // Un jeu possédé ou voulu : même objet à deux moments de sa vie, comme dans
  // MyCards. L'achat n'est qu'une bascule de `status`.
  `create table if not exists games (
     id           uuid primary key default gen_random_uuid(),
     title        text not null,
     status       text not null default 'owned' check (status in ('owned', 'wanted')),
     designer     text,
     publisher    text,
     year         integer check (year > 0),
     min_players  integer check (min_players > 0),
     max_players  integer check (max_players > 0),
     min_minutes  integer check (min_minutes > 0),
     max_minutes  integer check (max_minutes > 0),
     min_age      integer check (min_age > 0),
     image_url    text,
     bgg_id       text,
     -- Même rôle que pour les séries : un double envoi ne crée qu'un jeu.
     dedupe_key   text,
     created_at   timestamptz not null default now(),
     updated_at   timestamptz not null default now()
   )`,

  `create unique index if not exists games_dedupe_key_idx
     on games (dedupe_key) where dedupe_key is not null`,

  // Une extension appartient à son jeu ; possédée ou seulement voulue.
  `create table if not exists game_expansions (
     id          uuid primary key default gen_random_uuid(),
     game_id     uuid not null references games (id) on delete cascade,
     title       text not null,
     status      text not null default 'owned' check (status in ('owned', 'wanted')),
     created_at  timestamptz not null default now()
   )`,

  `create unique index if not exists game_expansions_title_idx
     on game_expansions (game_id, lower(title))`,

  // Prêts. Un prêt en cours n'a pas de date de retour, et un jeu n'a qu'un
  // prêt en cours à la fois — l'index partiel l'impose.
  `create table if not exists game_loans (
     id           uuid primary key default gen_random_uuid(),
     game_id      uuid not null references games (id) on delete cascade,
     borrower     text not null,
     lent_on      date not null default current_date,
     returned_on  date
   )`,

  `create unique index if not exists game_loans_open_idx
     on game_loans (game_id) where returned_on is null`,

  // Parties jouées. Les extensions utilisées sont gardées par identifiant.
  `create table if not exists game_plays (
     id          uuid primary key default gen_random_uuid(),
     game_id     uuid not null references games (id) on delete cascade,
     played_on   date not null default current_date,
     players     integer check (players > 0),
     winner      text,
     expansions  uuid[] not null default '{}',
     notes       text,
     created_at  timestamptz not null default now()
   )`,

  `create index if not exists game_plays_game_idx
     on game_plays (game_id, played_on desc)`,
];
