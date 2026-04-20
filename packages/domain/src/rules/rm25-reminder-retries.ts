import { DomainError } from '../errors';

/**
 * Délais (ms) depuis la notification initiale pour les deux relances d'un
 * rappel manqué (SPECS RM25) :
 * - T+15 min → push local (step 1)
 * - T+30 min → e-mail fallback (step 2)
 *
 * Au-delà de T+30 min, le rappel est définitivement `missed` : plus aucune
 * relance automatique, seule une saisie backfill manuelle (RM17) peut encore
 * documenter la prise.
 *
 * Les bornes de déclenchement sont **inclusives** : à T+15:00.000 pile, la
 * step 1 est due. Choix cohérent avec RM2/RM18 (bornes inclusives) et moins
 * surprenant pour l'opérateur.
 */
export const REMINDER_RETRY_DELAYS_MS: ReadonlyArray<number> = [15 * 60_000, 30 * 60_000] as const;

/** Canal d'acheminement d'une relance — mappé côté infra vers le service idoine. */
export type ReminderRetryChannel = 'local_push' | 'email_fallback';

/** Index de relance dans le plan (1 = push local T+15, 2 = e-mail T+30). */
export type ReminderRetryStepIndex = 1 | 2;

/**
 * Étape planifiée d'une relance : canal + instant prévu. Consommé par le
 * scheduler applicatif qui appelle le service de notification au moment venu.
 */
export interface ReminderRetryStep {
  readonly step: ReminderRetryStepIndex;
  readonly channel: ReminderRetryChannel;
  readonly scheduledAtUtc: Date;
}

/**
 * Plan complet des relances pour un rappel manqué donné. Immuable ; tous les
 * instants sont dérivés de `initialNotifiedAtUtc`.
 */
export interface ReminderRetryPlan {
  readonly reminderId: string;
  readonly initialNotifiedAtUtc: Date;
  readonly retries: ReadonlyArray<ReminderRetryStep>;
  /**
   * Instant au-delà duquel plus aucune relance n'est due : `initial +
   * dernier délai`. Le rappel peut être marqué `missed` définitivement dès
   * cet instant.
   */
  readonly finalMissedAtUtc: Date;
}

/**
 * RM25 — construit le plan de relances pour un rappel initial donné.
 *
 * Fonction **pure** : ne fait que calculer les instants. Ne programme rien
 * réellement ; c'est au scheduler applicatif de consommer ce plan.
 */
export function planReminderRetries(options: {
  readonly reminderId: string;
  readonly initialNotifiedAtUtc: Date;
}): ReminderRetryPlan {
  const base = options.initialNotifiedAtUtc.getTime();

  const retries: ReminderRetryStep[] = REMINDER_RETRY_DELAYS_MS.map((delay, index) => ({
    step: (index + 1) as ReminderRetryStepIndex,
    channel: index === 0 ? 'local_push' : 'email_fallback',
    scheduledAtUtc: new Date(base + delay),
  }));

  const lastDelay = REMINDER_RETRY_DELAYS_MS[REMINDER_RETRY_DELAYS_MS.length - 1] ?? 0;

  return {
    reminderId: options.reminderId,
    initialNotifiedAtUtc: new Date(base),
    retries,
    finalMissedAtUtc: new Date(base + lastDelay),
  };
}

/**
 * RM25 — détermine la prochaine relance due, étant donné l'état courant du
 * plan (relances déjà envoyées, heure actuelle, confirmation éventuelle de
 * la dose).
 *
 * Règles :
 * - Si `doseConfirmed`, on arrête tout : la dose a été prise, plus de relance.
 * - On cherche la première relance du plan dont `scheduledAtUtc <= nowUtc`
 *   (borne inclusive) qui n'est pas déjà listée dans `alreadySentSteps`.
 * - Si toutes les relances dues sont déjà envoyées → `null`.
 * - Si aucune relance n'est encore due → `null`.
 *
 * Tolérance à l'ordre : `alreadySentSteps` peut contenir des indices dans
 * n'importe quel ordre ou des duplicatas. Seul le **set** des indices compte.
 * Un indice manquant (ex. `[2]` sans `1`) est récupérable : la step 1 reste
 * due si le temps est écoulé. Cela permet au scheduler de rattraper un état
 * incohérent sans perdre une relance.
 *
 * @throws {DomainError} `RM25_INVALID_STEP` si `alreadySentSteps` contient un
 *   entier hors {1, 2}.
 */
export function nextReminderRetry(options: {
  readonly plan: ReminderRetryPlan;
  readonly alreadySentSteps: ReadonlyArray<ReminderRetryStepIndex>;
  readonly nowUtc: Date;
  readonly doseConfirmed: boolean;
}): ReminderRetryStep | null {
  if (options.doseConfirmed) {
    return null;
  }

  for (const raw of options.alreadySentSteps) {
    if (raw !== 1 && raw !== 2) {
      throw new DomainError(
        'RM25_INVALID_STEP',
        `alreadySentSteps values must be in {1, 2}, got ${String(raw)}.`,
        { invalidStep: raw },
      );
    }
  }

  const sent = new Set<ReminderRetryStepIndex>(options.alreadySentSteps);
  const nowMs = options.nowUtc.getTime();

  for (const retry of options.plan.retries) {
    if (sent.has(retry.step)) {
      continue;
    }
    if (retry.scheduledAtUtc.getTime() <= nowMs) {
      return retry;
    }
  }
  return null;
}
