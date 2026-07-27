# Roadmap Free/Pro — prompts de livraison par étapes

Ce document regroupe une roadmap complète pour transformer AccessQ en version Free/Pro, sous forme de prompts prêts à être transmis partie par partie à l’agent de développement.

Objectif global :
- séparer clairement les fonctionnalités entre une offre Free et une offre Pro,
- verrouiller l’accès au niveau backend,
- masquer les fonctionnalités Pro au niveau frontend,
- garder une expérience simple et évolutive.

## Hypothèse de base

Le projet possède déjà une base de plan dans le modèle Prisma avec la relation organisation → plan. Le backend et le frontend sont déjà bien séparés, ce qui permet une implémentation progressive.

## Phase 1 — Fondation du modèle de plan

Prompt 1 :

Implémente la base de la logique Free/Pro dans le backend. Ajoute une logique de plan pour l’organisation, avec au minimum deux niveaux : FREE et PRO. Utilise le modèle Prisma existant et la relation organisation/plan comme base. Crée une structure simple de constantes de plan et de limites, avec un mécanisme permettant de vérifier si une organisation est Free ou Pro. Le code doit être propre, centralisé et prêt à être réutilisé par les middlewares et les contrôleurs.

Livrables attendus :
- constantes de plan et limites,
- helper de vérification du plan,
- structure prête pour les contrôles backend.

---

## Phase 2 — Middleware de protection backend

Prompt 2 :

Ajoute un middleware backend qui bloque les routes Pro selon le plan de l’organisation. Le middleware doit vérifier le plan de l’utilisateur connecté et refuser l’accès aux routes réservées à la version Pro avec une réponse JSON claire, par exemple : 403 avec un message indiquant que la fonctionnalité nécessite un abonnement Pro. Le middleware doit être réutilisable sur les routes concernées, sans casser les routes Free.

Routes à protéger en priorité :
- génération en masse de QR,
- import CSV,
- templates personnalisés de cartes,
- exports avancés PDF/CSV,
- dashboard analytique avancé si nécessaire.

---

## Phase 3 — Limites Free/Pro sur la gestion des QR

Prompt 3 :

Implémente la logique Free/Pro pour la gestion des QR codes. En version Free, l’organisation doit pouvoir générer un nombre limité de QR (100), tandis qu’en version Pro, la génération doit être illimitée. Ajoute une vérification avant la création des QR pour empêcher la génération au-delà de la limite Free. Si la limite est atteinte, retourne une errun message explicite et propose une mise à niveau vers Pro.

Comportements attendus :
- limite configurable,
- message utilisateur clair,
- garde-fou côté backend.

---

## Phase 4 — Limites Free/Pro sur les événements

Prompt 4 :

Ajoute des limites Free/Pro sur la gestion des événements. En version Free, l’organisation ne doit pouvoir créer qu’un nombre restreint d’événements, 3. En version Pro, les événements doivent être illimités. Vérifie cette limite au moment de la création d’un événement et renvoie un message propre si la limite est dépassée et invite a passer au pro.

Livrables attendus :
- vérification côté backend,
- message utilisateur adapté,
- prise en charge propre des erreurs.

---

## Phase 5 — Protection des templates de cartes personnalisées

Prompt 5 :

Implémente la séparation Free/Pro pour les templates de cartes. En version Free, l’utilisateur ne doit pouvoir utiliser que les templates standards par défaut. En version Pro, il doit pouvoir créer, modifier, dupliquer, publier et personnaliser ses propres templates. Bloque l’accès aux routes de création / modification / duplication / publication de templates personnalisés si l’organisation est en Free.

Livrables attendus :
- routes protégées,
- comportement cohérent avec le plan,
- message de restriction Pro.

---

## Phase 6 — Protection des exports avancés

Prompt 6 :

Ajoute la restriction Free/Pro sur les exports. En version Free désactivé. En version Pro, l’export CSV/PDF complet doit rester disponible. Protège les routes d’export correspondantes côté backend avec une vérification du plan de l’organisation.

Livrables attendus :
- protection des routes d’export,
- message explicite pour les utilisateurs Free,
- respect du plan côté API.

---

## Phase 7 — Exposition du plan au frontend

Prompt 7 :

Expose le plan utilisateur au frontend via l’API de profil. Le frontend doit recevoir l’information du plan de l’organisation et l’utiliser pour adapter l’interface. Ajoute au profil utilisateur ou à une route dédiée les informations suivantes : plan, nom du plan, limites associées, statut Pro/Free.

Livrables attendus :
- retour du plan dans l’API,
- structure propre pour le frontend,
- pas de rupture avec l’existant.

---

## Phase 8 — Masquage des fonctionnalités Pro côté frontend

Prompt 8 :

Adapte le frontend pour afficher ou masquer les fonctionnalités selon le plan de l’utilisateur. Si l’utilisateur est en Free, grise les écrans et boutons liés aux fonctionnalités Pro, comme : import CSV, modèles personnalisés, exports avancés, analytics avancés, génération de QR en masse. Si l’utilisateur est en Pro, l’interface reste complète. Ajoute une bannière pour inviter à passer en Pro.

Livrables attendus :
- interface adaptée au plan,
- UX claire,
- pas de bouton Pro visible dans la version Free si nécessaire.

---

## Phase 9 — UX d’upgrade et page de plan

Prompt 9 :

Crée une expérience d’upgrade propre pour la version Pro. Ajoute une page ou un composant de présentation des avantages Pro, avec une liste claire de fonctionnalités disponibles en Pro et un bouton d’action vers la conversion. Cette page doit s’intégrer à l’interface de dashboard existante sans casser l’expérience actuelle.

Livrables attendus :
- page de présentation Pro,
- contenu clair et moderne,
- intégration dans le layout du dashboard.

---

## Phase 10 — Tests et validation

Prompt 10 :

Ajoute des tests de validation de la logique Free/Pro. Écris des tests pour vérifier que :
- une organisation Free ne peut pas dépasser la limite de QR,
- une organisation Free ne peut pas créer plus d’événements que la limite autorisée,
- une organisation Free ne peut pas accéder aux routes Pro protégées,
- une organisation Pro peut accéder aux fonctionnalités autorisées.

Livrables attendus :
- tests backend pertinents,
- couverture minimale des règles Free/Pro,
- stabilité du comportement.

---

## Phase 11 — Déploiement et configuration

Prompt 11 :

Prépare la mise en production de la logique Free/Pro. Ajoute la configuration nécessaire pour que les plans soient correctement initialisés en base, avec des valeurs par défaut cohérentes. Documente les variables d’environnement et les règles de plan à appliquer. Assure que l’application fonctionne correctement avec une première organisation Free par défaut et une organisation Pro si elle est configurée.

---

## Phase 12 — Version finale et nettoyage

Prompt 12 :

Refine l’implémentation Free/Pro pour qu’elle soit propre, maintenable et prête à être commercialisée. Vérifie la cohérence entre backend, frontend, messages utilisateur et logique de quotas. Supprime les chemins de logique ambiguë, centralise la gestion des limites et prépare une version production stable.

---

## Recommandation de livraison progressive

Pour avancer proprement, je recommande d’implémenter dans cet ordre :
1. logique de plan et middleware,
2. limites QR et événements,
3. protection templates et exports,
4. frontend d’affichage des plans,
5. page d’upgrade,
6. tests et stabilisation.

Cette séquence permet de livrer une version fonctionnelle rapidement, sans casser l’architecture existante.
