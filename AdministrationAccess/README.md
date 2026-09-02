# Administration AccessQ

Console réservée aux utilisateurs `SUPER_ADMIN`. Elle partage la base PostgreSQL et le schéma métier du backend AccessQ.

## Démarrage

1. Copier `.env.example` vers `.env` et renseigner `DATABASE_URL` ainsi qu'un `JWT_SECRET` long et aléatoire.
2. Installer les dépendances avec `npm install`.
3. Lancer `npm run dev` en développement ou `npm start` en production.

La console écoute sur `http://localhost:4000` par défaut.

Au premier démarrage, un compte `SUPER_ADMIN` est créé s'il n'existe pas encore. Ses identifiants viennent de `DEFAULT_ADMIN_EMAIL` et `DEFAULT_ADMIN_PASSWORD`. Les valeurs de démonstration présentes dans `.env.example` doivent être remplacées en production.

## Gestion par organisation

La liste `/organizations` ouvre une fiche pour chaque organisation. Cette fiche centralise les informations du compte client, l'abonnement, les administrateurs et les agents/opérateurs avec leurs actions autorisées.

## Vérifications

- `npm run check` valide le schéma Prisma et la syntaxe des fichiers serveur.
- `npm run prisma:generate` régénère le client après une évolution du schéma.
- `npm run seed:admin` crée manuellement le compte administrateur par défaut s'il est absent.

Le fichier `prisma/schema.prisma` doit rester synchronisé avec `BackendAccessQ/src/prisma/schema.prisma`. Les migrations de la base restent pilotées par `BackendAccessQ`.

## Sécurité des accès

- La désactivation est réversible et modifie uniquement l'état d'accès. Elle ne supprime pas les données personnelles.
- L'archivage et l'effacement RGPD restent des opérations séparées, soumises à la politique de conservation de l'organisation.
- Toutes les actions sensibles nécessitent une session `SUPER_ADMIN` active et un jeton CSRF valide.
- La réactivation d'un agent respecte l'état de son organisation, sa suspension commerciale et le quota de son plan.
- Les événements de sécurité sont journalisés avec des identifiants techniques, sans adresse e-mail ni mot de passe.
