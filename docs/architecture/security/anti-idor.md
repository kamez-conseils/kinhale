# Pattern anti-IDOR multi-tenant (RM11)

**Statut** : en vigueur depuis KIN-087 (E9-S08).
**Ticket** : [KIN-087](../../product/backlog.md) — Verrouillage sécurité conformité.

## Contexte

Le relais Kinhale expose une API REST + WebSocket pour des foyers
multi-aidants. Le modèle de menace (ADR-D12) identifie le risque **IDOR**
(Insecure Direct Object Reference) : un foyer A qui récupère, modifie ou
supprime une ressource du foyer B en forgeant un identifiant.

La défense de base repose sur la pratique **« JWT comme source de vérité
d'authz »** : chaque route authentifiée lit son `sub` / `householdId` /
`deviceId` du token JWT vérifié, jamais du body ni de la query. Le fichier
`apps/api/src/plugins/jwt.ts` expose l'interface `SessionJwtPayload`.

Ce guide complète la pratique par une **couche de test automatisée** qui
durcit structurellement la garantie.

## Mécanisme

### 1. Classification obligatoire dans `ROUTE_SCOPE_TABLE`

Fichier : `apps/api/src/__tests__/idor/route-scope-table.ts`.

Chaque route exposée par le relais doit être classée dans l'une des scopes :

| Scope              | Sémantique                                                                                           |
|--------------------|------------------------------------------------------------------------------------------------------|
| `public`           | Accessible sans JWT (ex : `/health`, `/auth/magic-link`).                                            |
| `self_scoped`      | Ressource liée au `sub` (accountId) du JWT. Un token de A ne peut pas toucher la ressource de B.     |
| `household_scoped` | Ressource liée au `householdId` du JWT. Isolation par foyer.                                         |
| `caregiver_invite` | Endpoint public d'acceptation d'invitation (PIN + consentement), authentifié par token URL + PIN.    |
| `step_up_only`     | Endpoint authentifié par un **token step-up** (magic link), pas un JWT (ex : `/deletion-confirm`).   |
| `websocket`        | Upgrade WS authentifié via JWT en query string ; testé séparément (`relay.test.ts`).                 |

### 2. Guard de couverture structurelle

Le test `apps/api/src/__tests__/idor/anti-idor.test.ts` collecte toutes les
routes Fastify au runtime via le hook `onRoute` et vérifie que **chaque
route apparaît dans `ROUTE_SCOPE_TABLE`**. Si un contributeur ajoute une
nouvelle route sans la classer, le test CI échoue avec un message
explicite :

```
Routes non classifiées — ajouter la ou les entrées suivantes dans
ROUTE_SCOPE_TABLE :
  GET /me/new-endpoint
```

Symétriquement, si une route est supprimée sans nettoyer la table, le
test détecte l'entrée orpheline.

### 3. Test de non-fuite inter-foyer

Pour chaque entrée `self_scoped` ou `household_scoped`, le test :

1. Forge un JWT du foyer B (`ACCOUNT_B`, `HOUSEHOLD_B`, `DEVICE_B`).
2. Appelle l'endpoint avec un body / query qui tente **explicitement** de
   référencer la ressource de A (ex : `accountId: ACCOUNT_A` dans le body
   d'un audit event).
3. Vérifie :
   - Pas de réponse 500 (aucune régression serveur).
   - Pas de réponse 401 (le JWT de B est valide — si 401, c'est une
     fausse alerte de test mal forgé).
   - **La réponse ne contient JAMAIS** `ACCOUNT_A`, `HOUSEHOLD_A`,
     `DEVICE_A` dans son payload. Si une route oublie de filtrer et
     renvoie la ressource de A, le test attrape la fuite.

### 4. Test d'authentification obligatoire

Pour chaque route non `public`, le test sans header `Authorization`
attend un **401 systématique**. Assure que `preHandler: [app.authenticate]`
est bien branché.

## Ajouter un nouvel endpoint

1. Implémenter la route dans `apps/api/src/routes/*.ts`.
2. Ajouter `preHandler: [app.authenticate]` sauf si la route est
   intentionnellement publique.
3. Lire `sub`, `deviceId`, `householdId` **uniquement** depuis
   `request.user as SessionJwtPayload` — ne jamais les accepter dans le
   body ou la query.
4. Classer la route dans `ROUTE_SCOPE_TABLE` :
   ```ts
   'POST /me/new-endpoint': 'self_scoped',
   ```
5. Si la route accepte un body, étendre `buildBodyFor` dans
   `anti-idor.test.ts` pour fournir un payload minimal Zod-valide.
6. Lancer `pnpm test src/__tests__/idor` — les 40+ sous-tests doivent
   passer.

## Limites connues

- Le test est **black-box** : il vérifie que la réponse ne contient pas
  d'ID du foyer A, pas que la SQL WHERE est correcte. Pour les routes qui
  ne retournent jamais d'ID (`POST` sans body retourné, 204), le test
  vérifie surtout le status code et la non-crash.
- Les routes `websocket`, `caregiver_invite` et `step_up_only` ne sont
  pas couvertes par la boucle IDOR principale — elles ont leur propre
  suite de tests dédiés (voir `relay.test.ts`, `invitations.test.ts`,
  `account-deletion.test.ts`).
- Un test d'IDOR complet **en base réelle** nécessiterait de lancer
  PostgreSQL + de seeder les 2 foyers. Le trade-off actuel est de ne
  charger que les mocks DB : cela suffit pour attraper les régressions
  structurelles (champ manquant dans le WHERE, confiance au body), pas
  pour détecter des problèmes de politique de réplication Postgres, qui
  sortent du scope KIN-087.

## Refs

- KIN-087 / E9-S08 — Ticket d'origine.
- RM11 — Isolation stricte par foyer (voir `docs/product/SPECS.md`).
- ADR-D12 — Sécurité zero-knowledge du relais.
- `apps/api/src/plugins/jwt.ts` — Plugin `authenticate`.
- `apps/api/src/__tests__/idor/` — Suite de tests.
