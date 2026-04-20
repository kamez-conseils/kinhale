import type { Dose, DoseType } from '../entities/dose';
import type { Household } from '../entities/household';
import { activeCaregivers } from '../entities/household';
import type { Role } from '../entities/role';

/**
 * Seuil au-delà duquel le décalage entre `administeredAtUtc` et l'horodatage
 * serveur doit être exposé aux destinataires (UI affichera « synchronisée à
 * HH:MM »). La borne est **inclusive** : à 5 min 00 s pile, le champ
 * `syncOffsetMs` reste absent.
 *
 * Référence : SPECS §W8, RM14/RM5 — alignement avec le flux de sync.
 */
export const PEER_SYNC_OFFSET_THRESHOLD_MS = 5 * 60_000;

/**
 * Destinataire d'une notification peer, exposé avec son rôle pour permettre
 * à l'appelant (infra push/email) de filtrer encore en aval — notamment pour
 * ne cibler que les Admins sur certains événements (RM7 `pump_low`, etc.).
 */
export interface PeerNotificationRecipient {
  readonly caregiverId: string;
  readonly role: Role;
}

/**
 * Événement métier `peer_dose_recorded` — décrit la décision d'émettre une
 * notification informative aux autres aidants suite à une nouvelle prise.
 *
 * **Pas de donnée santé dans le payload** : ni dose, ni nom de pompe, ni
 * prénom. Seuls des identifiants opaques et des horodatages transitent par
 * le relais (RM16). Le contenu lisible est reconstruit côté client à
 * l'ouverture via appel authentifié.
 */
export interface PeerNotificationEvent {
  readonly kind: 'peer_dose_recorded';
  readonly doseId: string;
  readonly pumpId: string;
  readonly doseType: DoseType;
  readonly authorCaregiverId: string;
  readonly recipients: ReadonlyArray<PeerNotificationRecipient>;
  /**
   * Décalage en ms entre `administeredAtUtc` et l'horodatage serveur — exposé
   * **uniquement** si strictement supérieur à {@link PEER_SYNC_OFFSET_THRESHOLD_MS}
   * (SPECS §W8 : « mention synchronisée à [heure] si décalage > 5 min »). En
   * dessous du seuil ou si le décalage est négatif (client en avance), le
   * champ est absent.
   */
  readonly syncOffsetMs?: number;
}

/**
 * RM5 — calcule les destinataires et l'événement de notification croisée à
 * émettre suite à l'enregistrement d'une prise par un aidant.
 *
 * Fonction **pure** : aucun I/O, aucune lecture d'horloge, aucun envoi réel.
 * Elle décrit la **décision** ; l'émission effective (push, local, email)
 * est portée par `apps/api`.
 *
 * Règles d'inclusion (cf. SPECS RM5 + W6 ligne 450) :
 * - L'auteur (`dose.caregiverId`) est toujours **exclu** des destinataires.
 * - Seuls les aidants `status === 'active'` sont inclus.
 * - Les aidants de rôle `restricted_contributor` sont **exclus** (session
 *   éphémère sans push — SPECS W6).
 *
 * Règles de déclenchement :
 * - Prise `voided` → aucune notification peer (retour `null`) ; le flux de
 *   void est un autre parcours.
 * - Prise `pending_review` → aucune notification peer (retour `null`) ; le
 *   flux de double-saisie émet `dispute_detected`, pas `peer_dose_recorded`.
 * - Aucun destinataire après filtrage → retour `null` (rien à émettre).
 *
 * Défensif sur les incohérences :
 * - Si `dose.caregiverId` n'apparaît pas dans le foyer (cas aberrant en
 *   pratique, ex. race condition d'ingestion), on **n'échoue pas** : on
 *   retourne simplement l'événement avec tous les aidants actifs
 *   non-restricted comme destinataires. Ce choix privilégie la robustesse
 *   du flux d'ingestion ; la cohérence référentielle est contrôlée ailleurs
 *   (validation API, intégrité du document Automerge).
 */
export function planPeerNotification(options: {
  readonly household: Household;
  readonly dose: Dose;
  readonly serverReceivedAtUtc: Date;
}): PeerNotificationEvent | null {
  const { household, dose, serverReceivedAtUtc } = options;

  // RM5 ne traite que les prises `confirmed` (voided / pending_review sont
  // portés par d'autres flux notifications).
  if (dose.status !== 'confirmed') {
    return null;
  }

  const recipients: PeerNotificationRecipient[] = activeCaregivers(household)
    .filter((c) => c.role !== 'restricted_contributor')
    .filter((c) => c.id !== dose.caregiverId)
    .map((c) => ({ caregiverId: c.id, role: c.role }));

  if (recipients.length === 0) {
    return null;
  }

  const syncOffsetMs = serverReceivedAtUtc.getTime() - dose.administeredAtUtc.getTime();

  const base: PeerNotificationEvent = {
    kind: 'peer_dose_recorded',
    doseId: dose.id,
    pumpId: dose.pumpId,
    doseType: dose.type,
    authorCaregiverId: dose.caregiverId,
    recipients,
  };

  if (syncOffsetMs > PEER_SYNC_OFFSET_THRESHOLD_MS) {
    return { ...base, syncOffsetMs };
  }
  return base;
}
