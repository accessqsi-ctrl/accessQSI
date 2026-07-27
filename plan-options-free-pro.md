# Options des plans Free et Pro - AccessQ

Ce document synthétise les options et limites des plans Free et Pro pour l’application AccessQ, en excluant la partie login/register.

## Sources analysées
- Configuration des abonnements : BackendAccessQ/src/config/subscription.js
- Protection plan Pro : BackendAccessQ/src/middleware/planAccessMiddleware.js
- Restrictions d’événements et QR : BackendAccessQ/src/controllers/api.event.controller.js et BackendAccessQ/src/controllers/api.qr.controller.js
- Routes Pro : BackendAccessQ/src/routes/card_template.routes.js, BackendAccessQ/src/routes/export.routes.js, BackendAccessQ/src/routes/qr.routes.js
- Interface utilisateur : frontendAccessQ/src/app/dashboard/page.jsx, frontendAccessQ/src/app/dashboard/events/[id]/page.jsx, frontendAccessQ/src/app/dashboard/card-templates/page.jsx, frontendAccessQ/src/app/dashboard/upgrade/page.jsx

## Fonctionnalités communes à tous les plans
Ces fonctionnalités restent disponibles avec Free et Pro :
- Gestion des événements
- Gestion des zones/lieux
- Création et consultation des QR codes
- Vérification des QR codes par les agents
- Gestion des agents
- Tableau de bord de base avec statistiques de suivi
- Profil utilisateur et plan affiché dans l’interface

## Plan Free
### Limites principales
- Maximum de 3 événements
- Maximum de 100 QR codes
- Maximum de 4 agents
- Maximum de 4 zones
- Accès au tableau de bord de base, mais certaines actions avancées sont bloquées

### Fonctionnalités disponibles
- Création d’événements de base
- Génération simple de QR codes
- Consultation des données de base
- Gestion de 4 zones et 4 agents maximum
- Accès aux fonctionnalités essentielles de gestion des accès

### Fonctionnalités limitées / bloquées
- Export CSV et PDF avancés : indisponibles
- Imports CSV : indisponibles
- Génération de QR en masse / actions d’import et d’export massifs : indisponibles
- Modèles de cartes personnalisés : création, duplication, publication, modification, suppression et définition par défaut indisponibles
- Ajout de logo ou d’image de fond personnalisée sur les cartes : indisponible
- Publication de templates personnalisés : indisponible
- Actions de publication / personnalisation de modèles : indisponibles
- Fonctionnalités présentées comme “Pro” dans l’interface :
  - Exports avancés
  - Imports CSV et traitements massifs
  - Modèles de cartes personnalisés
  - Agents les plus actifs
  - Activité des scans

## Plan Pro
### Avantages principaux
- Événements illimités
- QR illimités
- Accès aux fonctions avancées de gestion et d’analyse

### Fonctionnalités incluses
- Création d’un nombre illimité d’événements
- Génération d’un nombre illimité de QR codes
- Imports CSV
- Exports CSV et PDF avancés
- Modèles de cartes personnalisés
- Publication, duplication, modification, suppression et définition par défaut des modèles personnalisés
- Ajout de logo et d’image de fond personnalisée
- Actions de publication de templates personnalisés
- Génération et traitements massifs liés aux QR et aux imports/exports
- Analyse avancée de l’activité de scans
- Visualisation des agents les plus actifs
- Meilleur niveau d’exploitation du tableau de bord

## Résumé rapide
- Free : parfait pour une utilisation de base, avec des limites de volume et un accès restreint aux fonctions avancées.
- Pro : adapté aux organisations qui ont besoin d’un usage plus complet, de plus grandes capacités et d’outils d’analyse et de personnalisation.
