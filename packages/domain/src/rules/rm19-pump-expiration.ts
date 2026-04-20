import type { Pump } from '../entities/pump';
import { DomainError } from '../errors';

/**
 * Fenêtre d'avertissement (en jours) avant la date de péremption d'une pompe.
 * À 30 j de l'échéance, un événement `pump_expiring_threshold_crossed` est
 * émis pour déclencher la notification `pump_expiring` (SPECS §6 RM19).
 *
 * Borne **inclusive** : une pompe à exactement J-30 déclenche l'événement
 * (convention cohérente avec les autres bornes du domaine, RM2/RM17/RM18/RM20).
 */
export const PUMP_EXPIRING_WARNING_WINDOW_DAYS = 30;

const ONE_DAY_MS = 86_400_000;

/**
 * Événements métier émis par {@link evaluatePumpExpiration} pour notifier les
 * transitions du cycle de vie « péremption » d'une pompe. Consommés côté
 * `apps/api` pour mapper vers la notification `pump_expiring` (SPECS §3.10).
 *
 * - `pump_expiring_threshold_crossed` : la pompe vient de franchir (descendant)
 *   le seuil J-30. Émis **une seule fois** au franchissement, jamais réémis.
 *   Similaire à la sémantique edge-triggered de RM7 (`pump_low_threshold_crossed`).
 * - `pump_expired` : la date de péremption est atteinte ou dépassée. Émis une
 *   fois, au passage en statut `expired`. L'instance de pompe renvoyée a son
 *   `status` corrigé à `'expired'`.
 */
export type PumpLifecycleEvent = 'pump_expiring_threshold_crossed' | 'pump_expired';

/**
 * Résultat de l'évaluation du cycle de vie péremption d'une pompe : pompe
 * (éventuellement avec `status` mis à jour) + liste d'événements à propager.
 */
export interface PumpLifecycleUpdate {
  readonly pump: Pump;
  readonly events: ReadonlyArray<PumpLifecycleEvent>;
}

/**
 * RM19 — calcule le nombre de jours restants avant la péremption. Retourne
 * `null` si la pompe n'a pas de date de péremption (`expiresAt === null`),
 * ce qui correspond à l'usage de dépannage où le flacon n'affiche pas de
 * date lisible.
 *
 * Convention d'arrondi : `Math.floor` sur la différence en millisecondes. À
 * 30 j et 1 minute, on est encore à `30` (la pompe vient juste d'entrer dans
 * la fenêtre, pas d'urgence à afficher J-29). À J-0, retourne `0`. Après
 * expiration, valeur négative.
 *
 * Comparaison en UTC pur — cohérent avec RM14.
 */
export function daysUntilExpiration(pump: Pump, nowUtc: Date): number | null {
  if (pump.expiresAt === null) {
    return null;
  }
  const deltaMs = pump.expiresAt.getTime() - nowUtc.getTime();
  return Math.floor(deltaMs / ONE_DAY_MS);
}

/**
 * Statuts « terminaux » du cycle de vie pompe : `empty` et `archived` ne
 * doivent pas être réconciliés en `expired` par RM19. Une pompe vidée ou
 * archivée l'est définitivement ; la péremption devient sans objet.
 */
const TERMINAL_STATUSES = new Set<Pump['status']>(['empty', 'archived', 'expired']);

/**
 * RM19 — évalue l'état d'expiration d'une pompe à un instant donné et émet
 * les événements métier correspondants.
 *
 * Sémantique edge-triggered (comme RM7) :
 * - `pump_expiring_threshold_crossed` n'est émis **qu'au franchissement**
 *   descendant du seuil J-30. Détecté via `previousRemainingDays` : si la
 *   précédente évaluation était strictement > 30 et la nouvelle ≤ 30, on
 *   émet. Sans `previousRemainingDays`, on reste conservatif — aucune
 *   émission, pour éviter le spam de notification à chaque appel.
 * - `pump_expired` est émis au passage à `status = 'expired'`. Si la pompe
 *   est déjà `expired` / `empty` / `archived`, rien n'est émis et le status
 *   est préservé.
 *
 * Si `pump_expired` est levé, il prend le pas sur `pump_expiring_*` (une
 * pompe expirée n'a plus besoin d'avertissement préventif).
 *
 * Fonction pure. Retourne la même instance si aucun changement ; nouvelle
 * instance avec `status` mis à jour si passage à `expired`.
 */
export function evaluatePumpExpiration(options: {
  readonly pump: Pump;
  readonly previousRemainingDays?: number;
  readonly nowUtc: Date;
}): PumpLifecycleUpdate {
  const { pump, previousRemainingDays, nowUtc } = options;

  // Pompe sans date : hors du cycle RM19.
  if (pump.expiresAt === null) {
    return { pump, events: [] };
  }

  // Pompes en statut terminal (empty / archived / déjà expired) : pas de
  // réconciliation. La péremption devient sans objet dès qu'une pompe est
  // sortie du cycle normal.
  if (TERMINAL_STATUSES.has(pump.status)) {
    return { pump, events: [] };
  }

  const remainingDays = Math.floor((pump.expiresAt.getTime() - nowUtc.getTime()) / ONE_DAY_MS);

  // Cas 1 : expirée (J-0 ou au-delà). Passage en `expired`, événement unique
  // `pump_expired` qui prime sur l'avertissement J-30.
  if (remainingDays <= 0) {
    const updatedPump: Pump = { ...pump, status: 'expired' };
    return { pump: updatedPump, events: ['pump_expired'] };
  }

  // Cas 2 : franchissement descendant du seuil J-30. Nécessite un état
  // précédent pour être edge-triggered, sinon pas d'émission (conservatif).
  if (
    previousRemainingDays !== undefined &&
    previousRemainingDays > PUMP_EXPIRING_WARNING_WINDOW_DAYS &&
    remainingDays <= PUMP_EXPIRING_WARNING_WINDOW_DAYS
  ) {
    return { pump, events: ['pump_expiring_threshold_crossed'] };
  }

  return { pump, events: [] };
}

/**
 * RM19 — normalise une justification Admin : retourne `null` si absente,
 * vide ou whitespace-only ; sinon la chaîne trimée.
 */
function normalizeJustification(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * RM19 — détermine si une pompe a effectivement dépassé sa date de
 * péremption (expiresAt ≤ nowUtc), indépendamment du statut courant. Utilisé
 * par {@link canUsePumpForDose} pour refuser une prise même quand le statut
 * n'a pas encore été réconcilié par {@link evaluatePumpExpiration}.
 */
function isEffectivelyExpired(pump: Pump, nowUtc: Date): boolean {
  if (pump.status === 'expired') {
    return true;
  }
  if (pump.expiresAt === null) {
    return false;
  }
  return pump.expiresAt.getTime() <= nowUtc.getTime();
}

/**
 * RM19 — vrai ssi la pompe peut accueillir une nouvelle prise. Cas bloquants
 * RM19 :
 * - pompe effectivement expirée (status `expired` OU date dépassée) sans
 *   `adminForcedJustification` non vide.
 *
 * Cas délégués (renvoient `false` sans lever RM19) : `empty`, `archived`. Ces
 * statuts relèvent de RM7 (`RM7_PUMP_ALREADY_EMPTY`, `RM7_PUMP_NOT_USABLE`).
 * {@link ensurePumpUsableForDose} ne lèvera donc pas `RM19_PUMP_EXPIRED` pour
 * ces cas — c'est à l'appelant de chaîner vers RM7 pour obtenir un message
 * adapté.
 */
export function canUsePumpForDose(options: {
  readonly pump: Pump;
  readonly nowUtc: Date;
  readonly adminForcedJustification?: string;
}): boolean {
  const { pump, nowUtc, adminForcedJustification } = options;

  if (pump.status === 'empty' || pump.status === 'archived') {
    return false;
  }

  if (isEffectivelyExpired(pump, nowUtc)) {
    return normalizeJustification(adminForcedJustification) !== null;
  }

  return true;
}

/**
 * RM19 — assertion : la pompe accepte une nouvelle prise. Lève
 * `RM19_PUMP_EXPIRED` si la pompe est expirée sans override Admin valide.
 *
 * Ne lève **pas** pour les statuts `empty` / `archived` : ces cas sont
 * portés par RM7 pour éviter la duplication de codes d'erreur. L'appelant
 * doit ensuite passer par RM7 si besoin d'une vérification complémentaire.
 *
 * @throws {DomainError} `RM19_PUMP_EXPIRED` si la pompe est en status
 *   `expired` (ou si sa date de péremption est déjà passée) et qu'aucune
 *   justification Admin non vide n'est fournie.
 */
export function ensurePumpUsableForDose(options: {
  readonly pump: Pump;
  readonly nowUtc: Date;
  readonly adminForcedJustification?: string;
}): void {
  const { pump, nowUtc, adminForcedJustification } = options;

  if (pump.status === 'empty' || pump.status === 'archived') {
    // Délégation à RM7 — on ne lève pas RM19 ici.
    return;
  }

  if (!isEffectivelyExpired(pump, nowUtc)) {
    return;
  }

  if (normalizeJustification(adminForcedJustification) !== null) {
    return;
  }

  throw new DomainError(
    'RM19_PUMP_EXPIRED',
    `Pump ${pump.id} is expired; a new dose requires an admin-provided justification.`,
    {
      pumpId: pump.id,
      status: pump.status,
      expiresAt: pump.expiresAt?.toISOString() ?? null,
      nowUtc: nowUtc.toISOString(),
    },
  );
}
