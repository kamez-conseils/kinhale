import { describe, expect, it } from 'vitest';
import type { ReportData } from '../data/aggregate.js';
import { MS_PER_DAY } from '../range/date-range.js';
import { renderMedicalReportHtml, DISCLAIMER_KEY } from './medical-report-html.js';

const BASE = Date.UTC(2026, 3, 24, 12, 0, 0);

function minimalData(): ReportData {
  return {
    childAlias: 'Léa',
    childBirthYear: 2020,
    range: { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE },
    doses: [
      {
        doseId: 'd-1',
        administeredAtMs: BASE - 2 * MS_PER_DAY,
        doseType: 'rescue',
        symptoms: ['cough'],
        circumstances: ['cold_air'],
        status: 'recorded',
      },
    ],
    rescueCountByWeek: [{ weekStartIso: '2026-04-20', count: 1 }],
    symptomTimeline: [
      {
        doseId: 'd-1',
        administeredAtMs: BASE - 2 * MS_PER_DAY,
        symptoms: ['cough'],
        circumstances: ['cold_air'],
      },
    ],
    adherence: { scheduled: 60, confirmed: 55, ratio: 55 / 60 },
  };
}

const FR_STRINGS = {
  title: 'Rapport de suivi Kinhale',
  header: {
    child: 'Enfant',
    range: 'Plage',
    generator: 'Générateur',
    generatedAt: 'Généré le',
    birthYear: 'Année de naissance',
  },
  sections: {
    adherence: 'Observance du plan de fond',
    rescueFrequency: 'Fréquence prises de secours (par semaine)',
    symptomTimeline: 'Timeline symptômes & circonstances',
  },
  labels: {
    scheduled: 'Créneaux prévus',
    confirmed: 'Prises enregistrées',
    ratio: 'Ratio',
    pending: 'En attente de revue',
    week: 'Semaine du',
    none: 'Aucun',
  },
  symptom: {
    cough: 'Toux',
    wheezing: 'Sifflements',
    shortness_of_breath: 'Essoufflement',
    chest_tightness: 'Oppression thoracique',
  },
  circumstance: {
    exercise: 'Effort physique',
    allergen: 'Allergène',
    cold_air: 'Air froid',
    night: 'Nuit',
    infection: 'Infection',
    stress: 'Stress',
  },
  disclaimer:
    'Ce document est un journal fourni par les aidants. Il ne contient aucune interprétation médicale, aucune recommandation de dose, aucun diagnostic. Il est destiné à faciliter le dialogue avec le professionnel de santé.',
  integrity: {
    label: 'Intégrité',
    hashLabel: 'Hash SHA-256',
    generatorLabel: 'Générateur',
    timestampLabel: 'Horodatage',
  },
};

describe('renderMedicalReportHtml', () => {
  it("rend un HTML contenant l'en-tête enfant et la plage", () => {
    const html = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).toContain('Léa');
    expect(html).toContain('Rapport de suivi Kinhale');
    expect(html).toContain('Kinhale v1.0.0-preview');
  });

  it("inclut le disclaimer RM8 à l'emplacement attendu", () => {
    const html = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).toContain(FR_STRINGS.disclaimer);
    // Le disclaimer doit avoir un marqueur d'ancre stable pour les tests
    // et la revue conformité.
    expect(html).toContain(`data-key="${DISCLAIMER_KEY}"`);
  });

  it("ne contient aucun des mots-clés interdits par RM8 (recommandation, diagnostic, 'appelez votre médecin')", () => {
    const html = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    const lower = html.toLowerCase();
    // Le mot "diagnostic" apparaît dans le disclaimer (en tant que négation —
    // "aucun diagnostic") : c'est attendu et explicitement autorisé. On
    // vérifie l'absence de formes actives qui constitueraient une violation.
    expect(lower).not.toContain('appelez votre médecin');
    expect(lower).not.toContain('call your doctor');
    expect(lower).not.toContain('recommandation de dose d');
    expect(lower).not.toContain('dose recommandée');
    expect(lower).not.toContain('diagnostic suggéré');
    expect(lower).not.toContain('we recommend');
    expect(lower).not.toContain('nous recommandons');
  });

  it("rend le résumé observance avec des chiffres bruts (pas d'interprétation)", () => {
    const html = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).toContain('55');
    expect(html).toContain('60');
    // Pas de labels qualitatifs du type "contrôle correct" / "mauvais"
    expect(html.toLowerCase()).not.toContain('mauvais');
    expect(html.toLowerCase()).not.toContain('bon contrôle');
  });

  it('émet un HTML déterministe (même input → même output, clé pour le hash)', () => {
    const h1 = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    const h2 = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(h1).toBe(h2);
  });

  it('échappe les caractères HTML dangereux (XSS si un prénom contient &, <, ")', () => {
    const data = { ...minimalData(), childAlias: 'Léa & <script>alert(1)</script>' };
    const html = renderMedicalReportHtml({
      data,
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('traduit les codes symptômes via le dictionnaire fourni', () => {
    const html = renderMedicalReportHtml({
      data: minimalData(),
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).toContain('Toux');
    expect(html).toContain('Air froid');
  });

  it('supporte une plage sans doses (template ne plante pas)', () => {
    const data: ReportData = {
      ...minimalData(),
      doses: [],
      rescueCountByWeek: [],
      symptomTimeline: [],
      adherence: { scheduled: 0, confirmed: 0, ratio: 0 },
    };
    const html = renderMedicalReportHtml({
      data,
      strings: FR_STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(html).toContain('Aucun');
  });
});
