/**
 * Mock du sous-chemin `@kinhale/sync/client` pour les tests Jest côté mobile.
 *
 * Le pipeline E2EE réel (libsodium + Automerge) est lent et dépendant du
 * runtime natif. Les tests applicatifs se contentent d'un stub qui retourne
 * un hook inerte : c'est le package `@kinhale/sync` lui-même qui couvre la
 * logique du hook via ses propres tests vitest (KIN-039).
 */
export const getGroupKey = jest.fn(async () => new Uint8Array(32).fill(1));
export const _resetGroupKeyCache = jest.fn();
export const useRelaySync = jest.fn(() => ({ connected: false }));
