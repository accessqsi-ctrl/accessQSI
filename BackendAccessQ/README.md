# AccessQ - Système de Gestion d'Accès par Code QR

AccessQ est une plateforme moderne et sécurisée pour la gestion d'événements et le contrôle d'accès via des codes QR uniques.

## Fonctionnalités Clés

- **Authentification Sécurisée** : Connexion, inscription et vérification d'email.
- **Tableau de Bord Analytique** : Visualisation des scans sur 7 jours via Recharts et suivi des top agents.
- **Gestion des Événements** : Création, modification et suppression d'événements avec planification de zones.
- **Gestion des Agents** : Attribution d'agents pour le contrôle d'accès sur le terrain.
- **Gestion des Codes QR** :
    - Génération individuelle et par lot (Import CSV).
    - Révocation en temps réel.
    - Exportation des historiques de scan en **CSV** et **PDF**.
- **Interface Scanner Dédiée** : Une interface fluide pour les agents de terrain.
- **Paiements Mobile Money** : Activation du plan Pro avec pawaPay et historique des dépôts.

## Paiements pawaPay

Le module utilise l'API Merchant v2 de pawaPay. Copiez les variables
`PAWAPAY_*` de `.env.example` dans votre environnement, puis renseignez au
minimum `PAWAPAY_API_TOKEN`. Le sandbox est utilisé par défaut.
Le catalogue Pro est exprimé en USD et les pays/opérateurs proposés sont
chargés dynamiquement depuis la configuration active du compte pawaPay.
Le prix de référence est de 10 USD. Pour les autres devises, le backend utilise
la grille fixe définie dans `src/config/subscription.js`; une devise sans tarif
configuré n'est jamais proposée au client.

Dans le tableau de bord pawaPay, configurez cette URL de callback publique :

```text
https://votre-api.example.com/billing/callbacks/pawapay
```

Le backend vérifie chaque dépôt directement auprès de pawaPay avant d'activer
le plan Pro. Un callback reçu ne peut donc pas activer seul un abonnement.

## Essai Pro

Un administrateur d'organisation peut activer une seule fois un essai Pro depuis
la page d'abonnement. Sa durée est configurée avec
`PRO_TRIAL_DURATION_DAYS` (14 jours par défaut, entre 1 et 90 jours). À
l'expiration, les contrôles d'accès considèrent automatiquement l'organisation
comme Free, sans supprimer ses données.

## Installation & Sécurité Prod

### HTTPS & TLS
Pour une utilisation en production et pour permettre le scan via mobile :
1. **SSL Termination** : Il est recommandé d'utiliser un proxy inverse comme **Nginx** ou un service de Cloud (AWS ALB, Vercel, Heroku) pour gérer le certificat SSL (Let's Encrypt).
2. **Configuration Node** : Le code est déjà prêt pour le HTTPS. Les cookies de session sont configurés avec le flag `secure: true` automatiquement lorsque `NODE_ENV=production`.
3. **Sécurité Headers** : L'application utilise `helmet` pour protéger contre les vulnérabilités courantes (XSS, Clickjacking, etc.).

### Backend
1. `npm install`
2. Configurez le fichier `.env` :
   - `JWT_SECRET` : Une clé longue et complexe.
   - `NODE_ENV` : Mettre à `production` en déploiement.
3. `npx prisma db push`
4. `npm start`


### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev` (Tourne sur le port 3000 ou 3001)

## Technologies Utilisées
- **Backend** : Node.js, Express, Prisma, PostgreSQL, CSV-Writer, PDFKit.
- **Frontend** : Next.js, TailwindCSS, Lucide-React, Recharts.
- **QR Engine** : node-qrcode.

### Stockage persistant des QR et cartes

Définissez `FILE_STORAGE_ROOT` vers un répertoire partagé et persistant lorsque
plusieurs instances du backend sont utilisées. Les URLs publiques restent
`/qrcodes/...`, `/cards/...` et `/card-backgrounds/...`.

Le fichier `docker-compose.yml` monte automatiquement le volume `qr_assets`
dans `/usr/src/app/storage`.

## Auteur
Lionel TSHITENGE KALEU
