import * as React from 'react';
import type * as A from '@automerge/automerge';
import { consumeSyncMessage, getDocChanges } from '../index.js';
import type { KinhaleDoc } from '../doc/schema.js';

/** Document Automerge d'un foyer (alias pour lisibilité). */
type KinhaleDocument = A.Doc<KinhaleDoc>;

/**
 * Message de la mailbox E2EE renvoyé par `GET /relay/catchup`. Le blob est
 * opaque pour le relai ; le hook le déchiffre localement via la groupKey.
 */
export interface CatchupMessage {
  readonly id: string;
  readonly senderDeviceId: string;
  readonly blobJson: string;
  readonly seq: number;
  readonly sentAtMs: number;
}

export interface CatchupResponse {
  readonly messages: readonly CatchupMessage[];
  /** `true` si le relai a plus d'événements au-delà du dernier `seq` renvoyé. */
  readonly hasMore: boolean;
}

export interface FetchCatchupArgs {
  readonly accessToken: string;
  readonly householdId: string;
  readonly since: number;
}

/**
 * Factory plateforme qui appelle l'endpoint `GET /relay/catchup?since=<n>`
 * authentifié par Bearer token. L'implémentation concrète vit dans les
 * wrappers `apps/web` et `apps/mobile` (accès à `fetch` / `expo-fetch` + URL API).
 */
export type FetchCatchup = (args: FetchCatchupArgs) => Promise<CatchupResponse>;

/** Intervalle par défaut entre deux pulls périodiques (cf. AC E6-S04). */
const DEFAULT_POLL_INTERVAL_MS = 60_000;

/**
 * Dépendances injectées du hook `usePullDelta`.
 *
 * Le hook est framework-agnostique : il ne connaît ni le framework d'état
 * applicatif ni la pile réseau. Chaque app injecte ses propres stores, sa
 * fonction `fetch` et son stockage persistant du curseur.
 */
export interface UsePullDeltaDeps {
  /** Hook plateforme : token d'accès courant, `null` si non authentifié. */
  readonly useAccessToken: () => string | null;
  /** Hook plateforme : identifiant du foyer, `null` si non authentifié. */
  readonly useHouseholdId: () => string | null;
  /** Hook plateforme : document Automerge courant, `null` tant que non chargé. */
  readonly useDoc: () => KinhaleDocument | null;
  /** Hook plateforme : accesseur du doc en dehors du rendu (pour la boucle de pull). */
  readonly getDocSnapshot: () => KinhaleDocument | null;
  /** Hook plateforme : callback pour appliquer des changes reçus au doc local. */
  readonly useReceiveChanges: () => (changes: Uint8Array[]) => void;
  /** Factory plateforme qui appelle l'endpoint `GET /relay/catchup`. */
  readonly fetchCatchup: FetchCatchup;
  /**
   * Charge le dernier curseur `seq` persisté localement. Retourne `0` si
   * aucun curseur n'est connu (premier démarrage ou après reset).
   */
  readonly loadCursor: () => Promise<number>;
  /** Persiste le curseur après un pull réussi (toute page de la pagination). */
  readonly saveCursor: (cursor: number) => Promise<void>;
  /** Dérive la groupKey (Argon2id, cachée) pour un foyer. */
  readonly deriveGroupKey: (householdId: string) => Promise<Uint8Array>;
  /**
   * Intervalle entre deux pulls périodiques (ms). Par défaut
   * {@link DEFAULT_POLL_INTERVAL_MS} = 60_000 (cf. AC E6-S04). Surchargable
   * en test.
   */
  readonly pollIntervalMs?: number;
}

export interface UsePullDeltaResult {
  /** `true` quand une requête est en cours (pour affichage d'un spinner). */
  readonly pulling: boolean;
}

/**
 * Hook qui récupère périodiquement les événements manqués via
 * `GET /relay/catchup?since=<seq>` et les injecte dans le doc Automerge local.
 *
 * Comportement :
 * - **Pull initial** au montage (dès que l'auth + le doc sont prêts).
 * - **Polling** toutes les `pollIntervalMs` millisecondes (60 s par défaut).
 * - **Pagination** : si le relai renvoie `hasMore: true`, refetch immédiat
 *   avec le dernier `seq` jusqu'à épuisement.
 * - **Verrou in-flight** : un seul pull à la fois — le tick du polling est
 *   ignoré si un pull précédent n'est pas encore résolu. Évite l'empilement
 *   des requêtes en cas de latence serveur.
 * - **Curseur persistant** : chargé via `loadCursor()` au montage, sauvegardé
 *   via `saveCursor()` après chaque page.
 * - **Résilience** : une erreur réseau (ou autre rejet de `fetchCatchup`)
 *   ne change pas le curseur — le prochain tick retentera avec la même
 *   valeur. Un blob qui ne déchiffre pas est ignoré silencieusement mais le
 *   curseur avance (sinon le hook resterait bloqué sur un event corrompu).
 * - **Cleanup** : le timer de polling est arrêté au démontage ; toute boucle
 *   de pagination en cours se termine proprement via un flag `cancelled`.
 *
 * Principe zero-knowledge respecté : le relai ne renvoie que des blobs
 * chiffrés opaques (XChaCha20-Poly1305). Jamais de contenu en clair.
 * La groupKey ne quitte jamais la mémoire du device.
 *
 * Refs: KIN-70, E6-S04, §7.2 SPECS.
 */
export function usePullDelta(deps: UsePullDeltaDeps): UsePullDeltaResult {
  const accessToken = deps.useAccessToken();
  const householdId = deps.useHouseholdId();
  const doc = deps.useDoc();
  const receiveChanges = deps.useReceiveChanges();

  const [pulling, setPulling] = React.useState(false);
  const keyRef = React.useRef<Uint8Array | null>(null);
  const cursorRef = React.useRef<number | null>(null);
  const inFlightRef = React.useRef(false);

  // Pattern "latest ref" pour stabiliser l'identité vue par l'effet.
  const fetchCatchupRef = React.useRef(deps.fetchCatchup);
  const loadCursorRef = React.useRef(deps.loadCursor);
  const saveCursorRef = React.useRef(deps.saveCursor);
  const deriveGroupKeyRef = React.useRef(deps.deriveGroupKey);
  const getDocSnapshotRef = React.useRef(deps.getDocSnapshot);
  fetchCatchupRef.current = deps.fetchCatchup;
  loadCursorRef.current = deps.loadCursor;
  saveCursorRef.current = deps.saveCursor;
  deriveGroupKeyRef.current = deps.deriveGroupKey;
  getDocSnapshotRef.current = deps.getDocSnapshot;

  const docReady = doc !== null;
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  React.useEffect(() => {
    if (accessToken === null || householdId === null || !docReady) {
      return undefined;
    }

    let cancelled = false;

    const runPull = async (): Promise<void> => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      setPulling(true);

      try {
        // Charge le curseur persisté la première fois — ensuite, la ref
        // en mémoire fait foi pour ne pas re-lire le storage à chaque tick.
        if (cursorRef.current === null) {
          cursorRef.current = await loadCursorRef.current();
          if (cancelled) return;
        }

        // Dérive (et cache) la groupKey pour ce foyer.
        if (keyRef.current === null) {
          keyRef.current = await deriveGroupKeyRef.current(householdId);
          if (cancelled) return;
        }

        let since = cursorRef.current;
        let hasMore = true;

        while (hasMore && !cancelled) {
          const resp = await fetchCatchupRef.current({
            accessToken,
            householdId,
            since,
          });
          if (cancelled) return;

          // Garde-fou anti-spin : un relai malveillant ou buggé pourrait
          // renvoyer `{messages: [], hasMore: true}` indéfiniment. Sans ce
          // break, la boucle consommerait CPU et réseau en continu car
          // `since` ne pourrait pas progresser. Refs: kz-securite-KIN-070 §B1.
          if (resp.messages.length === 0) {
            break;
          }

          for (const msg of resp.messages) {
            // Re-vérification en tête d'itération : un unmount concurrent
            // peut basculer `cancelled` ou nullifier `keyRef` entre deux
            // microtasks. Sans ce guard, un déchiffrement sur clé `null`
            // throw dans le catch silencieux mais on avancerait quand même
            // le curseur, causant des pertes silencieuses de messages non
            // appliqués. Refs: kz-review-KIN-070 §M1.
            if (cancelled || keyRef.current === null) return;

            const currentDoc = getDocSnapshotRef.current();
            if (currentDoc === null) break;

            try {
              const newDoc = await consumeSyncMessage(currentDoc, msg.blobJson, keyRef.current);
              const delta = getDocChanges(currentDoc, newDoc);
              if (delta.length > 0) {
                receiveChanges(delta);
              }
            } catch {
              // Blob invalide / clé incorrecte : on n'arrête pas le catchup
              // pour ne pas rester bloqué. Le curseur continue d'avancer
              // jusqu'au dernier `seq` traité. **Pas de télémétrie** ici
              // (gap d'observabilité volontaire, ticket de suivi à ouvrir
              // pour factoriser `createDecryptFailedReporter` utilisé dans
              // `useRelaySync`). Refs: kz-securite-KIN-070 §M1.
            }
            since = msg.seq;
          }

          cursorRef.current = since;
          await saveCursorRef.current(since);
          if (cancelled) return;

          hasMore = resp.hasMore;
        }
      } catch {
        // Erreur réseau / 5xx : on garde le curseur inchangé. Le prochain
        // tick de polling retentera. Pas de télémétrie ajoutée ici (ticket
        // de suivi observabilité).
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setPulling(false);
      }
    };

    // Pull initial (au montage) + polling périodique.
    void runPull();
    const timerHandle = setInterval(() => {
      void runPull();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(timerHandle);
      setPulling(false);
      keyRef.current = null;
      cursorRef.current = null;
      inFlightRef.current = false;
    };
  }, [accessToken, householdId, docReady, receiveChanges, pollIntervalMs]);

  return { pulling };
}
