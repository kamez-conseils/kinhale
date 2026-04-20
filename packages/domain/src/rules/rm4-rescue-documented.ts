import type { Dose } from '../entities/dose';
import { DomainError } from '../errors';

type DoseLike = Pick<Dose, 'id' | 'type' | 'symptoms' | 'circumstances' | 'freeFormTag'>;

/**
 * RM4 — Une prise de type `rescue` exige **au moins** un symptôme, OU une
 * circonstance, OU un tag libre non vide. La raison : les prises de secours
 * sont des signaux cliniques structurants pour le médecin, elles doivent
 * être qualifiées. Les prises `maintenance` sont acceptées sans documentation
 * (le plan de traitement porte le contexte).
 *
 * @throws {DomainError} `RM4_RESCUE_NOT_DOCUMENTED` si aucun champ n'est renseigné.
 */
export function ensureRescueDocumented(dose: DoseLike): void {
  if (dose.type !== 'rescue') {
    return;
  }

  const hasSymptom = dose.symptoms.length > 0;
  const hasCircumstance = dose.circumstances.length > 0;
  const hasTag = dose.freeFormTag !== null && dose.freeFormTag.trim() !== '';

  if (!hasSymptom && !hasCircumstance && !hasTag) {
    throw new DomainError(
      'RM4_RESCUE_NOT_DOCUMENTED',
      `Rescue dose ${dose.id} must have at least one symptom, circumstance or free-form tag.`,
      { doseId: dose.id },
    );
  }
}
