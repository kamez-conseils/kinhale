/**
 * Stub Jest mobile du sous-chemin `@kinhale/sync/client`.
 *
 * - Désactive `useRelaySync` en test Jest mobile : renvoie `{ connected: false }`.
 * - La logique du hook est entièrement testée dans
 *   `packages/sync/src/client/__tests__/` (vitest + jsdom), donc inutile de la
 *   rejouer ici.
 * - Cette désactivation évite la complexité de mocker WebSocket / crypto /
 *   stores en environnement jsdom côté mobile.
 * - Couverture d'intégration RN réelle à compenser en e2e Maestro (ticket de
 *   suivi Sprint 5-6).
 */
export const getGroupKey = jest.fn(async () => new Uint8Array(32).fill(1));
export const _resetGroupKeyCache = jest.fn();
export const useRelaySync = jest.fn(() => ({
  connected: false,
  sendPing: jest.fn(),
}));

// KIN-040 : helpers télémétrie exposés par `@kinhale/sync/client`.
// Stubs inertes : la logique réelle est testée dans packages/sync.
export const classifyDecryptError = jest.fn(() => 'unknown');
export const createDecryptFailedReporter = jest.fn(() => ({
  track: jest.fn(),
  flush: jest.fn(),
}));

// KIN-082 : watcher peer_ping. Stub inerte — la logique réelle est testée
// dans `packages/sync/src/client/__tests__/usePeerDosePing.test.tsx`.
export const usePeerDosePing = jest.fn();
