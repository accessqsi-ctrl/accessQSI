# Étude de la documentation pawaPay (API v2) et de l'intégration AccessQ

Étude réalisée le 11/11/2026 à partir de la documentation officielle (docs.pawapay.io, guides v2, référence API v2,
spécification OpenAPI v2, documentation du Dashboard), confrontée au code de `BackendAccessQ` et `AdministrationAccess`.

---

## 1. Fonctionnement de pawaPay en bref

- **API asynchrone.** Un dépôt (encaissement), un reversement (payout) ou un remboursement (refund) est d'abord
  *accepté* ou *rejeté*, puis atteint plus tard son statut final : `COMPLETED` ou `FAILED`.
- **Identifiant fourni par le marchand.** Chaque opération porte un UUIDv4 généré par nous (`depositId`, `payoutId`,
  `refundId`), à enregistrer **avant** l'appel. L'API est idempotente sur cet identifiant : un second envoi renvoie
  `DUPLICATE_IGNORED`.
- **Statut final** connu par callback (URL configurée dans le Dashboard) ou en interrogeant l'endpoint de statut.
  pawaPay recommande les deux : callbacks plus un cycle de revérification.
- **Callbacks.** 8 tentatives sur environ 25 minutes. Seul un `HTTP 200` vaut livraison. Réponse attendue en moins de
  30 s (connexion en moins de 10 s). Renvoi possible pendant 90 jours (API ou Dashboard). Le handler doit être
  idempotent.
- **IP sources des callbacks.** Sandbox : `3.64.89.224`. Production : `18.192.208.15`, `18.195.113.136`,
  `3.72.212.107`, `54.73.125.42`, `54.155.38.214`, `54.73.130.113`.
- **Réconciliation automatique.** Le statut `IN_RECONCILIATION` ne demande aucune action : pawaPay détermine
  lui-même le statut final.
- **Compatibilité.** pawaPay ajoute des champs sans prévenir. Il ne faut pas valider strictement ses réponses
  contre le schéma.

### Statuts

| Opération | À l'initiation | En cours | Final |
| --- | --- | --- | --- |
| Dépôt | `ACCEPTED`, `REJECTED`, `DUPLICATE_IGNORED` | `ACCEPTED`, `PROCESSING`, `IN_RECONCILIATION` | `COMPLETED`, `FAILED` |
| Reversement | idem | `ACCEPTED`, `ENQUEUED`, `PROCESSING`, `IN_RECONCILIATION` | `COMPLETED`, `FAILED` |
| Remboursement | idem | `ACCEPTED`, `ENQUEUED`, `PROCESSING`, `IN_RECONCILIATION` | `COMPLETED`, `FAILED` |

L'endpoint de statut renvoie `FOUND` (avec `data`) ou `NOT_FOUND`. **Seul `NOT_FOUND` permet de conclure qu'une
opération n'est jamais arrivée chez pawaPay.**

### Codes HTTP à l'initiation

| HTTP | Signification | Exemples de `failureCode` | Conduite à tenir |
| --- | --- | --- | --- |
| 200 + `ACCEPTED` / `DUPLICATE_IGNORED` | accepté | – | attendre le statut final |
| 200 + `REJECTED` | refus définitif | `PROVIDER_TEMPORARILY_UNAVAILABLE`, `INVALID_PHONE_NUMBER`, `INVALID_AMOUNT`, `AMOUNT_OUT_OF_BOUNDS`, `INVALID_CURRENCY`, `INVALID_PROVIDER` | marquer en échec |
| 400 + `REJECTED` | requête non conforme | `INVALID_INPUT`, `MISSING_PARAMETER`, `INVALID_PARAMETER`, `UNSUPPORTED_PARAMETER`, `DUPLICATE_METADATA_FIELD` | refus définitif : renvoyer la même requête échouera toujours |
| 401 / 403 | jeton ou droits | `NO_AUTHENTICATION`, `AUTHENTICATION_ERROR`, `AUTHORISATION_ERROR`, `HTTP_SIGNATURE_ERROR`, `DEPOSITS_NOT_ALLOWED`, `PAYOUTS_NOT_ALLOWED`, `REFUNDS_NOT_ALLOWED` | rejeté, problème de configuration |
| 500 | `UNKNOWN_ERROR` | – | **issue incertaine** : interroger le statut, ne conclure à l'échec que sur `NOT_FOUND` |

### Codes d'échec en cours de traitement (à connaître pour le support)

- **Dépôts :** `PAYMENT_NOT_APPROVED` (PIN non saisi), `INSUFFICIENT_BALANCE`, `PAYMENT_IN_PROGRESS`,
  `PAYER_NOT_FOUND` (le numéro n'est pas chez cet opérateur), `PAYER_LIMIT_REACHED`.
- **Reversements :** `RECIPIENT_NOT_FOUND` (le numéro n'est pas chez cet opérateur), `PAWAPAY_WALLET_OUT_OF_FUNDS`
  (wallet AccessQ insuffisant), `MANUALLY_CANCELLED`.
- **Remboursements :** `DEPOSIT_ALREADY_REFUNDED`, `AMOUNT_TOO_LARGE`, `REFUND_IN_PROGRESS`,
  `PAWAPAY_WALLET_OUT_OF_FUNDS`.
- **Tous :** `WALLET_LIMIT_REACHED`, `UNSPECIFIED_FAILURE` (l'opérateur n'a pas donné de raison), `UNKNOWN_ERROR`.

Le `failureMessage` s'adresse à l'équipe, pas au client : AccessQ choisit le message affiché.

---

## 2. Où va l'argent : réservations, frais, wallets

- **Un wallet par pays et par devise** (la RDC a un wallet CDF et un wallet USD). Certains comptes ont des wallets par
  opérateur (champ `provider` non vide).
- **Dépôt :** les frais sont retirés **du montant encaissé** à la complétion. Un abonnement payé 10 USD crédite donc
  le wallet de moins de 10 USD.
- **Reversement :** le montant est **réservé dès l'acceptation**. En cas d'échec, il revient immédiatement. Les
  **frais** sont prélevés sur le wallet **à la complétion**.
- **Remboursement :** prélevé sur le wallet. Remboursements partiels possibles, un seul à la fois par dépôt.
  Sans `amount`, pawaPay rembourse le reste du dépôt.
- **Autres mouvements du wallet :** recharges (*top-ups*), retraits vers la banque (*settlements*), ajustements.

### Endpoints financiers

| Endpoint | Contenu | Utilité pour AccessQ |
| --- | --- | --- |
| `GET /v2/wallet-balances` | solde actuel de chaque wallet (`country`, `currency`, `provider`, `balance`) | **utilisé** depuis le 11/11 (relevé toutes les 5 min, solde réel de la plateforme) |
| `GET /v2/wallet-breakdowns?startDate&endDate` | solde d'ouverture et de clôture, totaux `deposits`, `payouts`, `refunds`, **`fees`**, `topUps`, `withdrawals`, `adjustments` (31 jours max) | **frais réels** et explication exacte de l'écart affiché dans la console |
| `POST /v2/statements` | relevé CSV détaillé d'un wallet (31 jours max, lien valable 1 jour, callback) | audit et comptabilité mensuelle |
| `GET /v2/settlements` | retraits vers la banque : compte, frais bancaires, taux de change | suivi des retraits de la plateforme |

> **Conséquence pour la console.** La colonne « Écart » du tableau *Solde de la plateforme* regroupe les frais
> pawaPay, mais aussi les recharges, les retraits vers la banque et les ajustements. `wallet-breakdowns` permettrait
> de les afficher séparément.

---

## 3. Opérateurs (vérifiés sur la liste officielle)

| Pays | Codes | Décimales | Autorisation des dépôts |
| --- | --- | --- | --- |
| RD Congo (CDF, USD) | `VODACOM_MPESA_COD`, `AIRTEL_COD`, `ORANGE_COD` | M-Pesa CDF : aucune ; les autres : 2 | PIN |
| Cameroun (XAF) | `MTN_MOMO_CMR`, `ORANGE_CMR` | aucune | PIN |
| Congo-Brazzaville (XAF) | `MTN_MOMO_COG`, `AIRTEL_COG` | aucune | PIN |
| Gabon (XAF) | `AIRTEL_GAB`, `MOOV_GAB` | 2 | PIN |
| Côte d'Ivoire (XOF) | `MTN_MOMO_CIV`, `ORANGE_CIV`, `MOOV_CIV`, `WAVE_CIV` | aucune | PIN, **Wave : redirection** |
| Sénégal (XOF) | `ORANGE_SEN`, `FREE_SEN`, `WAVE_SEN` | aucune | PIN, **Wave : redirection** |
| Bénin (XOF) | `MTN_MOMO_BEN`, `MOOV_BEN` | aucune | PIN |
| Burkina Faso (XOF) | `MOOV_BFA`, `ORANGE_BFA` | aucune | PIN, **Orange : OTP préalable** |
| Rwanda (RWF) | `MTN_MOMO_RWA`, `AIRTEL_RWA` | aucune | PIN |
| Zambie (ZMW) | `MTN_MOMO_ZMB`, `AIRTEL_OAPI_ZMB`, `ZAMTEL_ZMB` | 2 | PIN |
| Kenya (KES) | `MPESA_KEN` | dépôts : aucune ; reversements : 2 | PIN |
| Ouganda (UGX) | `MTN_MOMO_UGA`, `AIRTEL_OAPI_UGA` | MTN : 2 ; Airtel : aucune | PIN |
| Tanzanie (TZS) | `VODACOM_TZA`, `AIRTEL_TZA`, `TIGO_TZA`, `HALOTEL_TZA` | Airtel : 2 ; les autres : aucune | PIN |
| Nigeria (NGN) | `MTN_MOMO_NGA`, `AIRTEL_NGA` | MTN : 2 ; Airtel : aucune | PIN |
| Ghana (GHS) | `MTN_MOMO_GHA`, `AIRTELTIGO_GHA`, `VODAFONE_GHA` | 2 | PIN |

pawaPay couvre aussi l'Éthiopie, le Lesotho, le Malawi, le Mozambique, la Sierra Leone et le Zimbabwe, qu'AccessQ ne
propose pas. Les codes de la liste du formulaire de reversement manuel de la console sont conformes (MOOV_CIV et
MOOV_GAB ajoutés le 11/11). La source de vérité reste `GET /v2/active-conf` : il ne liste que les opérateurs activés
sur **notre** compte.

### Ce que `active-conf` renvoie (par opérateur, par devise et par type d'opération)

`decimalsInAmount` (`NONE` ou `TWO_PLACES`), `minTransactionLimit` / `maxTransactionLimit`, `status`
(`OPERATIONAL`, `DELAYED`, `CLOSED`), `authType` (`PROVIDER_AUTH`, `PREAUTH`, `REDIRECT_AUTH`), `pinPrompt`
(`AUTOMATIC` / `MANUAL`), `pinPromptRevivable`, instructions USSD (`pinPromptInstructions`), `callbackUrl`.
Au niveau du compte : `signatureConfiguration`. Au niveau du pays : `prefix`, `flag`, `displayName` en/fr. Au niveau
de l'opérateur : `logo`, `nameDisplayedToCustomer`.

### Recommandations de pawaPay pour la saisie du numéro

- **Ne jamais présélectionner d'opérateur par défaut.** Le client ne voit pas le choix et le paiement part vers le
  mauvais opérateur.
- Utiliser `predict-provider` pour valider et normaliser le numéro, et **préremplir** l'opérateur prédit tout en
  **laissant le client le modifier**. La prédiction n'est pas fiable à 100 %, à cause des numéros portés.

---

## 4. Ce qu'AccessQ fait déjà correctement

- UUID générés et enregistrés avant chaque appel (dépôts, reversements, remboursements).
- Callbacks non crus sur parole : chaque callback déclenche une revérification auprès de pawaPay
  ([api.ticket_payment.controller.js](../BackendAccessQ/src/controllers/api.ticket_payment.controller.js)). Les
  signatures de callback ne sont donc pas indispensables.
- Cycle de revérification chaque minute dans le worker ; une soumission bloquée est revérifiée après 5 minutes.
- Issue réseau incertaine : renvoi avec le même identifiant, ce qui est conforme à l'idempotence de pawaPay.
- Contrôle de cohérence montant / devise / numéro avant d'accepter un statut distant (`applyRemotePayout`).
- `ENQUEUED` et `IN_RECONCILIATION` traités comme « en cours », sans action.
- Champs conformes : `customerMessage` de 4 à 22 caractères alphanumériques (« AccessQ billet », « AccessQ
  reversement »), moins de 10 métadonnées, montants envoyés sans zéro final.
- Liste des opérateurs tirée de `active-conf` (avec liste d'autorisation `PAWAPAY_PROVIDERS`).

---

## 5. Écarts et anomalies trouvés (par priorité)

### 5.1 Haute (corrigé le 11/11/2026) : un refus HTTP 400 ou 403 bloque un reversement ou un remboursement dans une boucle infinie

[organizer_payout.service.js:280-310](../BackendAccessQ/src/services/organizer_payout.service.js#L280-L310) et
[:328-347](../BackendAccessQ/src/services/organizer_payout.service.js#L328-L347) : toute exception levée par l'appel
pawaPay est traitée comme une issue incertaine. Le reversement repasse en `APPROVED` (le remboursement en
« à envoyer ») et il est renvoyé à chaque passage du worker, donc chaque minute. Or un `400` (paramètre invalide) ou
un `403 PAYOUTS_NOT_ALLOWED` / `REFUNDS_NOT_ALLOWED` est un **refus définitif**. La requête échouera toujours :
l'opération reste bloquée, le montant n'est jamais rendu à l'organisateur et les logs se remplissent.

**Correction proposée :** si `error.status` vaut 400 ou 403 et que `error.responseData.status === "REJECTED"`, passer
en échec avec le `failureCode` reçu (ce qui recrédite le solde). Garder le renvoi pour les erreurs réseau, `5xx` et
`401`.

### 5.2 Haute (corrigé le 11/11/2026) : les opérateurs « sans décimales » sont traités comme acceptant 2 décimales

pawaPay renvoie `decimalsInAmount: "NONE"` ou `"TWO_PLACES"`.
[pawapay.service.js:156](../BackendAccessQ/src/services/pawapay.service.js#L156) récupère cette valeur, mais
[policy.js:110](../BackendAccessQ/src/services/payment/policy.js#L110) fait `Number("NONE")`, ce qui donne NaN. La
précision retombe alors sur **2**. Concerné : M-Pesa RDC en CDF, tout le XOF et le XAF (sauf le Gabon), RWF, et
certains opérateurs UGX, TZS, NGN et KES. Un montant comme `1500.50 CDF` partirait chez pawaPay et serait rejeté
(`INVALID_AMOUNT`). Côté abonnements et billets, le prix n'est alors pas arrondi correctement. Côté reversements, le
contrôle des décimales (y compris celui ajouté pour l'opérateur choisi) ne détecte rien.

**Correction proposée :** convertir `NONE` en 0 et `TWO_PLACES` en 2 dans `extractProviders`.

### 5.3 Haute (filtrage fait le 11/11/2026) : Wave (Côte d'Ivoire, Sénégal) et Orange (Burkina Faso) ne sont pas pris en charge mais pas filtrés

- `REDIRECT_AUTH` (Wave) : après l'initiation, il faut récupérer un `authorizationUrl` (`nextStep`) et y rediriger
  le client, avec `successfulUrl` et `failedUrl`. AccessQ ne le fait pas : le paiement reste en attente puis échoue.
- `PREAUTH` (Orange Burkina Faso) : le client doit générer un OTP par USSD avant le paiement, à transmettre dans
  `preAuthorisationCode`. AccessQ ne le demande pas : le paiement est rejeté.

`authorizationType` est lu ([pawapay.service.js:160](../BackendAccessQ/src/services/pawapay.service.js#L160)) mais
n'est utilisé nulle part. pawaPay recommande explicitement d'**exclure les opérateurs dont `authType` n'est pas
`PROVIDER_AUTH`** tant que ces parcours ne sont pas développés. À faire avant toute ouverture en Côte d'Ivoire, au
Sénégal ou au Burkina Faso.

### 5.4 Moyenne : limites de montant non lues

`minTransactionLimit` et `maxTransactionLimit` ne sont pas extraits. Un dépôt hors limites est rejeté
(`AMOUNT_OUT_OF_BOUNDS`). Surtout, **un solde d'organisateur supérieur au plafond de l'opérateur ne pourra jamais
être reversé en une fois** : chaque demande du solde entier échouera. Il faut contrôler les limites à la demande
(message clair, voire découpage en plusieurs reversements).

### 5.5 Moyenne : disponibilité des opérateurs ignorée

`status` (`OPERATIONAL` / `DELAYED` / `CLOSED`) est disponible dans `active-conf` et via `GET /v2/availability`.
- Paiements : masquer ou signaler un opérateur `CLOSED` avant que l'acheteur ne paie.
- Reversements : ne pas envoyer vers un opérateur `CLOSED`, ce qui évite un échec immédiat et un recrédit inutile.
  Prévenir l'organisateur quand c'est `DELAYED` (le reversement sera mis en file d'attente).
- Pour le support : la page de statut publique https://status.pawapay.io, avec abonnement e-mail ou Slack.

### 5.6 Basse : réponses `202` aux callbacks

[api.payment.controller.js:170-216](../BackendAccessQ/src/controllers/api.payment.controller.js#L170-L216) répond
`202` quand la fonctionnalité est désactivée ou que l'opération est inconnue. pawaPay ne considère un callback comme
livré qu'avec un `200` : ces réponses provoquent ses 8 renvois. Ce n'est pas grave (le traitement est idempotent),
mais c'est du bruit. Répondre `200` avec `ignored: true`.

### 5.7 Basse : annulation d'un reversement en file d'attente

Un reversement `ENQUEUED` (opérateur en panne) peut être annulé via `POST /v2/payouts/fail-enqueued/{payoutId}`.
pawaPay renvoie alors un callback `FAILED` / `MANUALLY_CANCELLED`, déjà géré par AccessQ. Un bouton dans la console
permettrait de rendre le montant à l'organisateur sans attendre l'opérateur.

---

## 6. Sécurité

- **Jeton API :** 10 jetons actifs au maximum. pawaPay ne conserve pas le jeton, il faut le stocker soi-même. Révoquer
  un jeton coupe immédiatement tous les paiements qui l'utilisent. Il faut configurer les URLs de callback avant de
  pouvoir générer un jeton.
- **Signatures (optionnelles, RFC 9421) :** en signant les requêtes financières (dépôts, reversements,
  remboursements), on peut demander à pawaPay de refuser toute requête non signée. **Une fuite du jeton ne permet
  alors plus de vider le wallet.** Algorithmes : RSA-PSS SHA-512, RSA PKCS1 v1.5 SHA-256, ECDSA P-256 ou P-384.
  Exemple Node officiel : github.com/PawaPay/signatures-node-example. Recommandé avant la production, puisque les
  reversements sont maintenant automatisés.
- **Callbacks signés (optionnel) :** vérifiables avec les clés publiques (`GET /v2/public-key/http`). Pas
  indispensable pour AccessQ, qui revérifie chaque callback.
- **Liste blanche d'IP** pour les URLs de callback (voir la section 1), si un pare-feu est en place.

---

## 7. Tests en sandbox

- Base `https://api.sandbox.pawapay.io`. Tous les opérateurs y sont disponibles. Aucun PIN n'est demandé en sandbox.
- Numéros de test RDC (Vodacom M-Pesa) :

| Opération | Numéro | Résultat |
| --- | --- | --- |
| Dépôt | 243813456789 | `COMPLETED` |
| Dépôt | 243813456019 / 029 / 039 / 049 / 069 | `PAYER_LIMIT_REACHED` / `PAYER_NOT_FOUND` / `PAYMENT_NOT_APPROVED` / `INSUFFICIENT_BALANCE` / `UNSPECIFIED_FAILURE` |
| Dépôt / reversement | 243813456129 | reste en `SUBMITTED` (test du cycle de revérification) |
| Reversement | 243813456789 | `COMPLETED` |
| Reversement | 243813456089 / 119 | `RECIPIENT_NOT_FOUND` / `UNSPECIFIED_FAILURE` |

Les numéros des autres pays : https://docs.pawapay.io/v2/docs/test_numbers.

---

## 8. Mise en production : liste de contrôle

1. `PAWAPAY_ENVIRONMENT=production` et jeton de production. Ce sont les seules différences avec la sandbox.
2. URLs de callback configurées dans le Dashboard de production : dépôts, reversements, remboursements.
3. Liste blanche des IP de production si un pare-feu est en place.
4. Points 5.1, 5.2 et 5.3 corrigés le 11/11/2026 ; traiter au moins 5.4 (plafonds) avant d'ouvrir les reversements à de gros soldes.
5. Tests réels avec un vrai téléphone par opérateur utilisé (wallet actif et approvisionné, PIN à saisir dans les
   1 à 20 s). pawaPay recommande un drapeau de fonctionnalité pour tester en production avant l'ouverture.
6. Alimenter le wallet pour les reversements et remboursements : recharge depuis le Dashboard (Finances > Wallets).
7. Activer les signatures des requêtes financières (section 6).
8. S'abonner à https://status.pawapay.io pour les pays ouverts.

---

## 9. Plan d'action proposé

| # | Action | Effort |
| --- | --- | --- |
| 1 | ~~Refus `400` / `403` à l'initiation → échec définitif (reversements et remboursements)~~ fait | faible |
| 2 | ~~Conversion `decimalsInAmount` `NONE` / `TWO_PLACES` → 0 / 2~~ fait | faible |
| 3 | ~~Exclure les opérateurs `PREAUTH` / `REDIRECT_AUTH` des listes de paiement~~ fait | faible |
| 4 | Lire `minTransactionLimit` / `maxTransactionLimit` et contrôler les montants (dépôts et reversements) | moyen |
| 5 | Lire `status` (disponibilité) : masquer `CLOSED`, prévenir `DELAYED` | moyen |
| 6 | Répondre `200` à tous les callbacks traités ou ignorés | faible |
| 7 | Console : frais réels via `wallet-breakdowns` à la place de l'« écart » global | moyen |
| 8 | Signatures des requêtes financières | moyen |
| 9 | Console : bouton « annuler » pour un reversement `ENQUEUED` | faible |
| 10 | (Plus tard) Parcours Wave (redirection) et Orange Burkina Faso (OTP) | élevé |

---

## Sources

- Guides v2 : https://docs.pawapay.io/v2/docs/what_to_know, `deposits`, `payouts`, `refunds`, `providers`,
  `failure_codes`, `signatures`, `test_numbers`, `going_live`
- Référence API v2 et OpenAPI : https://docs.pawapay.io/v2/api-reference/openapi_v2.yaml
- Finances : https://docs.pawapay.io/v2/api-reference/finances/wallet-balances, `wallet-breakdowns`,
  `initiate-statement`, `settlements`
- Dashboard : https://docs.pawapay.io/dashboard/finances/statements, `other/system_conf/api_tokens`,
  `other/system_conf/callback_urls`
- Index complet : https://docs.pawapay.io/llms.txt
