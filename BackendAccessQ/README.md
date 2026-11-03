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
Les appels pawaPay restent entièrement gelés tant que
`PRO_PAYMENTS_ENABLED` n'est pas défini à `true`. Le frontend masque également
le formulaire avec `NEXT_PUBLIC_PRO_PAYMENTS_ENABLED=false`.
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

## Formulaires d'inscription gratuits

Le serveur HTTP accepte les inscriptions et écrit atomiquement un job en base.
Le worker persistant doit fonctionner dans un processus séparé :

```bash
npm run worker:registrations
```

Configuration utilisée :

```env
DATABASE_URL=postgresql://...
FRONTEND_URL=https://app.example.com
BREVO_API_KEY=...
BREVO_SENDER_NAME=AccessQ
BREVO_SENDER_EMAIL=no-reply@example.com
REGISTRATION_WORKER_POLL_MS=2000
REGISTRATION_JOB_LEASE_MS=60000
```

Les deux dernières variables sont facultatives. Plusieurs workers peuvent être
lancés : les jobs sont pris avec `FOR UPDATE SKIP LOCKED` et un bail expirant.
Un email au statut `ACCEPTED` a seulement été accepté par Brevo ; aucune
notification de livraison finale n'est intégrée. Une panne après l'appel Brevo
mais avant l'enregistrement du résultat peut provoquer un second email lors de
la reprise. Elle ne crée jamais un second pass.

Les liens publics utilisent des jetons aléatoires expirants dont seule
l'empreinte SHA-256 est stockée. Le jeton QR de contrôle d'accès n'est jamais
utilisé comme jeton de téléchargement.

## Box des participants

Une inscription exige un compte participant (`attendees`), distinct des
membres d'organisation. Le participant se connecte avec un code à 6 chiffres
reçu par email (`/attendee/code/request` puis `/attendee/code/verify`) :
le premier code valide crée son compte. Il peut ensuite définir un mot de passe
(`PUT /attendee/password`). Les sessions utilisent les cookies
`attendeeToken` / `attendeeRefreshToken`, jamais ceux des organisateurs.

Chaque billet appartient à un participant (`registrations.owner_attendee_id`)
et s'affiche dans sa box (`/box/tickets`). L'email envoyé après l'émission ne
contient aucun lien d'accès, seulement le chemin vers la box. Quand l'offre
active `box_only_qr`, le QR n'est servi que comme image privée dans la box et
aucun PDF n'est disponible. Les inscriptions antérieures à la box gardent leurs
liens d'accès par email.

Le QR d'un billet `box_only_qr` est tournant : il porte un code HMAC renouvelé
toutes les 30 secondes (`box_qr.service.js`, clé dérivée de la clé privée JWT).
Le scanner transmet ce code et le serveur refuse le jeton seul ou un code
dépassé (statut `denied_dynamic_code`, journalisé). Une capture d'écran devient
donc inutilisable après 30 à 60 secondes. Aucun navigateur ne permet
d'interdire la capture elle-même. La box masque aussi le QR dès que la page
passe en arrière-plan.

## Billetterie payante

Une offre devient payante quand elle a un prix et une devise (`price`, `currency`). Seuls
les opérateurs pawaPay qui acceptent cette devise sont proposés. L'argent est encaissé sur
le compte pawaPay d'AccessQ, indépendamment des abonnements Pro :

```env
TICKET_PAYMENTS_ENABLED=true
TICKET_COMMISSION_PERCENT=10
TICKET_PAYMENT_HOLD_MINUTES=15
```

1. `POST /public/registrations/forms/:slug/checkout` (participant connecté, `Idempotency-Key`)
   réserve la place pour `TICKET_PAYMENT_HOLD_MINUTES` et lance le dépôt (`ticket_payments`).
2. Le billet n'est créé qu'après confirmation du dépôt **auprès de pawaPay**, par le callback
   de dépôt habituel (`/billing/callbacks/pawapay`, aiguillé automatiquement), par la page de
   suivi (`GET /box/payments/:id`) ou par la réconciliation en arrière-plan.
3. Chaque vente fige son taux de commission et ajoute au journal `organizer_ledger_entries`
   le montant net dû à l'organisateur. Le solde par devise est servi par
   `GET /registration-forms/balance`.

La commission vaut `TICKET_COMMISSION_PERCENT` (10 % par défaut). Un super-admin peut fixer
un taux propre à une organisation depuis la console d'administration. Un dépôt dont le
montant ne correspond pas, ou confirmé après expiration de la réservation alors que l'offre
est complète, passe en `REVIEW_REQUIRED` sans émettre de billet.

### Reversements et remboursements

L'organisateur (ORG_ADMIN) enregistre un compte Mobile Money de réception par devise
(`PUT /registration-forms/payouts/accounts`), puis demande un reversement
(`POST /registration-forms/payouts`). Chaque action demande son mot de passe. Le montant est
retiré du solde dès la demande (entrée `PAYOUT` du journal). Il y revient (`PAYOUT_REVERSAL`)
si la demande est annulée, refusée ou échoue.

Un super-admin valide ou refuse la demande depuis la page **Finances** de la console
d'administration. Il y demande aussi le remboursement des paiements `REVIEW_REQUIRED` au
payeur d'origine. La console n'écrit qu'en base : le worker du backend (même boucle que les
abonnements) envoie les reversements et remboursements validés à pawaPay, puis en vérifie le
résultat. Un envoi interrompu est renvoyé avec le même identifiant, et pawaPay ignore les
doublons.

Configurez dans pawaPay les URL de callback des reversements et des remboursements :

```text
https://votre-api.example.com/billing/callbacks/pawapay/payouts
https://votre-api.example.com/billing/callbacks/pawapay/refunds
```

## Déploiement Docker

`docker compose up -d --build` lance deux conteneurs à partir de la même image :

- `back-accessqsi` applique les migrations Prisma en attente (`prisma migrate deploy`) puis démarre l'API ;
- `registration-worker` traite les jobs des formulaires d'inscription.

Les clés JWT ne sont jamais copiées dans l'image (`*.pem` est exclu par `.dockerignore`). Elles sont montées en secrets Docker depuis `private.pem` et `public.pem`, ou peuvent être fournies via `PRIVATE_KEY` / `PUBLIC_KEY` dans `.env`.

## Essai Pro

Un administrateur d'organisation peut activer une seule fois un essai Pro depuis
la page d'abonnement. Sa durée est configurée avec
`PRO_TRIAL_DURATION_DAYS` (30 jours par défaut, entre 1 et 90 jours). À
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

### Stockage persistant des ressources de modèles

Définissez `FILE_STORAGE_ROOT` vers un répertoire persistant hors du dépôt, par
exemple `/srv/accessq/storage` sur un serveur Linux. Ce répertoire conserve les
images nécessaires aux modèles (`card-backgrounds` et `card-logos`).

Les images QR et les cartes PDF ne sont pas enregistrées sur disque : elles sont
générées en mémoire à chaque téléchargement via `/qr/image/:id`,
`/qr/card/:id/download` ou `/qr/event/:event_id/cards.pdf`.

```env
STORAGE_DRIVER=local
FILE_STORAGE_ROOT=/srv/accessq/storage
```
#### Render gratuit avec Cloudflare R2

Le disque de Render gratuit étant éphémère, créez un bucket R2 et renseignez
ces variables depuis **Render > Environment** ; aucun accès Shell n’est requis :

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=accessq-assets
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

Activez l’accès public du bucket R2 (domaine `r2.dev` ou domaine personnalisé)
et utilisez cette origine comme `R2_PUBLIC_URL`. Le backend envoie, lit et
supprime les fonds via l’API S3 de R2. Les QR et PDF restent générés en mémoire
et ne consomment pas le stockage R2.


## Auteur
Lionel TSHITENGE KALEU
