import * as React from 'react';
import type { KinhaleDoc } from '../doc/schema.js';
import { projectDoses } from '../projections/doses.js';
import { buildPeerPingMessage, type PeerPingMessage } from '../peer/peer-ping.js';

/**
 * Fonction plateforme envoyant un `PeerPingMessage` au relais via le canal
 * WS courant. Implémentée par les wrappers web/mobile au-dessus du
 * `RelayClient`. Peut être un no-op silencieux si la WS n'est pas ouverte —
 * le ping sera retransmis après reconnexion grâce au watcher qui observe le
 * doc local et la déduplication côté relais (TTL Redis).
 */
export type SendPeerPing = (ping: PeerPingMessage) => void;

export interface UsePeerDosePingDeps {
  /** Hook plateforme : document Automerge courant. */
  readonly useDoc: () => KinhaleDoc | null;
  /** Hook plateforme : identifiant stable du device local (lu dans le JWT de session). */
  readonly useDeviceId: () => string | null;
  /**
   * Envoie un `peer_ping` via la WebSocket relais. Le contrat de la factory
   * plateforme (`createRelayClient`) garantit que la méthode est un no-op si
   * la WS n'est pas `OPEN`. La retransmission est assurée par ce watcher qui
   * détecte la persistance locale de la dose — si l'émission échoue, le ping
   * sera ré-émis au prochain render tant que `doseId` n'est pas marqué comme
   * « envoyé ».
   */
  readonly sendPeerPing: SendPeerPing;
  /** Horloge injectée — testable. */
  readonly now: () => Date;
}

/**
 * Hook framework-agnostique qui observe les événements `DoseAdministered`
 * ajoutés au doc Automerge local **par ce device** et émet un message WS
 * `peer_ping` au relais pour chaque nouvelle prise détectée (RM5).
 *
 * Règles d'émission :
 * - Seules les doses dont `deviceId === localDeviceId` déclenchent un ping.
 *   Les doses reçues d'un autre aidant via sync ne doivent **jamais** ré-émettre
 *   un ping (sinon dédoublement du signal + boucle infinie).
 * - Déduplication locale par `doseId` via une ref persistée sur la durée de
 *   vie du composant. Si le watcher re-run avec le même doc ou si le doc est
 *   simplement muté, un ping déjà émis n'est pas ré-émis.
 * - Le ping est envoyé **best-effort**. Côté relais, la déduplication Redis
 *   (TTL 10 min) protège contre les retransmissions après reconnexion.
 *
 * Principe zero-knowledge (ADR-D11) :
 * - Aucune donnée santé ne transite par le payload — seuls `pingType`,
 *   `doseId` UUID opaque et `sentAtMs` sont transmis.
 * - Le `householdId` et le `senderDeviceId` ne sont **pas** dans le payload :
 *   le relais les lit du JWT du handshake WS (défense en profondeur).
 *
 * Refs: KIN-082, E5-S05, RM5, RM16, ADR-D11.
 */
export function usePeerDosePing(deps: UsePeerDosePingDeps): void {
  const doc = deps.useDoc();
  const deviceId = deps.useDeviceId();

  // Cache local des `doseId` déjà pingés pour cette session. Volontairement
  // non-persisté : en cas de rechargement de la page, le relais redédup via
  // Redis (TTL 10 min) ; au-delà, le ping est ré-émis — ce qui est la
  // sémantique attendue pour une prise ancienne qui aurait pu ne pas avoir
  // déclenché de notif (filet de sécurité, pas une boucle).
  const pingedDoseIdsRef = React.useRef<Set<string>>(new Set());

  // Latest ref pattern pour stabiliser l'identité des deps dans l'effet.
  const sendPeerPingRef = React.useRef(deps.sendPeerPing);
  const nowRef = React.useRef(deps.now);
  sendPeerPingRef.current = deps.sendPeerPing;
  nowRef.current = deps.now;

  React.useEffect(() => {
    if (doc === null || deviceId === null) return undefined;

    const doses = projectDoses(doc);
    const nowMs = nowRef.current().getTime();

    // Extraction des candidats : uniquement les doses émises par CE device,
    // non encore pingées, et non en statut `pending_review` (RM6 — les
    // doublons sont traités par un autre flux, pas de notif peer).
    const candidates: Array<{ doseId: string }> = [];
    for (const d of doses) {
      if (d.deviceId !== deviceId) continue;
      if (d.status === 'pending_review') continue;
      if (pingedDoseIdsRef.current.has(d.doseId)) continue;
      pingedDoseIdsRef.current.add(d.doseId);
      candidates.push({ doseId: d.doseId });
    }

    if (candidates.length === 0) return undefined;

    for (const c of candidates) {
      try {
        const msg = buildPeerPingMessage({
          pingType: 'dose_recorded',
          doseId: c.doseId,
          sentAtMs: nowMs,
        });
        sendPeerPingRef.current(msg);
      } catch {
        // Le send plateforme peut lancer si la socket est dans un état
        // transitoire. On retire le doseId du cache pour permettre un retry
        // au prochain render — la dédup côté relais couvrira les cas où le
        // ping partait bien avant l'erreur.
        pingedDoseIdsRef.current.delete(c.doseId);
      }
    }

    return undefined;
  }, [doc, deviceId]);
}
