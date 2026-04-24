'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRelaySync as useRelaySyncCore,
  usePullDelta as usePullDeltaCore,
  useReminderScheduler as useReminderSchedulerCore,
  useMissedDoseWatcher as useMissedDoseWatcherCore,
  getGroupKey,
  type DecryptFailedEvent,
  type FetchCatchupArgs,
  type CatchupResponse,
} from '@kinhale/sync/client';
import { blake2bHex } from '@kinhale/crypto';
import { createRelayClient } from '../relay-client';
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
  const result = useRelaySyncCore({
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
  // Miroir du statut dans un store applicatif pour que les composants UI
  // (badge offline, guards) puissent le lire sans monter eux-mêmes une
  // 2e connexion WebSocket. Refs: KIN-75 / E7-S05.
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
 * À inclure dans les Providers ou dans le layout racine, à l'intérieur du
 * périmètre client.
 */
export function RelaySyncBootstrap(): null {
  useRelaySync();
  usePullDelta();
  return null;
}

// ---------------------------------------------------------------------------
// Pull delta catchup (KIN-70 / E6-S04).
//
// Récupère les événements manqués au montage et toutes les 60 s via
// `GET /relay/catchup?since=<seq>`. Curseur persisté en localStorage,
// scopé par foyer.
// ---------------------------------------------------------------------------

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
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
    if (typeof window === 'undefined') return 0;
    const id = getHouseholdId();
    if (id === null) return 0;
    const raw = window.localStorage.getItem(cursorKey(id));
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
}

function saveCursorFactory(getHouseholdId: () => string | null): (cursor: number) => Promise<void> {
  return async (cursor: number) => {
    if (typeof window === 'undefined') return;
    const id = getHouseholdId();
    if (id === null) return;
    window.localStorage.setItem(cursorKey(id), String(cursor));
  };
}

/**
 * Wrapper applicatif web qui monte le pull delta catchup. Doit être rendu
 * en parallèle de `useRelaySync()` — les deux se complètent : WS pour le
 * live, catchup pour rattraper ce qui a été manqué pendant une absence.
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
// Rappels de dose (KIN-038) : scheduler + watcher missed.
// ---------------------------------------------------------------------------

/**
 * État interne minimal : mapping `reminderId → setTimeout handle` pour les
 * rappels programmés via l'API Web Notifications. Limité à la session
 * onglet : à la fermeture de l'onglet, les timers sont perdus — c'est
 * acceptable car un onglet fermé n'a de toute façon pas de notif active.
 *
 * Pour la v1.0, le web est secondaire (le vrai moteur de rappels est
 * mobile natif). L'implémentation web assure une expérience cohérente
 * quand l'app est ouverte, et reste un no-op silencieux si l'API
 * Notifications n'est pas disponible (SSR, navigateur désactivé, permission
 * refusée).
 */
const webReminderTimers = new Map<string, ReturnType<typeof setTimeout>>();

function hasWebNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Vérifie si la permission Web Notifications est déjà accordée. **Ne
 * déclenche jamais `Notification.requestPermission()`** — les navigateurs
 * (Chrome, Firefox) recommandent fortement d'exiger un geste utilisateur
 * avant la demande, sous peine de refus définitif (UX pattern browser).
 *
 * La demande est portée par {@link enableWebReminders}, qui doit être
 * appelée depuis un handler de bouton UI (ticket de suivi : onboarding
 * « Activer les rappels »).
 */
function isWebNotificationPermissionGranted(): boolean {
  if (!hasWebNotifications()) return false;
  return Notification.permission === 'granted';
}

/**
 * Active explicitement les rappels web en demandant la permission à
 * l'utilisateur. **DOIT être appelée depuis un event handler UI (clic
 * d'un toggle réglages)** pour respecter le contrat Chrome/Firefox :
 * `requestPermission` hors gesture est ignorée ou bloquée, et peut
 * pousser le navigateur à poser `denied` de façon permanente.
 *
 * Retourne `true` si la permission est (ou vient d'être) accordée,
 * `false` sinon (permission refusée, API indisponible, SSR). L'UI peut
 * utiliser cette valeur pour afficher un état désactivé.
 *
 * TODO (ticket de suivi « Onboarding permission notifications web ») :
 * brancher un toggle dans les réglages web ; tant que ce toggle n'est
 * pas posé, le web reste no-op silencieux si l'utilisateur n'a pas
 * activé la permission dans le navigateur par un autre canal.
 */
export async function enableWebReminders(): Promise<boolean> {
  if (!hasWebNotifications()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function scheduleLocalNotificationWeb(args: {
  id: string;
  triggerAtUtc: string;
  title: string;
  body: string;
}): Promise<void> {
  // Pas de demande intempestive de permission : si le user n'a pas encore
  // activé les rappels web via `enableWebReminders`, no-op silencieux.
  if (!isWebNotificationPermissionGranted()) return;

  const delayMs = Math.max(0, Date.parse(args.triggerAtUtc) - Date.now());
  const existing = webReminderTimers.get(args.id);
  if (existing !== undefined) clearTimeout(existing);

  const handle = setTimeout(() => {
    webReminderTimers.delete(args.id);
    if (isWebNotificationPermissionGranted()) {
      // Payload minimal — aucune donnée santé. Conforme RM16 + CLAUDE.md.
      new Notification(args.title, { body: args.body, tag: args.id });
    }
  }, delayMs);
  webReminderTimers.set(args.id, handle);
}

async function cancelLocalNotificationWeb(id: string): Promise<void> {
  const handle = webReminderTimers.get(id);
  if (handle !== undefined) {
    clearTimeout(handle);
    webReminderTimers.delete(id);
  }
}

async function notifyMissedDoseNowWeb(args: {
  id: string;
  title: string;
  body: string;
}): Promise<void> {
  // Même contrat que `scheduleLocalNotificationWeb` : aucune demande
  // implicite de permission. L'utilisateur doit l'avoir activée
  // explicitement via `enableWebReminders`.
  if (!isWebNotificationPermissionGranted()) return;
  new Notification(args.title, { body: args.body, tag: args.id });
}

/**
 * Monte le scheduler de rappels (E5-S01 + E5-S02, best-effort côté web) et
 * le watcher de doses manquées (E5-S03). Le web utilise l'API Web
 * Notifications quand disponible ; sinon no-op silencieux (le vrai moteur
 * de rappels est mobile natif, §9 SPECS).
 */
export function RemindersBootstrap(): null {
  const { t } = useTranslation('common');

  useReminderSchedulerCore({
    useDoc: () => useDocStore((s) => s.doc),
    scheduleLocalNotification: scheduleLocalNotificationWeb,
    cancelLocalNotification: cancelLocalNotificationWeb,
    now: () => new Date(),
    reminderTitle: t('reminder.title'),
    reminderBody: t('reminder.body'),
  });

  useMissedDoseWatcherCore({
    useDoc: () => useDocStore((s) => s.doc),
    // v1.0 : pas de persistance du statut `missed` dans le doc Automerge
    // (pas d'événement `ReminderStatusChanged` défini). La transition reste
    // en mémoire pour l'instant ; branchement prévu dès que le format
    // d'événement sera stabilisé (ticket de suivi).
    markReminderMissed: () => undefined,
    notifyMissedDose: notifyMissedDoseNowWeb,
    now: () => new Date(),
    missedDoseTitle: t('missed_dose.title'),
    missedDoseBody: t('missed_dose.body'),
  });

  return null;
}
