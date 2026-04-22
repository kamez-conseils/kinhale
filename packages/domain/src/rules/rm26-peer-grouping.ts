import type { PeerNotificationEvent, PeerNotificationRecipient } from './rm5-peer-notification';

/**
 * Fenêtre glissante (ms) pendant laquelle plusieurs prises d'un même auteur
 * sont regroupées en une seule notification (RM26, SPECS §9 ligne 812).
 *
 * Borne **inclusive** : une prise à exactement 60 min de `nowUtc` est encore
 * comptée dans la fenêtre. Choix cohérent avec RM2/RM18.
 */
export const PEER_GROUPING_WINDOW_MS = 60 * 60_000;

/**
 * Seuil de prises (prises précédentes + nouvelle) à partir duquel on bascule
 * sur une notification groupée au lieu d'émettre N notifications
 * individuelles. Le texte cible est « 3 prises enregistrées par [Aidant]
 * dans la dernière heure ».
 */
export const PEER_GROUPING_THRESHOLD_COUNT = 3;

/**
 * Cap quotidien de notifications par destinataire (toutes catégories
 * confondues). Au-delà, la notification est **supprimée** côté domaine — le
 * regroupement existant peut être mis à jour côté infra pour refléter le
 * comptage sans nouvel envoi OS (SPECS §9 ligne 811).
 *
 * La comparaison est « >= cap » : au 15e envoi effectif déjà compté, le 16e
 * candidat est filtré.
 */
export const DAILY_NOTIFICATION_HARD_CAP = 15;

/** Signature minimale d'une prise peer déjà vue dans la fenêtre glissante. */
export interface RecentPeerEvent {
  readonly doseId: string;
  readonly recordedAtUtc: Date;
}

/**
 * Résultat de la décision RM26. Trois cas :
 * - `individual` : émettre l'événement tel quel (éventuellement avec une
 *   liste de destinataires filtrée si certains ont atteint le cap).
 * - `grouped` : émettre (ou mettre à jour) un regroupement couvrant la
 *   fenêtre glissante. `countInWindow` inclut la nouvelle prise.
 * - `suppressed` : ne rien émettre. Deux raisons possibles — voir `reason`.
 */
export type PeerNotificationDecision =
  | {
      readonly kind: 'individual';
      readonly event: PeerNotificationEvent;
    }
  | {
      readonly kind: 'grouped';
      readonly authorCaregiverId: string;
      readonly recipients: ReadonlyArray<PeerNotificationRecipient>;
      readonly countInWindow: number;
      readonly windowStartUtc: Date;
      readonly windowEndUtc: Date;
    }
  | {
      readonly kind: 'suppressed';
      readonly reason: 'daily_cap_reached' | 'already_grouped_in_window';
    };

/**
 * RM26 — décide, pour un événement peer donné, s'il faut émettre
 * individuellement, regrouper ou supprimer.
 *
 * Fonction **pure** : ne mute aucun argument. Reçoit en entrée l'état
 * observé (prises précédentes du même auteur dans la fenêtre + comptage
 * journalier des destinataires + indicateur d'un regroupement actif) et
 * retourne une décision immuable.
 *
 * Logique :
 * 1. Compte les prises précédentes du même auteur dont `recordedAtUtc` est
 *    dans `[now - PEER_GROUPING_WINDOW_MS, now]` (bornes inclusives). Ajoute
 *    1 pour la nouvelle prise → `countInWindow`.
 * 2. Filtre les destinataires dont le comptage journalier atteint
 *    {@link DAILY_NOTIFICATION_HARD_CAP} ou plus.
 * 3. Si la liste de destinataires est vide → `suppressed` / `daily_cap_reached`.
 * 4. Si `hasActiveGroupedNotification === true` → `suppressed` /
 *    `already_grouped_in_window` : un regroupement précédent couvre déjà la
 *    fenêtre, l'infra se charge de mettre à jour le compteur sans nouvel
 *    envoi OS. Le domaine ne juge pas pur-compte (incrément « 3 → 4 prises »
 *    reste un regroupement), il s'appuie sur l'état passé par l'appelant.
 * 5. Si `countInWindow >= PEER_GROUPING_THRESHOLD_COUNT` → `grouped` : c'est
 *    le passage (ou la ré-évaluation) du regroupement.
 * 6. Sinon → `individual`.
 *
 * Cette règle ne prend **aucune** décision sur le contenu textuel : le
 * template « N prises enregistrées par … » est construit côté UI/infra à
 * partir de `countInWindow` + `authorCaregiverId` (reconstruit via appel
 * authentifié, cf. RM16 — jamais dans le payload push).
 */
export function decidePeerNotification(options: {
  readonly newEvent: PeerNotificationEvent;
  readonly recentPeerEventsByAuthor: ReadonlyArray<RecentPeerEvent>;
  readonly dailyNotificationCountByRecipient: ReadonlyMap<string, number>;
  readonly nowUtc: Date;
  /**
   * `true` si une notification groupée pour cet auteur couvre déjà la
   * fenêtre glissante. L'appelant passe cette information lorsqu'une
   * `peer_dose_recorded` groupée a déjà été émise : le domaine répond alors
   * `suppressed/already_grouped_in_window` pour que l'infra mette à jour
   * le regroupement existant au lieu d'envoyer une nouvelle notification.
   *
   * Par défaut `false` (aucun regroupement actif connu).
   */
  readonly hasActiveGroupedNotification?: boolean;
}): PeerNotificationDecision {
  const {
    newEvent,
    recentPeerEventsByAuthor,
    dailyNotificationCountByRecipient,
    nowUtc,
    hasActiveGroupedNotification = false,
  } = options;

  const windowEndMs = nowUtc.getTime();
  const windowStartMs = windowEndMs - PEER_GROUPING_WINDOW_MS;

  const priorInWindow = recentPeerEventsByAuthor.filter((e) => {
    const t = e.recordedAtUtc.getTime();
    return t >= windowStartMs && t <= windowEndMs;
  });
  const countInWindow = priorInWindow.length + 1;

  const filteredRecipients = newEvent.recipients.filter((r) => {
    const count = dailyNotificationCountByRecipient.get(r.caregiverId) ?? 0;
    return count < DAILY_NOTIFICATION_HARD_CAP;
  });

  if (filteredRecipients.length === 0) {
    return { kind: 'suppressed', reason: 'daily_cap_reached' };
  }

  if (hasActiveGroupedNotification) {
    return { kind: 'suppressed', reason: 'already_grouped_in_window' };
  }

  if (countInWindow >= PEER_GROUPING_THRESHOLD_COUNT) {
    return {
      kind: 'grouped',
      authorCaregiverId: newEvent.authorCaregiverId,
      recipients: filteredRecipients,
      countInWindow,
      windowStartUtc: new Date(windowStartMs),
      windowEndUtc: new Date(windowEndMs),
    };
  }

  // < seuil : notification individuelle — on réutilise l'event mais avec la
  // liste de destinataires filtrée (cap journalier).
  const event: PeerNotificationEvent =
    filteredRecipients.length === newEvent.recipients.length
      ? newEvent
      : { ...newEvent, recipients: filteredRecipients };

  return { kind: 'individual', event };
}
