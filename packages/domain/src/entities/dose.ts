/**
 * Type de prise. Miroir du type de pompe : une prise `maintenance` est
 * administrée sur une pompe de fond, une prise `rescue` sur une pompe de
 * secours. Les règles métier diffèrent (RM2, RM3, RM4).
 */
export type DoseType = 'maintenance' | 'rescue';

/**
 * Comment la prise est-elle arrivée dans le système ?
 * - `manual` : saisie directe par un aidant.
 * - `reminder` : confirmée depuis un rappel push.
 * - `backfill` : rattrapage hors fenêtre (RM17 — jusqu'à 24 h après la cible).
 * - `sync_replay` : rejouée depuis la file hors-ligne (RM20, RM14).
 */
export type DoseSource = 'manual' | 'reminder' | 'backfill' | 'sync_replay';

/**
 * Statut de la prise. Les transitions légales sont décrites dans les specs §3.6 :
 * `confirmed` <-> `pending_review` (RM6), `confirmed` -> `voided` (RM18).
 */
export type DoseStatus = 'confirmed' | 'pending_review' | 'voided';

/**
 * Symptômes possibles lors d'une prise `rescue`. La liste est libre côté UI
 * mais structurée côté domaine pour servir les rapports médecins (RM8). Les
 * tags libres sont portés par `freeFormTag`.
 */
export type Symptom = 'cough' | 'wheezing' | 'shortness_of_breath' | 'chest_tightness';

export type Circumstance = 'exercise' | 'allergen' | 'cold_air' | 'night' | 'infection' | 'stress';

/**
 * Prise de pompe (maintenance ou rescue). Entité purement de domaine — aucune
 * donnée santé n'est persistée en clair côté relais ; ce type décrit le
 * contenu du document Automerge local.
 */
export interface Dose {
  readonly id: string;
  readonly householdId: string;
  readonly childId: string;
  readonly pumpId: string;
  readonly caregiverId: string;
  readonly type: DoseType;
  readonly status: DoseStatus;
  readonly source: DoseSource;
  readonly dosesAdministered: number;
  /** Horodatage déclaré par le client (RM14), toujours en UTC. */
  readonly administeredAtUtc: Date;
  /** Horodatage serveur (RM14), posé à la réception. Null tant qu'hors-ligne. */
  readonly recordedAtUtc: Date | null;
  /** Symptômes observés — uniquement pour `rescue`. */
  readonly symptoms: ReadonlyArray<Symptom>;
  /** Circonstances — uniquement pour `rescue`. */
  readonly circumstances: ReadonlyArray<Circumstance>;
  /** Tag libre (text court) — peut remplacer symptom/circumstance côté RM4. */
  readonly freeFormTag: string | null;
  /** Raison d'annulation, obligatoire si status=voided et >30 min après la saisie (RM18). */
  readonly voidedReason: string | null;
}
