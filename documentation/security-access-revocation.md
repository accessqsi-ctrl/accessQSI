# Révocation des accès AccessQ

## Modèle d'état

- `is_active = false` suspend un compte ou une organisation de manière réversible.
- `deleted_at` représente un archivage logique et ne doit pas être utilisé comme simple bouton de suspension.
- Une organisation inactive bloque tous ses membres sans modifier leurs états individuels. Une réactivation restaure ainsi exactement la situation antérieure.
- Un agent ne peut être réactivé que si son organisation est active, s'il n'est ni archivé ni suspendu par son plan, et si le quota d'agents actifs le permet.

## Sessions et API

Chaque requête API authentifiée relit l'état courant du compte et de l'organisation. Un access token valide cryptographiquement est rejeté si le compte ou l'organisation a été suspendu, archivé ou si le rôle porté par le token est devenu obsolète. Le refresh token applique la même vérification et ne peut donc pas prolonger une session révoquée.

Les actions de la console d'administration sont protégées par authentification, autorisation `SUPER_ADMIN`, cookies `HttpOnly`/`SameSite`, jetons CSRF et limitation des tentatives de connexion. Les journaux de sécurité utilisent uniquement les identifiants techniques nécessaires à la traçabilité.

## Cadre de protection des données

Ces mesures soutiennent la minimisation, la limitation de conservation, la protection dès la conception et la sécurité du traitement prévues par les articles 5, 25 et 32 du RGPD. Elles ne suffisent pas, à elles seules, à déclarer une conformité juridique complète : la durée de conservation, la procédure d'effacement, l'information des personnes, la gestion des droits et l'analyse des risques doivent être définies par le responsable du traitement.

Références : [Règlement (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
