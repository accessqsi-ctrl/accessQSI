# accessQSI - Système de Gestion d'Accès par Code QR

accessQSI est une plateforme moderne et sécurisée pour la gestion d'événements et le contrôle d'accès via des codes QR uniques.

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

## Auteur
Lionel TSHITENGE KALEU
