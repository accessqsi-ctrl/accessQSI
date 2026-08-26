# Administration AccessQ

Console réservée aux utilisateurs `SUPER_ADMIN`. Elle partage la base PostgreSQL et le schéma métier du backend AccessQ.

## Démarrage

1. Copier `.env.example` vers `.env` et renseigner `DATABASE_URL` ainsi qu'un `JWT_SECRET` long et aléatoire.
2. Installer les dépendances avec `npm install`.
3. Lancer `npm run dev` en développement ou `npm start` en production.

La console écoute sur `http://localhost:4000` par défaut.

## Vérifications

- `npm run check` valide le schéma Prisma et la syntaxe des fichiers serveur.
- `npm run prisma:generate` régénère le client après une évolution du schéma.

Le fichier `prisma/schema.prisma` doit rester synchronisé avec `BackendAccessQ/src/prisma/schema.prisma`. Les migrations de la base restent pilotées par `BackendAccessQ`.
