'use client';

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
 * En prod, `NEXT_PUBLIC_KINHALE_APP_SECRET` doit être défini (valeur spécifique
 * à l'environnement). Fallback dev stable pour tests locaux.
 *
 * Refs: KIN-040.
 */
const APP_SECRET_FALLBACK_DEV = 'dev-secret-v1';
const APP_SECRET = process.env['NEXT_PUBLIC_KINHALE_APP_SECRET'] ?? APP_SECRET_FALLBACK_DEV;

if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') {
  if (process.env['NEXT_PUBLIC_KINHALE_APP_SECRET'] === undefined) {
    // On continue avec le fallback dev plutôt que de casser la sync ; le
    // pseudonyme reste non-réversible pour un tiers sans accès au dictionnaire
    // complet des householdId possibles.
    console.warn(
      '[kinhale.sync] NEXT_PUBLIC_KINHALE_APP_SECRET absent en prod — pseudonymisation avec fallback dev.',
    );
  } else if (APP_SECRET === APP_SECRET_FALLBACK_DEV) {
    // Détecte un APP_SECRET défini mais laissé à la valeur dev : pseudonymes
    // corrélables entre environnements (dev/preview/prod partagent le même sel).
    console.warn(
      '[kinhale.sync] APP_SECRET not configured in production, pseudonyms are correlable across environments',
    );
  }
}

/**
 * Pré-calcule et met en cache le digest BLAKE2b keyed d'un `householdId`.
 *
 * Le reporter de télémétrie est synchrone (signature `(id: string) => string`)
 * mais `blake2bHex` est asynchrone (libsodium). Stratégie :
 * - Au premier appel, on déclenche le hash async en arrière-plan et on
 *   retourne un placeholder JS court-hash (FNV-1a) pour conserver la
 *   séparation par foyer dans les 1-2 tout premiers événements.
 * - Dès que le digest libsodium est disponible, il remplace le placeholder
 *   pour tous les appels suivants (cache process-local).
 * Exporté pour tests unitaires ; pas d'API publique.
 */
const pseudonymCache = new Map<string, string>();
const pendingPromises = new Map<string, Promise<string>>();

// FNV-1a 32 bits : ~65k collisions attendues sur 1M foyers. Suffisant comme
// identifiant corrélant court (fenêtre < 1ms avant BLAKE2b async). Non utilisé
// pour du contrôle d'intégrité.
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
    const promise = blake2bHex(householdId, APP_SECRET)
      .then((digest) => {
        pseudonymCache.set(householdId, digest);
        pendingPromises.delete(householdId);
        return digest;
      })
      .catch((err: unknown) => {
        // Si libsodium échoue à charger, on reste sur le placeholder FNV-1a.
        // On log uniquement le nom d'erreur (pas .message ni .stack) pour
        // éviter toute fuite de contexte sensible dans les logs.
        const name = err instanceof Error ? err.name : 'UnknownError';
        console.warn(
          '[kinhale.sync] blake2b async load failed, staying on FNV-1a placeholder',
          name,
        );
        pendingPromises.delete(householdId);
        // Retourne le placeholder pour satisfaire la Promise<string>.
        return `pending-${fnv1aHash(householdId)}`;
      });
    pendingPromises.set(householdId, promise);
  }

  // Placeholder FNV-1a : pas d'identité utilisateur en sortie, juste une
  // empreinte JS courte qui préserve l'isolation par foyer. Remplacé par
  // le vrai digest libsodium dès qu'il est prêt (cf. pendingPromises).
  return `pending-${fnv1aHash(householdId)}`;
}

/**
 * Rapporteur v1.0 : log local pseudonymisé. Sera remplacé par une intégration
 * Sentry dans une PR ultérieure (hors scope KIN-040).
 *
 * @see DecryptFailedEvent — schéma figé, aucune donnée santé n'y transite.
 */
function reportDecryptFailed(event: DecryptFailedEvent): void {
  // eslint-disable-next-line no-console -- événement ops pseudonymisé, pas de donnée santé
  console.info('[kinhale.sync]', event);
}

/**
 * Wrapper applicatif web qui injecte les dépendances plateforme dans le hook
 * mutualisé `@kinhale/sync/client`.
 *
 * Le hook sous-jacent est framework-agnostique : il ne connaît ni le WebSocket
 * du navigateur, ni les stores Zustand de cette app. Ce wrapper fournit :
 * - les hooks Zustand (useAuthStore / useDocStore)
 * - la factory WebSocket DOM (createRelayClient)
 * - la dérivation groupKey (Argon2id cachée côté client)
 * - la pseudonymisation + rapporteur télémétrie (KIN-040)
 *
 * Le pragma `'use client'` est requis par Next.js pour que le module soit
 * bundlé côté client — le package `@kinhale/sync` ne porte pas ce pragma car
 * il est aussi consommé par mobile.
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
    platform: 'web',
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
 * À inclure dans les Providers ou dans le layout racine, à l'intérieur du
 * périmètre client.
 */
export function RelaySyncBootstrap(): null {
  useRelaySync();
  return null;
}
