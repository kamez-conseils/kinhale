import { create } from 'zustand';

/**
 * Statut courant de la synchronisation côté client. Alimenté par les wrappers
 * `useRelaySync()` et `usePullDelta()` via `useEffect` — aucune persistance
 * (l'état redevient `connected=false, pulling=false` à chaque chargement,
 * les hooks reprennent la main en quelques ms).
 *
 * Consommé par les composants UI (badge de statut, guards offline) qui ne
 * peuvent pas monter `useRelaySync()` eux-mêmes sans dupliquer la connexion
 * WebSocket.
 */
interface SyncStatusState {
  connected: boolean;
  pulling: boolean;
  setConnected: (connected: boolean) => void;
  setPulling: (pulling: boolean) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  connected: false,
  pulling: false,
  setConnected: (connected) => set({ connected }),
  setPulling: (pulling) => set({ pulling }),
}));
