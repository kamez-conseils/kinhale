import * as React from 'react';
import type * as A from '@automerge/automerge';
import {
  buildSyncMessage,
  consumeSyncMessage,
  createCursor,
  recordSent,
  recordReceived,
  getDocChanges,
} from '../index.js';
import type { SyncCursor } from '../index.js';
import type { KinhaleDoc } from '../doc/schema.js';
import {
  classifyDecryptError,
  createDecryptFailedReporter,
  type HashHousehold,
  type ReportDecryptFailed,
} from './telemetry.js';

/** Document Automerge d'un foyer (alias pour lisibilité). */
type KinhaleDocument = A.Doc<KinhaleDoc>;

/**
 * Message reçu du relai (même forme que RelayMessage côté apps).
 * Seul `blobJson` (payload opaque chiffré) est consommé par le hook.
 */
export interface RelayIncomingMessage {
  readonly blobJson: string;
  readonly seq: number;
  readonly sentAtMs: number;
}

/** Handler de message entrant — appelé par l'implémentation plateforme du relai. */
export type RelayMessageHandler = (msg: RelayIncomingMessage) => void | Promise<void>;

/** Contrat minimal d'un client relai — implémenté par web (WebSocket DOM) et mobile (WebSocket RN). */
export interface RelayClient {
  send(blobJson: string): void;
  close(): void;
}

/**
 * Factory plateforme qui ouvre une connexion WS et renvoie un client relai.
 *
 * `onClose` est optionnel pour compatibilité ascendante ; quand il est fourni,
 * la factory doit l'invoquer dès que la connexion est fermée ou en erreur,
 * afin que le hook puisse déclencher une reconnexion avec backoff (E6-S03).
 */
export type CreateRelayClient = (
  token: string,
  onMessage: RelayMessageHandler,
  onClose?: () => void,
) => RelayClient;

/**
 * Séquence des délais de reconnexion (ms) : 1s, 2s, 5s, 15s, puis 60s
 * répétés pour toutes les tentatives suivantes. Plafonner à 60s évite
 * de noyer un relai déjà en difficulté. Refs: E6-S03.
 */
const BACKOFF_DELAYS_MS = [1000, 2000, 5000, 15000, 60000];

/**
 * Plafond absolu du nombre de tentatives consécutives. Atteint, le hook
 * abandonne la reconnexion et laisse `connected:false` jusqu'à la prochaine
 * bascule d'auth ou de doc (qui recrée l'effet et redémarre le compteur).
 *
 * Dimensionnement : 15 tentatives ≈ 1+2+5+15 + 60×11 = 683s ≈ 11 min,
 * proche du TTL du JWT d'accès (15 min). Protège contre une boucle infinie
 * si le handshake échoue durablement (token expiré rejeté en 401 HTTP,
 * invisible comme close code côté client). Le palliatif est minimal — une
 * propagation propre des close codes 4401/4403 est suivie dans un ticket
 * dédié (voir PR body et `kz-securite-KIN-069.md` §M1).
 */
const MAX_RECONNECT_ATTEMPTS = 15;

/**
 * Durée pendant laquelle une connexion doit rester stable avant que le
 * compteur de tentatives soit remis à zéro. Empêche un flap
 * connect/disconnect rapide de consommer toute la rampe de backoff.
 */
const STABILITY_RESET_MS = 30000;

/**
 * Dépendances injectées du hook `useRelaySync`.
 *
 * Le hook ne connaît ni le framework d'état applicatif (Zustand côté web/mobile,
 * potentiellement autre chose côté tests), ni la pile réseau (WebSocket DOM vs
 * React Native). Chaque app injecte ses propres hooks d'état et sa factory WS.
 */
export interface UseRelaySyncDeps {
  /** Hook plateforme : token d'accès courant, `null` si non authentifié. */
  readonly useAccessToken: () => string | null;
  /** Hook plateforme : identifiant stable du device local, `null` si non auth. */
  readonly useDeviceId: () => string | null;
  /** Hook plateforme : identifiant du foyer, `null` si non auth. */
  readonly useHouseholdId: () => string | null;
  /** Hook plateforme : document Automerge courant, `null` tant que non chargé. */
  readonly useDoc: () => KinhaleDocument | null;
  /** Hook plateforme : accesseur du doc en dehors du rendu (pour le handler onMessage). */
  readonly getDocSnapshot: () => KinhaleDocument | null;
  /** Hook plateforme : callback pour appliquer des changes reçus au doc local. */
  readonly useReceiveChanges: () => (changes: Uint8Array[]) => void;
  /** Factory plateforme ouvrant la connexion WS au relai. */
  readonly createRelayClient: CreateRelayClient;
  /** Dérive la groupKey (Argon2id, cachée) pour un foyer. */
  readonly deriveGroupKey: (householdId: string) => Promise<Uint8Array>;
  /**
   * Identifiant de plateforme émettrice, utilisé uniquement dans la
   * télémétrie pseudonymisée (champ `platform`).
   */
  readonly platform: 'web' | 'mobile';
  /**
   * Pseudonymise un `householdId` (BLAKE2b keyed avec l'app_secret de l'app).
   * **Obligatoire** — la fonction doit toujours produire une sortie non
   * réversible (voir `blake2bHex` dans `@kinhale/crypto`). Jamais d'identité.
   */
  readonly hashHousehold: HashHousehold;
  /**
   * Rapporteur d'événements `sync.decrypt_failed` / `_storm`. Optionnel :
   * si omis, le hook fonctionne exactement comme avant (no-op silencieux).
   * Aucune donnée santé ne doit transiter par cette fonction — le schéma
   * d'événement est figé par le type `DecryptFailedEvent`.
   */
  readonly reportDecryptFailed?: ReportDecryptFailed;
}

/**
 * Hook qui maintient une connexion WS au relai et synchronise
 * bidirectionnellement le doc Automerge local.
 *
 * - À chaque change local (doc store update) → buildSyncMessage → client.send
 * - À chaque message reçu → consumeSyncMessage → receiveChanges
 *
 * Le cursor garantit l'idempotence (pas de renvoi des mêmes changements).
 *
 * Principe zero-knowledge respecté : le relai ne reçoit que des blobs
 * chiffrés opaques (XChaCha20-Poly1305). Jamais de contenu en clair.
 * La groupKey ne quitte jamais la mémoire du device (pas de persistance ajoutée
 * par ce hook).
 *
 * Le hook est framework-agnostique : il n'importe ni `react-dom` ni
 * `react-native`. Les dépendances plateforme (WebSocket, stores d'état) sont
 * passées en paramètre. Les apps web et mobile exportent chacune un `useRelaySync`
 * très mince qui fournit ses propres implémentations.
 *
 * Refs: KIN-039, ADR-D9 (compromis groupKey déterministe v1.0).
 */
export function useRelaySync(deps: UseRelaySyncDeps): { connected: boolean } {
  const accessToken = deps.useAccessToken();
  const deviceId = deps.useDeviceId();
  const householdId = deps.useHouseholdId();
  const doc = deps.useDoc();
  const receiveChanges = deps.useReceiveChanges();

  const [connected, setConnected] = React.useState(false);
  const clientRef = React.useRef<RelayClient | null>(null);
  const cursorRef = React.useRef<SyncCursor>(createCursor());
  const seqRef = React.useRef(0);
  const keyRef = React.useRef<Uint8Array | null>(null);
  // Compteur de déconnexions consécutives. Reset à 0 après
  // STABILITY_RESET_MS de connexion stable. Refs: E6-S03.
  const failuresCountRef = React.useRef(0);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabilityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reporter de télémétrie `sync.decrypt_failed` (KIN-040). Stable pour la
  // durée de vie du hook — le rate-limiter vit dans la closure du reporter.
  // `platform` est capturé une seule fois à la première création (valeur
  // immuable côté wrappers web/mobile). `hashHousehold` et `reportDecryptFailed`
  // sont relus via refs pour ne jamais invalider l'effet WS tout en captant
  // la dernière valeur injectée par les wrappers.
  const hashHouseholdRef = React.useRef(deps.hashHousehold);
  const reportDecryptFailedRef = React.useRef(deps.reportDecryptFailed);
  hashHouseholdRef.current = deps.hashHousehold;
  reportDecryptFailedRef.current = deps.reportDecryptFailed;

  const telemetryReporterRef = React.useRef<ReturnType<typeof createDecryptFailedReporter> | null>(
    null,
  );
  if (telemetryReporterRef.current === null) {
    telemetryReporterRef.current = createDecryptFailedReporter({
      platform: deps.platform,
      hashHousehold: (id) => hashHouseholdRef.current(id),
      report: (event) => reportDecryptFailedRef.current?.(event),
    });
  }

  // Dépendance sur `docReady` (booléen dérivé) pour éviter de rouvrir la WS à
  // chaque mutation du doc. La connexion ne se (re)crée que quand auth ou doc
  // passent du non-prêt au prêt (ou inversement).
  const docReady = doc !== null;

  // Pattern "latest ref" : les deps ci-dessous sont recopiées dans des refs pour
  // stabiliser l'identité vue par le useEffect et éviter une reconnexion WS à
  // chaque render (les wrappers apps recréent ces closures à chaque appel).
  // Les refs sont relues *dans* l'effet pour toujours capturer la dernière valeur.
  const createRelayClientRef = React.useRef(deps.createRelayClient);
  const deriveGroupKeyRef = React.useRef(deps.deriveGroupKey);
  const getDocSnapshotRef = React.useRef(deps.getDocSnapshot);
  createRelayClientRef.current = deps.createRelayClient;
  deriveGroupKeyRef.current = deps.deriveGroupKey;
  getDocSnapshotRef.current = deps.getDocSnapshot;

  // 1. Ouvre la WS quand l'utilisateur est authentifié et que le doc est chargé.
  //    Gère aussi la reconnexion automatique avec backoff exponentiel (E6-S03)
  //    via le callback `onClose` injecté à la factory plateforme. La séquence
  //    de délais est 1s, 2s, 5s, 15s, 60s puis 60s en boucle. Une connexion
  //    restée stable plus de STABILITY_RESET_MS remet le compteur à zéro.
  React.useEffect(() => {
    if (accessToken === null || deviceId === null || householdId === null || !docReady) {
      return undefined;
    }

    let cancelled = false;

    const clearReconnectTimer = (): void => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const clearStabilityTimer = (): void => {
      if (stabilityTimerRef.current !== null) {
        clearTimeout(stabilityTimerRef.current);
        stabilityTimerRef.current = null;
      }
    };

    const handleDisconnect = (): void => {
      if (cancelled) return;

      setConnected(false);
      clearStabilityTimer();

      // Toujours fermer le client courant avant d'en recréer un :
      // évite d'accumuler des handles WS en cas de déconnexions répétées.
      clientRef.current?.close();
      clientRef.current = null;

      const attempt = failuresCountRef.current;

      // Stop après MAX_RECONNECT_ATTEMPTS : évite une boucle infinie si la
      // cause racine est non-résolvable côté client (ex. JWT expiré rejeté
      // en 401 HTTP au handshake, indistinguable d'un flap réseau côté
      // browser). Une bascule d'auth/doc recréera l'effet et remettra le
      // compteur à zéro.
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        clearReconnectTimer();
        return;
      }

      failuresCountRef.current = attempt + 1;
      const delay = BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)] ?? 60000;

      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect();
      }, delay);
    };

    const connect = async (): Promise<void> => {
      if (cancelled) return;

      // La groupKey est Argon2id-dérivée (coûteux, ~100ms) : on la garde
      // entre deux tentatives pour que la reconnexion soit quasi immédiate.
      if (keyRef.current === null) {
        const groupKey = await deriveGroupKeyRef.current(householdId);
        if (cancelled) return;
        keyRef.current = groupKey;
      }

      const client = createRelayClientRef.current(
        accessToken,
        async (msg) => {
          if (keyRef.current === null) return;
          const currentDoc = getDocSnapshotRef.current();
          if (currentDoc === null) return;

          try {
            const newDoc = await consumeSyncMessage(currentDoc, msg.blobJson, keyRef.current);
            // Extraire uniquement le delta pour éviter de re-persister des
            // changements déjà présents dans le doc local.
            const deltaChanges = getDocChanges(currentDoc, newDoc);
            if (deltaChanges.length > 0) {
              receiveChanges(deltaChanges);
              cursorRef.current = recordReceived(cursorRef.current, deltaChanges);
            }
          } catch (err: unknown) {
            // Message invalide, corrompu ou clé incorrecte — la sync continue.
            // Aucune donnée santé n'est loggée : on n'émet qu'un événement de
            // télémétrie pseudonymisé (payload figé par `DecryptFailedEvent`),
            // jamais `err.message` ni `err.stack`.
            // Refs: KIN-040, kz-securite-KIN-038.md §M2.
            telemetryReporterRef.current?.track({
              householdId,
              errorClass: classifyDecryptError(err),
              seq: msg.seq,
            });
          }
        },
        handleDisconnect,
      );

      if (cancelled) {
        client.close();
        return;
      }

      clientRef.current = client;
      setConnected(true);

      // Reset du compteur si la connexion reste stable ≥ STABILITY_RESET_MS.
      // Un flap avant cette échéance laisse le compteur intact → la rampe
      // de backoff continue de s'appliquer.
      clearStabilityTimer();
      stabilityTimerRef.current = setTimeout(() => {
        stabilityTimerRef.current = null;
        failuresCountRef.current = 0;
      }, STABILITY_RESET_MS);
    };

    void connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      clearStabilityTimer();
      clientRef.current?.close();
      clientRef.current = null;
      keyRef.current = null;
      failuresCountRef.current = 0;
      setConnected(false);
      // Flush le storm en cours avant de perdre la fenêtre rate-limit.
      telemetryReporterRef.current?.flush();
    };
  }, [accessToken, deviceId, householdId, docReady, receiveChanges]);

  // 2. Sur chaque mutation du doc local, construire et pousser le delta au relai.
  React.useEffect(() => {
    if (
      doc === null ||
      clientRef.current === null ||
      keyRef.current === null ||
      deviceId === null ||
      householdId === null
    ) {
      return;
    }

    // Calcule le delta depuis le dernier envoi (ou doc complet si jamais envoyé).
    const before = cursorRef.current.lastSentDoc ?? doc;

    const localKey = keyRef.current;
    const localClient = clientRef.current;
    const localSeq = ++seqRef.current;

    void (async () => {
      const msg = await buildSyncMessage(before, doc, localKey, {
        mailboxId: householdId,
        deviceId,
        seq: localSeq,
      });
      if (msg !== null) {
        localClient.send(msg);
        cursorRef.current = recordSent(cursorRef.current, doc);
      }
    })();
  }, [doc, deviceId, householdId]);

  return { connected };
}
