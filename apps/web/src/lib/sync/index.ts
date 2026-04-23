'use client';

import { useRelaySync as useRelaySyncCore, getGroupKey } from '@kinhale/sync/client';
import { createRelayClient } from '../relay-client';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';

/**
 * Wrapper applicatif web qui injecte les dépendances plateforme dans le hook
 * mutualisé `@kinhale/sync/client`.
 *
 * Le hook sous-jacent est framework-agnostique : il ne connaît ni le WebSocket
 * du navigateur, ni les stores Zustand de cette app. Ce wrapper fournit :
 * - les hooks Zustand (useAuthStore / useDocStore)
 * - la factory WebSocket DOM (createRelayClient)
 * - la dérivation groupKey (Argon2id cachée côté client)
 *
 * Le pragma `'use client'` est requis par Next.js pour que le module soit
 * bundlé côté client — le package `@kinhale/sync` ne porte pas ce pragma car
 * il est aussi consommé par mobile.
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
 * À inclure dans les Providers ou dans le layout racine, à l'intérieur du
 * périmètre client.
 */
export function RelaySyncBootstrap(): null {
  useRelaySync();
  return null;
}
