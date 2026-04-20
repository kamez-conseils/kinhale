import { describe, expect, it } from 'vitest';
import {
  assertDisclaimerCoverage,
  DISCLAIMER_TEXT_EN,
  DISCLAIMER_TEXT_FR,
  type DisclaimerSurface,
  type DisclaimerSurfaceContent,
  getDisclaimerText,
  REQUIRED_SURFACES,
} from './rm27-disclaimer-presence';

function contentFr(surface: DisclaimerSurface, extra = ''): DisclaimerSurfaceContent {
  return {
    surface,
    locale: 'fr',
    text: extra ? `${extra}\n\n${DISCLAIMER_TEXT_FR}` : DISCLAIMER_TEXT_FR,
  };
}

function contentEn(surface: DisclaimerSurface, extra = ''): DisclaimerSurfaceContent {
  return {
    surface,
    locale: 'en',
    text: extra ? `${extra}\n\n${DISCLAIMER_TEXT_EN}` : DISCLAIMER_TEXT_EN,
  };
}

describe('RM27 — constantes', () => {
  it('expose le disclaimer FR strictement conforme aux SPECS §4 RM27', () => {
    expect(DISCLAIMER_TEXT_FR).toBe(
      'Kinhale est un outil de suivi et de coordination. Il ne remplace pas un avis médical.',
    );
  });

  it('expose la traduction EN', () => {
    expect(DISCLAIMER_TEXT_EN).toBe(
      'Kinhale is a tracking and coordination tool. It does not replace medical advice.',
    );
  });

  it("liste les 4 surfaces requises dans l'ordre SPECS (onboarding, cgu, report_footer, about)", () => {
    expect(REQUIRED_SURFACES).toEqual(['onboarding', 'cgu', 'report_footer', 'about']);
  });
});

describe('RM27 — getDisclaimerText', () => {
  it('retourne le texte FR pour locale fr', () => {
    expect(getDisclaimerText('fr')).toBe(DISCLAIMER_TEXT_FR);
  });

  it('retourne le texte EN pour locale en', () => {
    expect(getDisclaimerText('en')).toBe(DISCLAIMER_TEXT_EN);
  });
});

describe('RM27 — assertDisclaimerCoverage (chemin nominal)', () => {
  it('accepte les 4 surfaces présentes en FR avec le bon texte', () => {
    const result = assertDisclaimerCoverage({
      contents: [
        contentFr('onboarding'),
        contentFr('cgu'),
        contentFr('report_footer'),
        contentFr('about'),
      ],
    });

    expect(result.compliant).toBe(true);
    expect(result.missingSurfaces).toEqual([]);
    expect(result.incorrectSurfaces).toEqual([]);
  });

  it('accepte les 4 surfaces présentes en EN avec le bon texte', () => {
    const result = assertDisclaimerCoverage({
      contents: [
        contentEn('onboarding'),
        contentEn('cgu'),
        contentEn('report_footer'),
        contentEn('about'),
      ],
    });

    expect(result.compliant).toBe(true);
  });

  it('accepte un doublon FR + EN pour une même surface si les deux textes sont valides', () => {
    const result = assertDisclaimerCoverage({
      contents: [
        contentFr('onboarding'),
        contentEn('onboarding'),
        contentFr('cgu'),
        contentFr('report_footer'),
        contentFr('about'),
      ],
    });

    expect(result.compliant).toBe(true);
    expect(result.incorrectSurfaces).toEqual([]);
  });

  it('accepte un disclaimer noyé dans un texte plus large (inclusion, pas match strict)', () => {
    // Un écran d'onboarding peut contenir un titre, un bouton, puis le
    // disclaimer en pied. L'inclusion (String#includes) est le critère retenu.
    const result = assertDisclaimerCoverage({
      contents: [
        contentFr('onboarding', 'Bienvenue sur Kinhale'),
        contentFr('cgu', 'Article 1 — Objet'),
        contentFr('report_footer'),
        contentFr('about'),
      ],
    });

    expect(result.compliant).toBe(true);
  });

  it('ignore une surface supplémentaire non requise (ex: "email_footer")', () => {
    const extra: DisclaimerSurfaceContent = {
      surface: 'email_footer' as unknown as DisclaimerSurface,
      locale: 'fr',
      text: DISCLAIMER_TEXT_FR,
    };
    const result = assertDisclaimerCoverage({
      contents: [
        contentFr('onboarding'),
        contentFr('cgu'),
        contentFr('report_footer'),
        contentFr('about'),
        extra,
      ],
    });

    expect(result.compliant).toBe(true);
  });
});

describe('RM27 — assertDisclaimerCoverage (cas de non-conformité)', () => {
  it('signale la surface manquante (ex: pas de cgu)', () => {
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding'), contentFr('report_footer'), contentFr('about')],
    });

    expect(result.compliant).toBe(false);
    expect(result.missingSurfaces).toEqual(['cgu']);
    expect(result.incorrectSurfaces).toEqual([]);
  });

  it('signale plusieurs surfaces manquantes', () => {
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding')],
    });

    expect(result.compliant).toBe(false);
    expect(result.missingSurfaces).toEqual(['cgu', 'report_footer', 'about']);
  });

  it('signale une surface présente avec texte altéré (report_footer)', () => {
    const altered: DisclaimerSurfaceContent = {
      surface: 'report_footer',
      locale: 'fr',
      text: 'Kinhale est un outil de suivi. Il ne remplace pas un avis médical.', // phrase tronquée
    };
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding'), contentFr('cgu'), altered, contentFr('about')],
    });

    expect(result.compliant).toBe(false);
    expect(result.incorrectSurfaces).toEqual(['report_footer']);
    expect(result.missingSurfaces).toEqual([]);
  });

  it('signale une surface fr dont le texte est la version EN (locale mismatch)', () => {
    const mismatch: DisclaimerSurfaceContent = {
      surface: 'about',
      locale: 'fr',
      text: DISCLAIMER_TEXT_EN,
    };
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding'), contentFr('cgu'), contentFr('report_footer'), mismatch],
    });

    expect(result.compliant).toBe(false);
    expect(result.incorrectSurfaces).toEqual(['about']);
  });

  it('si la surface est à la fois présente-mais-altérée et répétée-correctement, la couverture est OK', () => {
    // Une surface peut apparaître plusieurs fois (ex: rendu FR et EN). Au
    // moins une occurrence doit être correcte pour la locale annoncée.
    const altered: DisclaimerSurfaceContent = {
      surface: 'about',
      locale: 'fr',
      text: 'Kinhale est super.',
    };
    const result = assertDisclaimerCoverage({
      contents: [
        contentFr('onboarding'),
        contentFr('cgu'),
        contentFr('report_footer'),
        altered,
        contentEn('about'), // version EN correcte : couvre la surface
      ],
    });

    expect(result.compliant).toBe(true);
    expect(result.missingSurfaces).toEqual([]);
    // La variante altérée FR n'est pas signalée car la surface est couverte
    // par une autre variante correcte. On rapporte la surface uniquement
    // quand AUCUNE variante n'est valide.
    expect(result.incorrectSurfaces).toEqual([]);
  });

  it("cumule missing et incorrect quand c'est le cas", () => {
    const altered: DisclaimerSurfaceContent = {
      surface: 'onboarding',
      locale: 'fr',
      text: 'Texte hors spec',
    };
    const result = assertDisclaimerCoverage({
      contents: [altered, contentFr('cgu'), contentFr('report_footer')], // about manquant
    });

    expect(result.compliant).toBe(false);
    expect(result.missingSurfaces).toEqual(['about']);
    expect(result.incorrectSurfaces).toEqual(['onboarding']);
  });
});

describe('RM27 — résilience aux variations de whitespace (inclusion avec normalisation)', () => {
  it('accepte un disclaimer précédé/suivi de newlines (trim implicite via inclusion)', () => {
    const padded: DisclaimerSurfaceContent = {
      surface: 'report_footer',
      locale: 'fr',
      text: `\n\n   ${DISCLAIMER_TEXT_FR}   \n`,
    };
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding'), contentFr('cgu'), padded, contentFr('about')],
    });

    expect(result.compliant).toBe(true);
  });

  it('REFUSE un texte qui simplement contient "avis médical" sans la phrase complète', () => {
    // Garde-fou : l'inclusion est stricte sur la PHRASE COMPLÈTE canonique,
    // pas un fuzzy match. Un rapport avec "consultez un avis médical"
    // seul n'atteste pas le disclaimer non-DM.
    const partial: DisclaimerSurfaceContent = {
      surface: 'cgu',
      locale: 'fr',
      text: 'Consultez votre avis médical en cas de doute.',
    };
    const result = assertDisclaimerCoverage({
      contents: [contentFr('onboarding'), partial, contentFr('report_footer'), contentFr('about')],
    });

    expect(result.compliant).toBe(false);
    expect(result.incorrectSurfaces).toEqual(['cgu']);
  });
});
