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

/** Factory plateforme qui ouvre une connexion WS et renvoie un client relai. */
export type CreateRelayClient = (token: string, onMessage: RelayMessageHandler) => RelayClient;

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

  // Reporter de télémétrie `sync.decrypt_failed` (KIN-040). Stable pour la
  // durée de vie du hook — le rate-limiter vit dans la closure du reporter.
  // La plateforme, le hashHousehold et reportDecryptFailed sont relus via
  // refs ci-dessous pour ne jamais invalider l'effet WS.
  const platformRef = React.useRef(deps.platform);
  const hashHouseholdRef = React.useRef(deps.hashHousehold);
  const reportDecryptFailedRef = React.useRef(deps.reportDecryptFailed);
  platformRef.current = deps.platform;
  hashHouseholdRef.current = deps.hashHousehold;
  reportDecryptFailedRef.current = deps.reportDecryptFailed;

  const telemetryReporterRef = React.useRef<ReturnType<typeof createDecryptFailedReporter> | null>(
    null,
  );
  if (telemetryReporterRef.current === null) {
    telemetryReporterRef.current = createDecryptFailedReporter({
      platform: platformRef.current,
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
  React.useEffect(() => {
    if (accessToken === null || deviceId === null || householdId === null || !docReady) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      const groupKey = await deriveGroupKeyRef.current(householdId);
      if (cancelled) return;

      keyRef.current = groupKey;

      const client = createRelayClientRef.current(accessToken, async (msg) => {
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
      });

      clientRef.current = client;
      setConnected(true);
    })();

    return () => {
      cancelled = true;
      clientRef.current?.close();
      clientRef.current = null;
      keyRef.current = null;
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
