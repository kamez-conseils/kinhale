import { describe, expect, it } from 'vitest';
import type { KinhaleDoc } from '@kinhale/sync';
import { generateMedicalReport, InvalidReportRangeError } from './generate.js';
import { MS_PER_DAY } from './range/date-range.js';

const BASE = Date.UTC(2026, 3, 24, 12, 0, 0);

const STRINGS = {
  title: 'Rapport',
  header: {
    child: 'Enfant',
    range: 'Plage',
    generator: 'Générateur',
    generatedAt: 'Généré le',
    birthYear: 'Né en',
  },
  sections: {
    adherence: 'Observance',
    rescueFrequency: 'Secours',
    symptomTimeline: 'Symptômes',
  },
  labels: {
    scheduled: 'Prévues',
    confirmed: 'Enregistrées',
    ratio: 'Ratio',
    pending: 'Revue',
    week: 'Semaine',
    none: 'Aucun',
  },
  symptom: { cough: 'Toux' },
  circumstance: { night: 'Nuit' },
  disclaimer:
    'Ce document est un journal fourni par les aidants. Il ne contient aucune interprétation médicale, aucune recommandation de dose, aucun diagnostic.',
  integrity: {
    label: 'Intégrité',
    hashLabel: 'Hash',
    generatorLabel: 'Gen',
    timestampLabel: 'Ts',
  },
};

function emptyDoc(): KinhaleDoc {
  return { householdId: 'hh-1', events: [] };
}

describe('generateMedicalReport', () => {
  it('rejette une plage inversée', async () => {
    await expect(
      generateMedicalReport({
        doc: emptyDoc(),
        range: { startMs: BASE, endMs: BASE - MS_PER_DAY },
        strings: STRINGS,
        generator: 'Kinhale v1.0.0-preview',
        generatedAtMs: BASE,
        locale: 'fr',
      }),
    ).rejects.toBeInstanceOf(InvalidReportRangeError);
  });

  it('produit un HTML final contenant le hash intégrité calculé en 2 passes', async () => {
    const result = await generateMedicalReport({
      doc: emptyDoc(),
      range: { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE },
      strings: STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.html).toContain(result.contentHash);
  });

  it('est déterministe : mêmes inputs → même html + même hash', async () => {
    const args = {
      doc: emptyDoc(),
      range: { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE },
      strings: STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr' as const,
    };
    const a = await generateMedicalReport(args);
    const b = await generateMedicalReport(args);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.html).toBe(b.html);
  });

  it('produit un HTML < 200 kB pour une plage vide (sanity perf)', async () => {
    const result = await generateMedicalReport({
      doc: emptyDoc(),
      range: { startMs: BASE - 90 * MS_PER_DAY, endMs: BASE },
      strings: STRINGS,
      generator: 'Kinhale v1.0.0-preview',
      generatedAtMs: BASE,
      locale: 'fr',
    });
    expect(result.html.length).toBeLessThan(200_000);
  });
});
