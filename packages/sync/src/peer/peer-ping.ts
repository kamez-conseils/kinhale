/**
 * Protocole `peer_ping` — message WS typé signalant au relais un événement
 * métier pertinent (ex. nouvelle prise enregistrée) **sans révéler aucune
 * donnée santé**.
 *
 * Ce protocole implémente RM5 (notification croisée) dans le respect strict
 * du zero-knowledge (voir ADR-D11). Le relais apprend uniquement :
 * - le `pingType` (catégorie de la notification à déclencher, pas une donnée
 *   santé au sens du PRD §4),
 * - un `doseId` UUID v4 opaque servant de clé de déduplication côté relais
 *   (TTL 10 min Redis), non corrélable au contenu Automerge,
 * - un `sentAtMs` (instant d'émission, pas l'horodatage de prise).
 *
 * Le `householdId` et le `senderDeviceId` ne sont **pas** transmis dans le
 * payload : le relais les lit exclusivement depuis le JWT signé du handshake
 * WS (défense en profondeur contre l'usurpation).
 *
 * Refs: KIN-082, E5-S05, RM5, RM16, ADR-D11.
 */

/** Catégories de pings supportées côté relais. Ensemble fermé. */
export type PeerPingType = 'dose_recorded';

/** Ensemble fermé des types reconnus — utile pour la validation d'entrée. */
export const PEER_PING_TYPES: ReadonlyArray<PeerPingType> = ['dose_recorded'] as const;

/**
 * Message WS `peer_ping` émis par le client après l'enregistrement d'une
 * prise locale. Le format est figé et validé par `isPeerPingMessage`.
 *
 * **Interdit** : aucun champ supplémentaire contenant une donnée santé ne
 * doit être ajouté (nom de pompe, type de dose, prénom enfant, horodatage
 * de prise, symptômes, circonstances…). Toute évolution doit faire l'objet
 * d'une mise à jour de l'ADR-D11 et d'un passage `kz-securite`.
 */
export interface PeerPingMessage {
  /** Discriminant fixe — permet au relais de router vers le handler ping. */
  readonly type: 'peer_ping';
  /** Catégorie du ping. `dose_recorded` pour RM5 en v1.0. */
  readonly pingType: PeerPingType;
  /**
   * UUID v4 opaque, identifiant de la prise locale. Ne sert qu'à la
   * déduplication côté relais (clé Redis éphémère, TTL 10 min). Non
   * corrélable au contenu Automerge sans la `groupKey` — le relais ne peut
   * pas remonter du `doseId` au patient, à la pompe ou à la dose.
   */
  readonly doseId: string;
  /** Instant d'émission du ping (UTC ms) — pas l'horodatage de la prise. */
  readonly sentAtMs: number;
}

/** Test lexical minimal pour un UUID v4 (validation structurelle, pas cryptographique). */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Type guard strict pour un message entrant : vérifie que toutes les
 * propriétés attendues sont présentes et correctement typées. Tout champ
 * supplémentaire est toléré (forward-compat) mais jamais consommé par le
 * relais — évite une classe de bugs où un champ ajouté côté client laisserait
 * fuiter une donnée santé au relais par inattention.
 *
 * Contraintes :
 * - `type === 'peer_ping'`
 * - `pingType ∈ PEER_PING_TYPES`
 * - `doseId` est un UUID v4 (structure) — rejette les chaînes vides ou
 *   malformées qui pollueraient la clé Redis de déduplication.
 * - `sentAtMs` est un nombre fini positif.
 */
export function isPeerPingMessage(value: unknown): value is PeerPingMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['type'] !== 'peer_ping') return false;
  if (typeof v['pingType'] !== 'string') return false;
  if (!PEER_PING_TYPES.includes(v['pingType'] as PeerPingType)) return false;
  if (typeof v['doseId'] !== 'string') return false;
  if (!UUID_V4_REGEX.test(v['doseId'])) return false;
  if (typeof v['sentAtMs'] !== 'number') return false;
  if (!Number.isFinite(v['sentAtMs']) || v['sentAtMs'] < 0) return false;
  return true;
}

/**
 * Construit un `PeerPingMessage` à partir d'un ping local émis par le client.
 * Utilisé par `usePeerDosePing` pour centraliser la construction et garantir
 * le respect du schéma.
 */
export function buildPeerPingMessage(args: {
  readonly pingType: PeerPingType;
  readonly doseId: string;
  readonly sentAtMs: number;
}): PeerPingMessage {
  return {
    type: 'peer_ping',
    pingType: args.pingType,
    doseId: args.doseId,
    sentAtMs: args.sentAtMs,
  };
}
