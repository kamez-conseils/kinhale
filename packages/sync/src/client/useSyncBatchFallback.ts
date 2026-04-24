import * as React from 'react';
import type * as A from '@automerge/automerge';
import { buildSyncMessage } from '../index.js';
import type { KinhaleDoc } from '../doc/schema.js';

/** Document Automerge d'un foyer (alias pour lisibilité). */
type KinhaleDocument = A.Doc<KinhaleDoc>;

/**
 * Séquence de délais (ms) appliqués par le hook.
 *
 * Index 0 : **délai initial** entre le passage offline et la 1re tentative
 * (cf. §trigger E7-S02 : activation après 60 s de déconnexion continue).
 * Index 1..N : délais de retry en cas d'échec HTTP (spec W8 : 60s → 2min →
 * 5min → 15min → 1h, puis plafonné à 1h).
 */
const RETRY_DELAYS_MS = [60_000, 60_000, 120_000, 300_000, 900_000, 3_600_000];

/** Plafond appliqué aux tentatives au-delà de la rampe : 1h. */
const MAX_RETRY_DELAY_MS = 3_600_000;

export interface SyncBatchMessage {
  readonly blobJson: string;
  readonly seq: number;
  readonly sentAtMs: number;
}

export interface FetchBatchArgs {
  readonly accessToken: string;
  readonly householdId: string;
  readonly messages: readonly SyncBatchMessage[];
  readonly idempotencyKey: string;
}

export interface FetchBatchResult {
  readonly accepted: number;
  readonly duplicate: boolean;
}

/**
 * Factory plateforme qui appelle l'endpoint `POST /sync/batch` avec
 * authentification Bearer et header `Idempotency-Key`. Implémentée côté
 * apps web (fetch DOM) et mobile (fetch RN).
 */
export type FetchBatch = (args: FetchBatchArgs) => Promise<FetchBatchResult>;

/**
 * Dépendances injectées du hook `useSyncBatchFallback`.
 *
 * Framework-agnostique : chaque app injecte ses stores et sa pile réseau.
 */
export interface UseSyncBatchFallbackDeps {
  readonly useAccessToken: () => string | null;
  readonly useDeviceId: () => string | null;
  readonly useHouseholdId: () => string | null;
  readonly useDoc: () => KinhaleDocument | null;
  readonly getDocSnapshot: () => KinhaleDocument | null;
  /** Lit l'état de la connexion WebSocket live (depuis le store app). */
  readonly useConnected: () => boolean;
  /** Appelle l'endpoint `POST /sync/batch`. */
  readonly fetchBatch: FetchBatch;
  /** Dérive la groupKey (Argon2id, cachée) pour un foyer. */
  readonly deriveGroupKey: (householdId: string) => Promise<Uint8Array>;
}

/**
 * Hook qui bascule en fallback HTTP quand la WebSocket est indisponible
 * pendant plus de 60 s. Envoie les changes Automerge locaux accumulés via
 * `POST /sync/batch`, avec un `Idempotency-Key` régénéré à chaque tentative.
 *
 * Comportement :
 * - **Inactif** tant que `connected=true`. Le hook ne tire aucun timer.
 * - **Trigger** : 60 s après le passage à `connected=false`, appel initial.
 * - **Retry** : séquence `[60s, 60s, 120s, 300s, 900s, 1h]` puis 1h en boucle.
 * - **Reset** : à chaque bascule `connected=true → false`, le compteur de
 *   retries repart à zéro (nouveau cycle de déconnexion).
 * - **Curseur interne** (`lastFlushedDocRef`) : au premier run, initialisé au
 *   doc courant (les events déjà présents sont réputés sync via WS au
 *   montage). Les mutations ultérieures produiront un delta non-vide.
 * - **Pas de delta** : si `buildSyncMessage` retourne `null`, aucun appel
 *   réseau n'est fait ; le compteur de retries n'est pas incrémenté.
 * - **Succès** : le curseur est avancé, le compteur reset. Un nouveau check
 *   à 60 s est reprogrammé pour capturer d'éventuels changes offline
 *   ultérieurs.
 * - **Cleanup** : démontage ou bascule `connected=true` clear le timer et
 *   reset la clé en mémoire.
 *
 * Principe zero-knowledge respecté : le serveur ne reçoit que des blobs
 * chiffrés opaques (XChaCha20-Poly1305), mêmes helpers que `useRelaySync`.
 *
 * Refs: KIN-72 / E7-S02, §7.2 SPECS (idempotency), §W8 (retry delays).
 */
export function useSyncBatchFallback(deps: UseSyncBatchFallbackDeps): void {
  const accessToken = deps.useAccessToken();
  const deviceId = deps.useDeviceId();
  const householdId = deps.useHouseholdId();
  const doc = deps.useDoc();
  const connected = deps.useConnected();

  const keyRef = React.useRef<Uint8Array | null>(null);
  const lastFlushedDocRef = React.useRef<KinhaleDocument | null>(null);
  const attemptCountRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = React.useRef(0);

  // Latest ref pattern — permet aux deps stables de voir les dernières valeurs
  // sans ré-exécuter l'effet à chaque render.
  const fetchBatchRef = React.useRef(deps.fetchBatch);
  const deriveGroupKeyRef = React.useRef(deps.deriveGroupKey);
  const getDocSnapshotRef = React.useRef(deps.getDocSnapshot);
  fetchBatchRef.current = deps.fetchBatch;
  deriveGroupKeyRef.current = deps.deriveGroupKey;
  getDocSnapshotRef.current = deps.getDocSnapshot;

  const docReady = doc !== null;

  React.useEffect(() => {
    if (
      accessToken === null ||
      deviceId === null ||
      householdId === null ||
      !docReady ||
      connected
    ) {
      // Actif uniquement quand authentifié + doc chargé + connexion coupée.
      return undefined;
    }

    let cancelled = false;

    const clearPendingTimer = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const delayForAttempt = (attempt: number): number => {
      if (attempt >= RETRY_DELAYS_MS.length) return MAX_RETRY_DELAY_MS;
      return RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;
    };

    const scheduleNext = (delayMs: number): void => {
      clearPendingTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void tryFlush();
      }, delayMs);
    };

    const tryFlush = async (): Promise<void> => {
      if (cancelled) return;

      // On incrémente AVANT pour que le prochain scheduleNext voie le bon
      // palier en cas d'échec. Sur succès, on remettra à 0.
      const attemptIdx = attemptCountRef.current;
      attemptCountRef.current = attemptIdx + 1;

      try {
        if (keyRef.current === null) {
          keyRef.current = await deriveGroupKeyRef.current(householdId);
          if (cancelled) return;
        }

        const currentDoc = getDocSnapshotRef.current();
        if (currentDoc === null) {
          // Doc volatilisé (logout/reset) — on n'envoie rien et on laisse
          // l'effet se recomposer proprement.
          attemptCountRef.current = attemptIdx;
          return;
        }

        if (lastFlushedDocRef.current === null) {
          lastFlushedDocRef.current = currentDoc;
        }
        const before = lastFlushedDocRef.current;

        const sentAtMs = Date.now();
        // Ne PAS avancer `seqRef.current` tant que le POST n'a pas réussi :
        // un échec réseau avec un seq déjà consommé laisserait un trou
        // dans la séquence chez les consommateurs. On capture un
        // candidat local et on ne commit qu'après succès fetchBatch.
        // Refs: kz-review-KIN-072 §M3.
        const candidateSeq = seqRef.current + 1;
        const msg = await buildSyncMessage(before, currentDoc, keyRef.current, {
          mailboxId: householdId,
          deviceId,
          seq: candidateSeq,
        });

        if (msg === null) {
          // Pas de delta à envoyer : pas d'appel HTTP, pas d'incrément de
          // retry — on revient à l'état avant. On reschedule un check dans
          // 60 s pour capturer d'éventuels futurs changes offline.
          attemptCountRef.current = attemptIdx;
          scheduleNext(RETRY_DELAYS_MS[0] ?? 60_000);
          return;
        }

        // Idempotency-Key unique par tentative : un retry après échec ne
        // doit PAS réutiliser la même key, sinon le serveur détecterait
        // une duplication côté 2e tentative alors que la 1re n'a pas
        // persisté. On utilise `crypto.randomUUID` (jamais `Math.random`).
        const idempotencyKey = crypto.randomUUID();

        await fetchBatchRef.current({
          accessToken,
          householdId,
          messages: [{ blobJson: msg, seq: candidateSeq, sentAtMs }],
          idempotencyKey,
        });

        if (cancelled) return;

        // Succès : on peut enfin commit le seq, avancer le curseur et
        // reset le compteur. Reschedule un check à 60 s pour capturer
        // d'éventuels futurs changes offline.
        seqRef.current = candidateSeq;
        lastFlushedDocRef.current = currentDoc;
        attemptCountRef.current = 0;
        scheduleNext(RETRY_DELAYS_MS[0] ?? 60_000);
      } catch {
        // Échec réseau / 5xx / 4xx : ne pas avancer le curseur ; schedule
        // le prochain retry avec le délai du palier courant.
        if (cancelled) return;
        scheduleNext(delayForAttempt(attemptCountRef.current));
      }
    };

    // Déclenchement initial à 60 s après bascule offline.
    scheduleNext(delayForAttempt(0));

    return () => {
      cancelled = true;
      clearPendingTimer();
      attemptCountRef.current = 0;
      keyRef.current = null;
    };
  }, [accessToken, deviceId, householdId, docReady, connected]);
}
