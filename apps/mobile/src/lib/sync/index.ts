import {
  useRelaySync as useRelaySyncCore,
  getGroupKey,
  type DecryptFailedEvent,
} from '@kinhale/sync/client';
import { blake2bHex } from '@kinhale/crypto';
import { createRelayClient } from '../relay-client';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';

/**
 * Sel applicatif utilisé pour pseudonymiser les `householdId` dans les
 * événements de télémétrie. **Ce n'est pas un secret crypto** : sa seule
 * fonction est d'empêcher un reverse-lookup par rainbow table côté Sentry /
 * CloudWatch si les digests venaient à fuiter. Le sel peut être journalisé
 * sans conséquence sur la confidentialité des données santé.
 *
 * En prod, `EXPO_PUBLIC_KINHALE_APP_SECRET` doit être défini via EAS
 * (valeur spécifique à l'environnement). Fallback dev stable pour tests
 * locaux / Expo Go.
 *
 * Refs: KIN-040.
 */
const APP_SECRET = process.env['EXPO_PUBLIC_KINHALE_APP_SECRET'] ?? 'dev-secret-v1';

if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') {
  if (process.env['EXPO_PUBLIC_KINHALE_APP_SECRET'] === undefined) {
    console.warn(
      '[kinhale.sync] EXPO_PUBLIC_KINHALE_APP_SECRET absent en prod — pseudonymisation avec fallback dev.',
    );
  }
}

/**
 * Pré-calcule et met en cache le digest BLAKE2b keyed d'un `householdId`.
 * Voir wrapper web pour la stratégie placeholder synchrone pendant le premier
 * appel libsodium asynchrone.
 */
const pseudonymCache = new Map<string, string>();
const pendingPromises = new Map<string, Promise<string>>();

function fnv1aHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function hashHousehold(householdId: string): string {
  const cached = pseudonymCache.get(householdId);
  if (cached !== undefined) return cached;

  if (!pendingPromises.has(householdId)) {
    const promise = blake2bHex(householdId, APP_SECRET).then((digest) => {
      pseudonymCache.set(householdId, digest);
      pendingPromises.delete(householdId);
      return digest;
    });
    pendingPromises.set(householdId, promise);
  }

  return `pending-${fnv1aHash(householdId)}`;
}

/**
 * Rapporteur v1.0 : log local pseudonymisé. Sera remplacé par une intégration
 * Sentry RN dans une PR ultérieure (hors scope KIN-040).
 *
 * @see DecryptFailedEvent — schéma figé, aucune donnée santé n'y transite.
 */
function reportDecryptFailed(event: DecryptFailedEvent): void {
  // eslint-disable-next-line no-console -- événement ops pseudonymisé, pas de donnée santé
  console.info('[kinhale.sync]', event);
}

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
 * - la pseudonymisation + rapporteur télémétrie (KIN-040)
 *
 * Pas de pragma `'use client'` côté mobile : React Native n'a pas de distinction
 * serveur/client comme Next.js.
 *
 * Refs: KIN-039, KIN-040
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
    platform: 'mobile',
    hashHousehold,
    reportDecryptFailed,
  });
}

// Composant shell applicatif (3 lignes). Intentionnellement dupliqué web/mobile
// — le pragma 'use client' côté web diverge structurellement, factoriser
// apporterait du sur-nivelage sans gain. Voir KIN-039 (commit df5fa5f).
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
