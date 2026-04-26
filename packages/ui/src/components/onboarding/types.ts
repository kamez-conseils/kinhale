// Types partagés des composants Onboarding.
//
// Le flow est un funnel séquentiel à 5 étapes :
//   0 — Welcome (prénom enfant)
//   1 — Pumps (toggle fond + secours)
//   2 — Plan (horaires matin/soir + plan d'action vert/jaune/rouge)
//   3 — First dose guidée (4 sous-étapes : shake / insert / breathe / rinse)
//   4 — Done (récap + bouton "Aller à l'accueil")
//
// Le `OnboardingShell` est purement présentationnel — c'est l'app
// appelante qui pilote la navigation entre étapes (push de route),
// la persistance et la validation des données.

export type OnboardingStep = 'welcome' | 'pumps' | 'plan' | 'first-dose' | 'done';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'pumps',
  'plan',
  'first-dose',
  'done',
];

export interface OnboardingShellCopy {
  /** Libellé du bouton skip (haut à droite). */
  skip: string;
  /** Libellé du bouton retour ARIA. */
  back: string;
}
