# Administration AccessQ

Console réservée aux utilisateurs `SUPER_ADMIN`. Elle partage la base PostgreSQL et le schéma métier du backend AccessQ.

## Démarrage

1. Copier `.env.example` vers `.env` et renseigner `DATABASE_URL` ainsi qu'un `JWT_SECRET` long et aléatoire.
2. Installer les dépendances avec `npm install`.
3. Lancer `npm run dev` en développement ou `npm start` en production.

La console écoute sur `http://localhost:4000` par défaut.

Au premier démarrage, un compte `SUPER_ADMIN` est créé s'il n'existe pas encore. Ses identifiants viennent de `DEFAULT_ADMIN_EMAIL` et `DEFAULT_ADMIN_PASSWORD`. Les valeurs de démonstration présentes dans `.env.example` doivent être remplacées en production.

## Vérifications

- `npm run check` valide le schéma Prisma et la syntaxe des fichiers serveur.
- `npm run prisma:generate` régénère le client après une évolution du schéma.
- `npm run seed:admin` crée manuellement le compte administrateur par défaut s'il est absent.

Le fichier `prisma/schema.prisma` doit rester synchronisé avec `BackendAccessQ/src/prisma/schema.prisma`. Les migrations de la base restent pilotées par `BackendAccessQ`.
