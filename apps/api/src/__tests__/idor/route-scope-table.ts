/**
 * Classification **exhaustive** de chaque route exposée par le relais
 * (E9-S08, KIN-087, RM11 isolation foyer).
 *
 * Chaque route doit être classée dans un scope :
 *
 * - `public` : accessible sans JWT (endpoint d'authentification / santé).
 *   Aucun test IDOR appliqué (par définition).
 * - `self_scoped` : ressource attachée au `sub` (accountId) du JWT. Un
 *   token de compte A ne doit JAMAIS pouvoir lire/modifier la ressource du
 *   compte B.
 * - `household_scoped` : ressource indexée par `householdId`. Un token du
 *   foyer A ne doit JAMAIS voir / toucher les données du foyer B.
 * - `caregiver_invite` : endpoint public d'acceptation d'invitation (PIN
 *   + consentement). Authentifié par le token URL + PIN, pas par JWT —
 *   testé séparément par `invitations.test.ts`.
 * - `step_up_only` : endpoint authentifié par un **token step-up** (pas
 *   un JWT de session). Ex : `/me/account/deletion-confirm` reçoit un
 *   hash de magic link, pas un JWT d'accès.
 * - `websocket` : upgrade WS authentifié par JWT via query string. Testé
 *   séparément par `relay.test.ts` (pas de sémantique REST).
 *
 * **Règle d'or** : toute nouvelle route ajoutée au relais DOIT apparaître
 * dans cette table. Le test `anti-idor.test.ts` croise cette table avec
 * `app.printRoutes()` et échoue si un endpoint est oublié.
 *
 * Refs: KIN-087, E9-S08, RM11.
 */

export type RouteScope =
  | 'public'
  | 'self_scoped'
  | 'household_scoped'
  | 'caregiver_invite'
  | 'step_up_only'
  | 'websocket';

/**
 * Clé canonique : `METHOD PATH`, méthode en majuscule, path avec
 * placeholders Fastify (`:token`, `:id`, etc.).
 *
 * Pour une ligne Fastify qui expose plusieurs méthodes (`GET, HEAD`), on
 * liste une entrée par méthode (`HEAD` étant dérivé, on le map sur `GET`
 * dans l'extracteur de routes).
 */
export const ROUTE_SCOPE_TABLE: Record<string, RouteScope> = {
  // --- Auth / santé (public) --------------------------------------------
  'GET /health': 'public',
  'POST /auth/magic-link': 'public',
  'GET /auth/verify': 'public',
  'POST /auth/register-device': 'self_scoped',

  // --- Audit (self-scoped — clés `accountId = sub`) ---------------------
  'POST /audit/report-generated': 'self_scoped',
  'POST /audit/report-shared': 'self_scoped',
  'POST /audit/privacy-export': 'self_scoped',

  // --- Relais WS + catchup (household-scoped) ---------------------------
  // WebSocket upgrade — skippé par le test REST (auth WS dédiée).
  'GET /relay': 'websocket',
  'GET /relay/catchup': 'household_scoped',

  // --- Sync batch (household-scoped) ------------------------------------
  'POST /sync/batch': 'household_scoped',

  // --- Push tokens (self-scoped, device appartient au compte JWT) -------
  'POST /push/register-token': 'self_scoped',
  'DELETE /push/register-token': 'self_scoped',

  // --- Invitations ------------------------------------------------------
  // Liste + création : household-scoped (admin voit les invits de son foyer).
  'POST /invitations': 'household_scoped',
  'GET /invitations': 'household_scoped',
  // Lookup par token : public (aidant cible n'a que le token URL + PIN).
  'GET /invitations/:token': 'caregiver_invite',
  'POST /invitations/:token/accept': 'caregiver_invite',
  // Révocation par l'admin : household-scoped (on vérifie rec.householdId).
  'DELETE /invitations/:token': 'household_scoped',

  // --- Notifications (self-scoped) --------------------------------------
  'POST /notifications/missed-dose-email': 'self_scoped',

  // --- Préférences + quiet hours (self-scoped) --------------------------
  'GET /me/notification-preferences': 'self_scoped',
  'PUT /me/notification-preferences': 'self_scoped',
  'GET /me/quiet-hours': 'self_scoped',
  'PUT /me/quiet-hours': 'self_scoped',

  // --- Privacy / portabilité (self-scoped) ------------------------------
  'GET /me/privacy/export/metadata': 'self_scoped',

  // --- Suppression de compte --------------------------------------------
  'POST /me/account/deletion-request': 'self_scoped',
  'POST /me/account/deletion-confirm': 'step_up_only',
  'POST /me/account/deletion-cancel': 'self_scoped',
  'GET /me/account/deletion-status': 'self_scoped',
};

/**
 * Méthodes à ignorer lors de l'extraction des routes Fastify — dérivées
 * ou non-REST (`HEAD` est dérivé de `GET`, `OPTIONS` est géré par le CORS).
 */
export const METHODS_TO_IGNORE: ReadonlySet<string> = new Set(['HEAD', 'OPTIONS']);

/**
 * Clé canonique `METHOD PATH` à partir d'un couple. Utilisé par le test
 * pour croiser `app.printRoutes()` avec la table de classification.
 */
export function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
