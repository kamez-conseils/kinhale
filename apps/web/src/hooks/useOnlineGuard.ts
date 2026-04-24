'use client';

import { useSyncStatusStore } from '../stores/sync-status-store';

/**
 * Garde-fou offline : retourne `{ online }` pour que les écrans qui
 * nécessitent obligatoirement une connexion (invitation aidant, création
 * plan, édition enfant) puissent désactiver leurs CTA et afficher un
 * message explicatif. Refs: KIN-78 / E7-S08.
 */
export function useOnlineGuard(): { online: boolean } {
  const online = useSyncStatusStore((s) => s.connected);
  return { online };
}
