import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useRelaySync as useRelaySyncCore,
  usePullDelta as usePullDeltaCore,
  useSyncBatchFallback as useSyncBatchFallbackCore,
  useReminderScheduler as useReminderSchedulerCore,
  useMissedDoseWatcher as useMissedDoseWatcherCore,
  useDuplicateDetectionWatcher as useDuplicateDetectionWatcherCore,
  getGroupKey,
  type DecryptFailedEvent,
  type FetchCatchupArgs,
  type CatchupResponse,
  type FetchBatchArgs,
  type FetchBatchResult,
  type DuplicateDosePair,
  type NotifyDuplicateArgs,
} from '@kinhale/sync/client';
import { blake2bHex } from '@kinhale/crypto';
import { createRelayClient } from '../relay-client';
import { getOrCreateDevice } from '../device';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { useSyncStatusStore } from '../../stores/sync-status-store';

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
const APP_SECRET_FALLBACK_DEV = 'dev-secret-v1';
const APP_SECRET = process.env['EXPO_PUBLIC_KINHALE_APP_SECRET'] ?? APP_SECRET_FALLBACK_DEV;

if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') {
  if (process.env['EXPO_PUBLIC_KINHALE_APP_SECRET'] === undefined) {
    console.warn(
      '[kinhale.sync] EXPO_PUBLIC_KINHALE_APP_SECRET absent en prod — pseudonymisation avec fallback dev.',
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
 * Voir wrapper web pour la stratégie placeholder synchrone pendant le premier
 * appel libsodium asynchrone.
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
        return `pending-${fnv1aHash(householdId)}`;
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
  const result = useRelaySyncCore({
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
  // Miroir du statut dans un store applicatif pour que les composants UI
  // (badge offline, guards) puissent le lire. Refs: KIN-75 / E7-S05.
  const setConnected = useSyncStatusStore((s) => s.setConnected);
  React.useEffect(() => {
    setConnected(result.connected);
  }, [result.connected, setConnected]);
  return result;
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
  usePullDelta();
  useSyncBatchFallback();
  return null;
}

// ---------------------------------------------------------------------------
// Pull delta catchup (KIN-70 / E6-S04).
//
// Récupère les événements manqués au montage et toutes les 60 s via
// `GET /relay/catchup?since=<seq>`. Curseur persisté en AsyncStorage,
// scopé par foyer.
// ---------------------------------------------------------------------------

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const CURSOR_STORAGE_PREFIX = 'kinhale-sync-cursor:';

function cursorKey(householdId: string): string {
  return `${CURSOR_STORAGE_PREFIX}${householdId}`;
}

async function fetchCatchup(args: FetchCatchupArgs): Promise<CatchupResponse> {
  const url = new URL(`${API_URL}/relay/catchup`);
  url.searchParams.set('since', String(args.since));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    // Remonte l'échec au hook — le curseur ne sera pas avancé pour ce tick.
    throw new Error(`catchup fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as CatchupResponse;
  return json;
}

function loadCursorFactory(getHouseholdId: () => string | null): () => Promise<number> {
  return async () => {
    const id = getHouseholdId();
    if (id === null) return 0;
    const raw = await AsyncStorage.getItem(cursorKey(id));
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
}

function saveCursorFactory(getHouseholdId: () => string | null): (cursor: number) => Promise<void> {
  return async (cursor: number) => {
    const id = getHouseholdId();
    if (id === null) return;
    await AsyncStorage.setItem(cursorKey(id), String(cursor));
  };
}

/**
 * Wrapper applicatif mobile qui monte le pull delta catchup. Doit être
 * rendu en parallèle de `useRelaySync()` — les deux se complètent : WS
 * pour le live, catchup pour rattraper ce qui a été manqué pendant une
 * absence.
 */
export function usePullDelta(): { pulling: boolean } {
  const result = usePullDeltaCore({
    useAccessToken: () => useAuthStore((s) => s.accessToken),
    useHouseholdId: () => useAuthStore((s) => s.householdId),
    useDoc: () => useDocStore((s) => s.doc),
    getDocSnapshot: () => useDocStore.getState().doc,
    useReceiveChanges: () => useDocStore((s) => s.receiveChanges),
    fetchCatchup,
    loadCursor: loadCursorFactory(() => useAuthStore.getState().householdId),
    saveCursor: saveCursorFactory(() => useAuthStore.getState().householdId),
    deriveGroupKey: getGroupKey,
  });
  // Miroir du statut pulling dans le store pour l'UI. Refs: KIN-75 / E7-S05.
  const setPulling = useSyncStatusStore((s) => s.setPulling);
  React.useEffect(() => {
    setPulling(result.pulling);
  }, [result.pulling, setPulling]);
  return result;
}

// ---------------------------------------------------------------------------
// Sync batch HTTP fallback (KIN-72 / E7-S02).
//
// Activé quand la WS reste indisponible > 60 s : envoie en HTTP les changes
// Automerge locaux accumulés, avec retry exponentiel long (60s → 1h) et
// Idempotency-Key régénéré à chaque tentative.
// ---------------------------------------------------------------------------

async function fetchBatch(args: FetchBatchArgs): Promise<FetchBatchResult> {
  const url = new URL(`${API_URL}/sync/batch`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
      'Idempotency-Key': args.idempotencyKey,
    },
    body: JSON.stringify({ messages: args.messages }),
  });
  if (!res.ok) {
    throw new Error(`sync batch failed: ${res.status}`);
  }
  const json = (await res.json()) as FetchBatchResult;
  return json;
}

/**
 * Wrapper applicatif mobile qui monte le fallback HTTP `POST /sync/batch`.
 * Lit le statut `connected` du store sync-status alimenté par `useRelaySync()`.
 */
export function useSyncBatchFallback(): void {
  useSyncBatchFallbackCore({
    useAccessToken: () => useAuthStore((s) => s.accessToken),
    useDeviceId: () => useAuthStore((s) => s.deviceId),
    useHouseholdId: () => useAuthStore((s) => s.householdId),
    useDoc: () => useDocStore((s) => s.doc),
    getDocSnapshot: () => useDocStore.getState().doc,
    useConnected: () => useSyncStatusStore((s) => s.connected),
    fetchBatch,
    deriveGroupKey: getGroupKey,
  });
}

// ---------------------------------------------------------------------------
// Rappels de dose (KIN-038) : scheduler + watcher missed.
// ---------------------------------------------------------------------------

/**
 * Programme une notification locale Expo au `triggerAtUtc`. Si l'instant est
 * dans le passé, Expo rejette silencieusement ; on renvoie une Promise
 * résolue pour ne pas polluer la sync du hook.
 *
 * Pas de donnée santé dans `title`/`body` — chaînes déjà traduites passées
 * par le hook (contrat `UseReminderSchedulerDeps.reminderTitle` / `reminderBody`).
 */
async function scheduleLocalNotification(args: {
  id: string;
  triggerAtUtc: string;
  title: string;
  body: string;
}): Promise<void> {
  const seconds = Math.max(1, Math.floor((Date.parse(args.triggerAtUtc) - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    identifier: args.id,
    content: { title: args.title, body: args.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

async function cancelLocalNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Identifier inconnu côté Expo : aucun log (pas d'info pertinente à
    // surveiller ; pas de donnée santé à exfiltrer).
  }
}

/**
 * Préfixe déterministe des identifiants de rappels projetés depuis le doc
 * (`r:<planId>:<targetIso>` — cf. `packages/sync/src/projections/reminders.ts`).
 * Utilisé pour filtrer les notifications Expo au moment de l'hydratation :
 * on ne veut repeupler `scheduledIdsRef` qu'avec des ids de ce canal, pas
 * d'autres notifs OS (pushs, locales hors rappels) qui pourraient exister.
 */
const REMINDER_ID_PREFIX = 'r:';

/**
 * Hydratation cross-session côté mobile : au montage, reconstruit la liste
 * des ids de rappels déjà programmés côté OS. Essentiel car
 * `scheduledIdsRef` côté React est vide après un redémarrage du process
 * RN ou un logout/re-login, alors que les notifs Expo persistent — sans
 * ça, on (re)programmerait par-dessus, risquant des doublons Android sur
 * expo-notifications < 0.29.
 *
 * Échec silencieux : `getAllScheduledNotificationsAsync` peut rejeter si
 * le module natif n'est pas encore prêt (cold start). On retourne `[]` et
 * on laisse le hook continuer best-effort.
 *
 * Refs: KIN-038 (kz-securite M1).
 */
async function hydrateScheduledReminderIds(): Promise<ReadonlyArray<string>> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids: string[] = [];
    for (const entry of scheduled) {
      const id = entry.identifier;
      if (typeof id === 'string' && id.startsWith(REMINDER_ID_PREFIX)) {
        ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

async function notifyMissedDoseNow(args: {
  id: string;
  title: string;
  body: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: args.id,
    content: { title: args.title, body: args.body },
    trigger: null, // immédiat
  });
}

// ---------------------------------------------------------------------------
// Détection doublons (KIN-73 / E7-S03, RM6).
// ---------------------------------------------------------------------------

async function flagDuplicatePairMobile(pair: DuplicateDosePair): Promise<void> {
  const { deviceId } = useAuthStore.getState();
  if (deviceId === null) return;
  const kp = await getOrCreateDevice();
  await useDocStore.getState().appendDoseFlag(
    {
      flagId: crypto.randomUUID(),
      doseIds: pair.doseIds,
      detectedAtMs: pair.detectedAtMs,
    },
    deviceId,
    kp.secretKey,
  );
}

async function notifyDuplicateNowMobile(args: NotifyDuplicateArgs): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: args.id,
    content: { title: args.title, body: args.body },
    trigger: null, // immédiat
  });
}

/**
 * Monte le scheduler de rappels (E5-S01 + E5-S02) et le watcher de doses
 * manquées (E5-S03) en arrière-plan. Dépend de i18next pour les chaînes —
 * à inclure **sous** le `I18nextProvider`.
 */
export function RemindersBootstrap(): null {
  const { t } = useTranslation('common');

  useReminderSchedulerCore({
    useDoc: () => useDocStore((s) => s.doc),
    scheduleLocalNotification,
    cancelLocalNotification,
    hydrateScheduledIds: hydrateScheduledReminderIds,
    now: () => new Date(),
    reminderTitle: t('reminder.title'),
    reminderBody: t('reminder.body'),
  });

  useMissedDoseWatcherCore({
    useDoc: () => useDocStore((s) => s.doc),
    // v1.0 : pas de persistance du statut `missed` dans le doc Automerge
    // (pas d'événement `ReminderStatusChanged` défini). La transition est
    // donc purement en mémoire pour l'instant ; elle sera branchée dès que
    // le format d'événement sera stabilisé (ticket de suivi).
    markReminderMissed: () => undefined,
    notifyMissedDose: notifyMissedDoseNow,
    now: () => new Date(),
    missedDoseTitle: t('missed_dose.title'),
    missedDoseBody: t('missed_dose.body'),
  });

  // Watcher RM6 (KIN-73 / E7-S03) : détecte les doubles saisies et émet
  // un événement `DoseReviewFlagged` + notification locale.
  useDuplicateDetectionWatcherCore({
    useDoc: () => useDocStore((s) => s.doc),
    flagDuplicatePair: flagDuplicatePairMobile,
    notifyDuplicate: notifyDuplicateNowMobile,
    now: () => new Date(),
    duplicateTitle: t('duplicate.title'),
    duplicateBody: t('duplicate.body'),
  });

  return null;
}
