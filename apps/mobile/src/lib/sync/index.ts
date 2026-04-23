import { useRelaySync as useRelaySyncCore, getGroupKey } from '@kinhale/sync/client';
import { createRelayClient } from '../relay-client';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';

/**
 * Wrapper applicatif mobile qui injecte les dépendances plateforme dans le
 * hook mutualisé `@kinhale/sync/client`.
 *
 * Le hook sous-jacent est framework-agnostique : il ne connaît ni le WebSocket
 * natif React Native, ni les stores Zustand de cette app. Ce wrapper fournit :
 * - les hooks Zustand (useAuthStore / useDocStore)
 * - la factory WebSocket RN (createRelayClient — s'appuie sur le WS polyfillé
 *   par Expo / Hermes)
 * - la dérivation groupKey (Argon2id cachée côté client)
 *
 * Pas de pragma `'use client'` côté mobile : React Native n'a pas de distinction
 * serveur/client comme Next.js.
 *
 * Refs: KIN-039
 */
export function useRelaySync(): { connected: boolean } {
  return useRelaySyncCore({
    useAccessToken: () => useAuthStore((s) => s.accessToken),
    useDeviceId: () => useAuthStore((s) => s.deviceId),
    useHouseholdId: () => useAuthStore((s) => s.householdId),
    useDoc: () => useDocStore((s) => s.doc),
    getDocSnapshot: () => useDocStore.getState().doc,
    useReceiveChanges: () => useDocStore((s) => s.receiveChanges),
    createRelayClient,
    deriveGroupKey: getGroupKey,
  });
}

/**
 * Composant sans rendu visible qui monte la sync WS bidirectionnelle E2EE
 * en arrière-plan dès que l'utilisateur est authentifié et que le doc est
 * initialisé.
 *
 * À inclure dans les Providers ou dans le layout racine.
 */
export function RelaySyncBootstrap(): null {
  useRelaySync();
  return null;
}
