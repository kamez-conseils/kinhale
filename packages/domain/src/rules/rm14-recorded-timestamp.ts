/**
 * Seuil par défaut (ms) au-delà duquel une saisie est considérée comme une
 * **sync tardive** : le client a saisi la prise hors-ligne puis s'est
 * synchronisé plus tard. Les notifications post-sync doivent alors mentionner
 * explicitement les deux horodatages (« saisie il y a X, prise à HH:MM »).
 *
 * La comparaison est **strictement supérieure** (`>` seuil) — un écart de
 * exactement 60 000 ms reste classé « en ligne ».
 */
export const LATE_SYNC_THRESHOLD_MS = 60_000;

/**
 * Tolérance admise pour les saisies « légèrement dans le futur » dues au bruit
 * NTP ou à la latence réseau (le client marque `now` puis envoie la requête,
 * le serveur la reçoit quelques ms plus tard avec une horloge légèrement en
 * arrière). En dessous de 1 s vers le futur, aucun `clockSkewWarning`.
 */
const CLOCK_SKEW_TOLERANCE_MS = 1_000;

/** Options d'application de la règle RM14. */
export interface RecordTimestampOptions {
  /** Horodatage déclaré par le client. Conservé tel quel (client fait foi). */
  readonly administeredAtUtc: Date;
  /** Horodatage serveur « maintenant » — injecté, jamais `Date.now()`. */
  readonly serverReceivedAtUtc: Date;
  /**
   * Surcharge du seuil de sync tardive (ms). Par défaut
   * {@link LATE_SYNC_THRESHOLD_MS}. Utile pour tester des scénarios spécifiques
   * ou adapter la sensibilité côté client mobile vs. web.
   */
  readonly lateSyncThresholdMs?: number;
}

/**
 * Résultat de l'application RM14 : horodatages consolidés + métadonnées de
 * latence pour la couche notification.
 */
export interface DoseTimestampingResult {
  /** Copie de `administeredAtUtc` (client fait foi). */
  readonly administeredAtUtc: Date;
  /** Horodatage serveur autoritaire. Copie de `serverReceivedAtUtc`. */
  readonly recordedAtUtc: Date;
  /**
   * `recordedAtUtc - administeredAtUtc` en ms.
   * - Positif : cas normal (saisie dans le passé, éventuellement tardive).
   * - Négatif : le client a déclaré un horodatage dans le futur (dérive NTP
   *   ou tentative de falsification). La saisie **n'est pas refusée ici**
   *   (RM14 = traçabilité, pas contrôle) ; c'est RM17 qui peut rejeter.
   */
  readonly syncLatencyMs: number;
  /** `true` si `syncLatencyMs > lateSyncThresholdMs`. */
  readonly isLateSync: boolean;
  /**
   * `true` si la saisie est déclarée plus loin dans le futur que la tolérance
   * d'horloge (≥ 1 s). Sert à informer l'opérateur sans bloquer la saisie.
   */
  readonly clockSkewWarning: boolean;
}

/**
 * RM14 — applique l'horodatage serveur autoritaire à une prise.
 *
 * Sémantique :
 * - `administeredAtUtc` du client est **conservé tel quel** : c'est la source
 *   de vérité métier (« quand la pompe a été prise »). Cf. SPECS §RM14.
 * - `recordedAtUtc` est posé par le serveur à la réception : c'est l'heure de
 *   saisie, utilisée pour la détection de doublons (RM6), l'ordre canonique
 *   dans les journaux et la fenêtre de void (RM18).
 *
 * Fonction pure, aucun `Date.now()`, aucune lecture d'horloge interne : tout
 * est injecté par l'appelant. Retourne de nouvelles instances de `Date` pour
 * éviter tout aliasing externe.
 *
 * RM14 n'émet **aucune erreur** : c'est une règle de traçabilité, pas de
 * refus. Les contrôles d'acceptabilité (futur, trop vieux) relèvent de RM17.
 */
export function assignAuthoritativeTimestamp(
  options: RecordTimestampOptions,
): DoseTimestampingResult {
  const threshold = options.lateSyncThresholdMs ?? LATE_SYNC_THRESHOLD_MS;

  const administeredMs = options.administeredAtUtc.getTime();
  const recordedMs = options.serverReceivedAtUtc.getTime();
  const syncLatencyMs = recordedMs - administeredMs;

  const isLateSync = syncLatencyMs > threshold;
  const clockSkewWarning = syncLatencyMs < -CLOCK_SKEW_TOLERANCE_MS;

  return {
    administeredAtUtc: new Date(administeredMs),
    recordedAtUtc: new Date(recordedMs),
    syncLatencyMs,
    isLateSync,
    clockSkewWarning,
  };
}
