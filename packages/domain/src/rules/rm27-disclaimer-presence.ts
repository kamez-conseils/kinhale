/**
 * RM27 — Disclaimer omniprésent (SPECS §4 RM27 + §10 Transparence).
 *
 * La mention « *Kinhale est un outil de suivi et de coordination. Il ne
 * remplace pas un avis médical.* » doit apparaître à **4 emplacements** :
 * (a) onboarding, (b) CGU, (c) pied de chaque rapport exporté, (d)
 * paramètres « À propos ».
 *
 * Ce module fournit une **validation côté domaine** — pure, sans I/O. Il
 * est invoqué par les tests d'intégration (ex: un parcours E2E qui vérifie
 * la présence du disclaimer dans les rendus) et peut être exécuté en CI
 * sur un snapshot des chaînes i18n + les PDF générés.
 *
 * Choix documenté :
 * - Le critère de validation est **l'inclusion** de la phrase canonique
 *   dans le texte fourni (`text.includes(DISCLAIMER_TEXT_XX)`), et non un
 *   match strict d'égalité. Justification : un écran d'onboarding
 *   contient aussi un titre, des CTA, un récap produit ; seul le
 *   disclaimer canonique doit y être présent, intact.
 * - L'inclusion se fait sur la chaîne **brute** du contenu fourni. Toute
 *   coupe de caractères (tronquage, traduction partielle, reformulation)
 *   est détectée — c'est le point dur de RM27 : la phrase NON-DM est
 *   légalement chargée et ne doit pas être paraphrasée.
 * - Les variations de whitespace autour de la phrase (newlines, espaces)
 *   ne sont pas un problème puisque l'inclusion tolère tout préfixe /
 *   suffixe. En revanche une variation **à l'intérieur** de la phrase
 *   (ex: double espace) est refusée. Documenté.
 * - Une surface est **couverte** dès qu'au moins une variante fournie
 *   (FR ou EN, multiples rendus autorisés) matche la phrase pour sa
 *   locale. La liste `incorrectSurfaces` ne remonte que les surfaces
 *   pour lesquelles AUCUNE variante n'est valide — évite le bruit quand
 *   l'app offre plusieurs rendus (ex: FR + EN du même écran).
 * - Aucun code d'erreur RM27 n'est exposé : la fonction retourne un
 *   résultat structuré (`compliant`, `missingSurfaces`, `incorrectSurfaces`),
 *   jamais de lève. C'est une règle de **validation**, pas d'assertion.
 */

/** Phrase canonique FR — voir SPECS §4 RM27 ligne 351. */
export const DISCLAIMER_TEXT_FR =
  'Kinhale est un outil de suivi et de coordination. Il ne remplace pas un avis médical.';

/** Traduction EN officielle — miroir strict du FR. */
export const DISCLAIMER_TEXT_EN =
  'Kinhale is a tracking and coordination tool. It does not replace medical advice.';

/**
 * Les 4 surfaces imposées par RM27, dans l'ordre SPECS §4 RM27 :
 * onboarding → CGU → pied rapport exporté → À propos.
 */
export type DisclaimerSurface = 'onboarding' | 'cgu' | 'report_footer' | 'about';

/** Liste figée des surfaces requises, dans l'ordre spécifié par les SPECS. */
export const REQUIRED_SURFACES: ReadonlyArray<DisclaimerSurface> = [
  'onboarding',
  'cgu',
  'report_footer',
  'about',
];

/** Locales supportées par Kinhale en v1.0 (CLAUDE.md §Principes). */
export type DisclaimerLocale = 'fr' | 'en';

/**
 * Contenu d'une surface UI / document à vérifier. Le `text` est la chaîne
 * brute rendue à l'utilisateur pour la locale indiquée.
 */
export interface DisclaimerSurfaceContent {
  readonly surface: DisclaimerSurface;
  readonly locale: DisclaimerLocale;
  /** Texte brut rendu à l'utilisateur (peut contenir d'autres éléments). */
  readonly text: string;
}

/** Résultat de la vérification de couverture. */
export interface DisclaimerCoverageResult {
  /** `true` ssi chaque surface de {@link REQUIRED_SURFACES} est couverte. */
  readonly compliant: boolean;
  /** Surfaces totalement absentes des contenus fournis. Ordre : SPECS. */
  readonly missingSurfaces: ReadonlyArray<DisclaimerSurface>;
  /**
   * Surfaces fournies mais dont **aucune variante** (toutes locales
   * confondues) ne contient la phrase canonique pour sa locale.
   */
  readonly incorrectSurfaces: ReadonlyArray<DisclaimerSurface>;
}

/** Retourne la phrase canonique pour une locale donnée. */
export function getDisclaimerText(locale: DisclaimerLocale): string {
  return locale === 'fr' ? DISCLAIMER_TEXT_FR : DISCLAIMER_TEXT_EN;
}

/**
 * RM27 — vérifie que le disclaimer non-DM est présent aux 4 emplacements
 * requis pour au moins une locale.
 */
export function assertDisclaimerCoverage(options: {
  readonly contents: ReadonlyArray<DisclaimerSurfaceContent>;
}): DisclaimerCoverageResult {
  const missingSurfaces: DisclaimerSurface[] = [];
  const incorrectSurfaces: DisclaimerSurface[] = [];

  for (const required of REQUIRED_SURFACES) {
    const variants = options.contents.filter((c) => c.surface === required);

    if (variants.length === 0) {
      missingSurfaces.push(required);
      continue;
    }

    const hasValid = variants.some((variant) =>
      variant.text.includes(getDisclaimerText(variant.locale)),
    );

    if (!hasValid) {
      incorrectSurfaces.push(required);
    }
  }

  const compliant = missingSurfaces.length === 0 && incorrectSurfaces.length === 0;

  return {
    compliant,
    missingSurfaces,
    incorrectSurfaces,
  };
}
