import type { Dose } from '../entities/dose';
import type { Pump } from '../entities/pump';
import { canUsePumpForDose } from './rm19-pump-expiration';

/**
 * Fenêtre de consultation hors-ligne (en jours) — l'historique des 30 derniers
 * jours est disponible offline (SPECS §6 RM20). Au-delà, l'affichage nécessite
 * une connexion pour charger la page depuis le relais.
 *
 * Borne **inclusive** : une prise à exactement 30 jours reste consultable.
 */
export const OFFLINE_READ_WINDOW_DAYS = 30;

const ONE_DAY_MS = 86_400_000;
const OFFLINE_READ_WINDOW_MS = OFFLINE_READ_WINDOW_DAYS * ONE_DAY_MS;

/**
 * Décision RM20 côté lecture : la prise est-elle disponible dans le cache
 * local offline ? `ageDays` est fourni pour l'UI (badge « il y a N jours »).
 *
 * - `available_offline` : la prise est dans la fenêtre (0 ≤ âge ≤ 30 j).
 * - `requires_network` : la prise est plus ancienne ; l'UI doit annoncer la
 *   nécessité d'une connexion pour l'afficher.
 */
export interface OfflineReadDecision {
  readonly kind: 'available_offline' | 'requires_network';
  readonly ageDays: number;
}

/**
 * RM20 — détermine si une prise donnée est consultable en mode offline. La
 * règle ne considère **pas** l'état réseau courant (hors-domaine) ; elle
 * décide seulement si la prise doit figurer dans la projection locale des 30
 * derniers jours.
 *
 * `ageDays` est calculé avec `Math.floor` sur la différence en millisecondes :
 * une prise vieille de 29 j 23 h reste « jour 29 ». Une prise postérieure à
 * `nowUtc` (cas d'une synchronisation tardive ou d'un léger décalage
 * d'horloge) est clampée à `ageDays = 0` et reste disponible.
 *
 * Fonction pure : aucun I/O, aucune mutation.
 */
export function decideOfflineReadAccess(options: {
  readonly doseRecordedAtUtc: Date;
  readonly nowUtc: Date;
}): OfflineReadDecision {
  const elapsedMs = options.nowUtc.getTime() - options.doseRecordedAtUtc.getTime();
  const ageDays = elapsedMs <= 0 ? 0 : Math.floor(elapsedMs / ONE_DAY_MS);

  if (elapsedMs <= OFFLINE_READ_WINDOW_MS) {
    return { kind: 'available_offline', ageDays };
  }

  return { kind: 'requires_network', ageDays };
}

/**
 * RM20 — filtre une collection de prises pour ne conserver que celles
 * consultables en mode offline (30 derniers jours). L'ordre d'entrée est
 * préservé.
 *
 * Référence temporelle : `recordedAtUtc` (horodatage serveur, RM14). Si
 * absent — cas d'une prise encore dans la file offline, jamais confirmée par
 * le serveur — on retombe sur `administeredAtUtc` pour ne pas masquer les
 * saisies locales qui n'ont pas encore rejoint le relais.
 *
 * Fonction pure : retourne une **nouvelle** liste (readonly), ne mute pas
 * l'input.
 */
export function filterDosesAvailableOffline(
  doses: readonly Dose[],
  nowUtc: Date,
): ReadonlyArray<Dose> {
  return doses.filter((dose) => {
    const reference = dose.recordedAtUtc ?? dose.administeredAtUtc;
    return (
      decideOfflineReadAccess({
        doseRecordedAtUtc: reference,
        nowUtc,
      }).kind === 'available_offline'
    );
  });
}

/**
 * Décision RM20 côté écriture. La règle est simple : la saisie est toujours
 * autorisée offline **tant que la pompe le permet** (RM7 / RM19). La seule
 * raison de refus est donc côté pompe — jamais le réseau. Le domaine ne
 * connaît pas l'état de la connexion.
 */
export type OfflineWriteDecision =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'refused'; readonly reason: 'pump_not_usable' };

/**
 * RM20 — détermine si une saisie de prise est autorisée. La règle délègue
 * l'évaluation de l'état de la pompe à RM19 ({@link canUsePumpForDose}) :
 * pompes `active` et `low` acceptent la saisie ; les pompes `expired` sans
 * override Admin, `empty` ou `archived` sont refusées.
 *
 * Point important de conception : **RM20 ne bloque jamais une saisie pour
 * cause de réseau absent.** La promesse produit est « saisie offline
 * toujours possible » (SPECS §6 RM20). Le seul frein est l'intégrité du
 * cycle de vie pompe.
 *
 * Fonction pure.
 */
export function decideOfflineWriteAccess(options: {
  readonly pump: Pump;
  readonly nowUtc: Date;
  readonly adminForcedJustification?: string;
}): OfflineWriteDecision {
  const usable = canUsePumpForDose({
    pump: options.pump,
    nowUtc: options.nowUtc,
    ...(options.adminForcedJustification !== undefined
      ? { adminForcedJustification: options.adminForcedJustification }
      : {}),
  });

  if (usable) {
    return { kind: 'allowed' };
  }

  return { kind: 'refused', reason: 'pump_not_usable' };
}
