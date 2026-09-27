# MyLibrary

Suivi de mes collections de mangas, en français.

Le projet reprend la stack et les conventions de
[MyCards](https://github.com/xPhoeNiXiSx/MyCards). Pour l'instant, c'est un
socle : connexion, base de données et migrations sont en place, la gestion des
collections reste à construire.

**L'application entière est privée.** Toute route autre que la page de
connexion redirige vers celle-ci tant que la session n'est pas ouverte. La
fermeture se fait dans `proxy.ts`, en amont du rendu, pour qu'une route
ajoutée plus tard soit fermée par défaut plutôt que publique par oubli.

La connexion est freinée : au-delà de 5 mots de passe faux en 15 minutes
depuis une même adresse, elle est refusée jusqu'à la fin de la fenêtre
(`lib/throttle.ts`). Les échecs sont comptés en base, une fonction serverless
ne gardant rien en mémoire d'un appel à l'autre.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Postgres** (Neon), via `@neondatabase/serverless`
- Tests de la couche données sur **PGlite** (Postgres en mémoire)
- Hébergement **Vercel**, fonctions en région `fra1`

## Design

**Thème sombre uniquement** : pas de variante claire, `:root` déclare
`color-scheme: dark`. La base visuelle (palette, Inter et Space Grotesk via
`next/font`) est reprise de MyCards en attendant une identité propre à
MyLibrary. Tout est piloté par des variables CSS dans `app/globals.css`.

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run typecheck  # tsc --noEmit
npm test           # couche données, sur un Postgres en mémoire (PGlite)
```

Les tests appliquent le vrai schéma, par le même code que la production, et
rejouent les requêtes réelles contre un Postgres embarqué : seul le pilote
change. Pas besoin de base ni de réseau pour les lancer.

## Configuration

Trois variables d'environnement, à définir dans Vercel (Settings →
Environment Variables) et dans un `.env.local` pour le développement :

| Variable       | Rôle                                                        |
| -------------- | ----------------------------------------------------------- |
| `DATABASE_URL` | Chaîne de connexion Postgres (Neon)                          |
| `APP_PASSWORD` | Mot de passe unique d'accès à l'application                  |
| `AUTH_SECRET`  | Clé de signature du cookie de session — une valeur aléatoire |

Tant qu'elles manquent, l'accueil affiche un écran expliquant ce qui manque
plutôt que de planter. Générer un secret : `openssl rand -base64 32`.

### Créer la base

1. Vercel → onglet **Storage** → **Create Database** → **Neon** (offre gratuite)
2. Vercel injecte `DATABASE_URL` dans le projet
3. Redéployer, se connecter, puis cliquer **Initialiser la base** sur l'accueil

Aucun SQL à exécuter à la main. Le schéma vit dans `lib/schema.ts` et l'app
l'applique elle-même, parce que la base n'est joignable que depuis les
fonctions serveur.

Pour les évolutions : ajouter une instruction idempotente dans
`SCHEMA_STATEMENTS`, déployer, puis lancer **Appliquer les migrations** depuis
**Mon compte**. Rien n'est jamais supprimé, le rejeu est sans effet. Le
panneau indique la date du dernier passage (`migrations.last_run` dans
`app_settings`).

## Architecture

| Chemin               | Rôle                                                       |
| -------------------- | ---------------------------------------------------------- |
| `app/page.tsx`       | Accueil provisoire : vérifie configuration, base et schéma |
| `app/compte/`        | Compte : déconnexion, application des migrations           |
| `app/login/`         | Connexion par mot de passe                                 |
| `app/db-screens.tsx` | Écrans d'attente de la base, partagés par les pages        |
| `app/masthead.tsx`   | En-tête commun                                             |
| `app/manifest.ts`    | Manifeste : ouverture plein écran depuis l'écran d'accueil |
| `proxy.ts`           | Ferme toute l'application derrière la session              |
| `lib/db.ts`          | Accès Postgres, injection de la base de test, migrations   |
| `lib/schema.ts`      | Schéma Postgres, idempotent, appliqué par l'app elle-même  |
| `lib/session.ts`     | Signature et vérification du cookie, sans `next/headers`   |
| `lib/auth.ts`        | Session par mot de passe unique                            |
| `lib/throttle.ts`    | Limite des essais de connexion, par adresse                |
| `lib/money.ts`       | Montants en centimes, formatage et saisie en euros         |

## Déploiement

Relier le dépôt à un projet Vercel via l'intégration GitHub : un push sur
`main` déploie en production. Si Vercel affiche « No Production
Deployment » alors que le dépôt est bien relié, c'est qu'aucun push n'a eu
lieu depuis la liaison : le prochain push sur `main` le déclenche. Les fonctions serveur sont épinglées sur
**Francfort** (`fra1`, voir `vercel.json`) : créer la base Neon dans la même
région, sans quoi chaque requête SQL ferait un aller-retour transatlantique.

## Suite

- Modèle de données des collections de mangas (séries, tomes, possession)
- Identité visuelle propre : nom affiché, logotype, favicon
