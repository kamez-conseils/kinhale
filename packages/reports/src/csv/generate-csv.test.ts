import { describe, it, expect } from 'vitest';
import {
  CSV_COLUMNS,
  CSV_FIELD_SEP,
  CSV_LINE_SEP,
  CSV_UTF8_BOM,
  buildCsvDoses,
  escapeCsvValue,
  generateMedicalCsv,
  type CsvReportDose,
} from './generate-csv.js';
import type { ReportData } from '../data/aggregate.js';

const BASE_MS = Date.UTC(2026, 3, 1, 8, 30, 0);

function makeDose(overrides: Partial<CsvReportDose> = {}): CsvReportDose {
  return {
    administeredAtMs: BASE_MS,
    doseType: 'rescue',
    symptoms: ['cough'],
    circumstances: ['night'],
    status: 'recorded',
    pumpId: 'pump-aaa',
    caregiverId: 'care-bbb',
    dosesAdministered: 1,
    ...overrides,
  };
}

describe('escapeCsvValue', () => {
  it('ne quote pas une valeur simple (pas de caractère spécial)', () => {
    expect(escapeCsvValue('rescue')).toBe('rescue');
  });

  it('quote une valeur contenant une virgule', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
  });

  it('quote une valeur contenant un guillemet en le doublant', () => {
    expect(escapeCsvValue('a"b')).toBe('"a""b"');
  });

  it('quote une valeur contenant un retour chariot', () => {
    expect(escapeCsvValue('a\rb')).toBe('"a\rb"');
  });

  it('quote une valeur contenant un saut de ligne', () => {
    expect(escapeCsvValue('a\nb')).toBe('"a\nb"');
  });

  it('double les guillemets dans une valeur déjà quotée', () => {
    expect(escapeCsvValue('"hello"')).toBe('"""hello"""');
  });

  it('gère les valeurs vides', () => {
    expect(escapeCsvValue('')).toBe('');
  });

  it('préserve les caractères UTF-8 accentués', () => {
    expect(escapeCsvValue('éèàüñ')).toBe('éèàüñ');
  });

  it("préserve les emojis (pour l'encodage UTF-8)", () => {
    expect(escapeCsvValue('😀🚀')).toBe('😀🚀');
  });
});

describe('generateMedicalCsv — structure', () => {
  it('produit un BOM UTF-8 en tête', () => {
    const csv = generateMedicalCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produit uniquement la ligne de header + newline final quand la liste est vide', () => {
    const csv = generateMedicalCsv([]);
    const expected = `${CSV_UTF8_BOM}${CSV_COLUMNS.join(CSV_FIELD_SEP)}${CSV_LINE_SEP}`;
    expect(csv).toBe(expected);
  });

  it("respecte exactement l'ordre des colonnes documenté", () => {
    const csv = generateMedicalCsv([]);
    // Retire le BOM pour comparer proprement
    const headerLine = csv.slice(CSV_UTF8_BOM.length).split(CSV_LINE_SEP)[0];
    expect(headerLine).toBe(
      [
        'datetime_local',
        'datetime_utc',
        'type',
        'pump_id',
        'dose_count',
        'symptoms',
        'circumstances',
        'caregiver_id',
        'status',
      ].join(','),
    );
  });

  it('sépare les lignes en CRLF', () => {
    const csv = generateMedicalCsv([makeDose()]);
    // 3 occurrences attendues : header→row1, row1→trailing
    const crlfCount = csv.split(CSV_LINE_SEP).length - 1;
    expect(crlfCount).toBe(2);
  });

  it('se termine par un CRLF final (canonique RFC 4180)', () => {
    const csv = generateMedicalCsv([makeDose()]);
    expect(csv.endsWith(CSV_LINE_SEP)).toBe(true);
  });
});

describe('generateMedicalCsv — contenu', () => {
  it('sérialise une prise rescue avec symptôme et circonstance', () => {
    const csv = generateMedicalCsv([
      makeDose({
        administeredAtMs: Date.UTC(2026, 3, 24, 14, 15, 0),
        doseType: 'rescue',
        symptoms: ['cough', 'wheezing'],
        circumstances: ['exercise'],
        dosesAdministered: 2,
      }),
    ]);
    // Body après header + CRLF
    const body = csv.slice(CSV_UTF8_BOM.length).split(CSV_LINE_SEP)[1] ?? '';
    expect(body).toContain('2026-04-24T14:15:00.000Z');
    expect(body).toContain(',rescue,');
    expect(body).toContain('pump-aaa');
    expect(body).toContain('cough|wheezing');
    expect(body).toContain('exercise');
    expect(body).toContain('care-bbb');
    expect(body).toContain('recorded');
    expect(body).toMatch(/,2,/); // dose_count littéral
  });

  it('sérialise une prise maintenance (pas de symptôme ni circonstance)', () => {
    const csv = generateMedicalCsv([
      makeDose({
        doseType: 'maintenance',
        symptoms: [],
        circumstances: [],
      }),
    ]);
    const body = csv.slice(CSV_UTF8_BOM.length).split(CSV_LINE_SEP)[1] ?? '';
    expect(body).toContain(',maintenance,');
    // Champs symptoms et circumstances doivent être vides (rien entre les virgules)
    expect(body).toMatch(/,,/); // deux champs vides contigus
  });

  it('propage un statut `pending_review`', () => {
    const csv = generateMedicalCsv([makeDose({ status: 'pending_review' })]);
    expect(csv).toContain('pending_review');
  });

  it('propage un statut `voided` (couvert dès livraison E4-S07)', () => {
    const csv = generateMedicalCsv([makeDose({ status: 'voided' })]);
    expect(csv).toContain('voided');
  });

  it('quote correctement une valeur qui contient une virgule (cas fictif)', () => {
    // Contrat : si un code symptôme futur contient une virgule, le CSV doit
    // rester alignable. Le pipeline actuel n'introduit pas de virgule dans
    // les codes mais le test verrouille le comportement.
    const csv = generateMedicalCsv([makeDose({ symptoms: ['cough, wet'] })]);
    expect(csv).toContain('"cough, wet"');
  });

  it('quote correctement une valeur qui contient un guillemet', () => {
    const csv = generateMedicalCsv([makeDose({ symptoms: ['wh"eezing'] })]);
    expect(csv).toContain('"wh""eezing"');
  });

  it('quote correctement une valeur multi-lignes (defense anti-newline)', () => {
    const csv = generateMedicalCsv([makeDose({ circumstances: ['line1\nline2'] })]);
    // Le champ circumstances doit être entouré de guillemets
    expect(csv).toContain('"line1\nline2"');
  });

  it('préserve les caractères UTF-8 accentués et emojis', () => {
    const csv = generateMedicalCsv([
      makeDose({ symptoms: ['toux-sévère', '🤒'], pumpId: 'pompé-principale' }),
    ]);
    expect(csv).toContain('toux-sévère');
    expect(csv).toContain('🤒');
    expect(csv).toContain('pompé-principale');
  });

  it('émet plusieurs lignes quand plusieurs doses sont passées', () => {
    const csv = generateMedicalCsv([
      makeDose({ administeredAtMs: BASE_MS + 1000 }),
      makeDose({ administeredAtMs: BASE_MS + 2000 }),
      makeDose({ administeredAtMs: BASE_MS + 3000 }),
    ]);
    const lines = csv
      .slice(CSV_UTF8_BOM.length)
      .split(CSV_LINE_SEP)
      .filter((l) => l.length > 0);
    // 1 header + 3 rows = 4 lignes non vides
    expect(lines).toHaveLength(4);
  });
});

describe('generateMedicalCsv — déterminisme', () => {
  it('produit exactement le même CSV pour les mêmes inputs', () => {
    const doses = [
      makeDose({ administeredAtMs: BASE_MS + 1000, symptoms: ['cough'] }),
      makeDose({ administeredAtMs: BASE_MS + 2000, doseType: 'maintenance' }),
    ];
    const a = generateMedicalCsv(doses);
    const b = generateMedicalCsv(doses);
    expect(a).toBe(b);
  });

  it('reste indépendant du fuseau local du moteur JS (toISOString est UTC)', () => {
    // Ce test ne peut pas changer le fuseau système, mais il vérifie
    // que la valeur de datetime_local est bien un ISO Z (UTC).
    const csv = generateMedicalCsv([
      makeDose({ administeredAtMs: Date.UTC(2026, 3, 24, 14, 15, 0) }),
    ]);
    const body = csv.slice(CSV_UTF8_BOM.length).split(CSV_LINE_SEP)[1] ?? '';
    // datetime_local doit contenir un suffixe Z (UTC) garantissant la reprod.
    const firstField = body.split(',')[0] ?? '';
    expect(firstField.endsWith('Z')).toBe(true);
  });
});

describe('generateMedicalCsv — RM8 keyword filter (non-interprétatif)', () => {
  /**
   * Pattern RM8 : le rapport médecin ne doit contenir aucun mot interprétatif
   * (diagnostic, recommandation, niveau de gravité). Le CSV est soumis au
   * même test que le HTML.
   *
   * La liste est alignée avec celle du template HTML (medical-report-html.test.ts).
   */
  const forbiddenKeywords = [
    // FR
    'contrôlé',
    'non contrôlé',
    'sévère',
    'modéré',
    'léger',
    'crise',
    'augmenter',
    'diminuer',
    'appelez',
    'urgence',
    'recommandation',
    // EN
    'controlled',
    'uncontrolled',
    'severe',
    'moderate',
    'mild',
    'emergency',
    'increase',
    'decrease',
    'call your',
    'recommend',
  ];

  it('ne contient aucun mot interprétatif dans le CSV final', () => {
    const csv = generateMedicalCsv([
      makeDose({ symptoms: ['cough', 'wheezing'], circumstances: ['exercise'] }),
      makeDose({ symptoms: ['shortness_of_breath'], circumstances: ['cold_air'] }),
    ]);
    const lower = csv.toLowerCase();
    for (const keyword of forbiddenKeywords) {
      expect(lower, `Keyword interprétatif interdit: ${keyword}`).not.toContain(
        keyword.toLowerCase(),
      );
    }
  });
});

describe('buildCsvDoses', () => {
  /**
   * `buildCsvDoses` transforme la partie ReportData (minimale, RM8-safe) en
   * lignes CsvReportDose en ajoutant les identifiants opaques (pumpId,
   * caregiverId) via un lookup fourni par l'appelant.
   */

  function makeReportData(): ReportData {
    return {
      childAlias: 'Léa',
      childBirthYear: 2020,
      range: { startMs: BASE_MS - 30 * 86_400_000, endMs: BASE_MS },
      doses: [
        {
          doseId: 'dose-1',
          administeredAtMs: BASE_MS - 1000,
          doseType: 'rescue',
          symptoms: ['cough'],
          circumstances: [],
          status: 'recorded',
        },
        {
          doseId: 'dose-2',
          administeredAtMs: BASE_MS - 2000,
          doseType: 'maintenance',
          symptoms: [],
          circumstances: [],
          status: 'recorded',
        },
      ],
      rescueCountByWeek: [],
      symptomTimeline: [],
      adherence: { scheduled: 0, confirmed: 0, ratio: 0 },
    };
  }

  it('mappe chaque dose via le lookup', () => {
    const data = makeReportData();
    const rows = buildCsvDoses(data, (doseId) => ({
      pumpId: `pump-${doseId}`,
      caregiverId: `care-${doseId}`,
      dosesAdministered: 1,
    }));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.pumpId).toBe('pump-dose-1');
    expect(rows[1]?.caregiverId).toBe('care-dose-2');
  });

  it('ignore silencieusement une dose dont le lookup renvoie null (dose orpheline)', () => {
    const data = makeReportData();
    const rows = buildCsvDoses(data, (doseId) => {
      if (doseId === 'dose-2') return null;
      return { pumpId: 'pump-x', caregiverId: 'care-x', dosesAdministered: 1 };
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.administeredAtMs).toBe(BASE_MS - 1000);
  });

  it("préserve l'ordre des doses fourni par ReportData (désc. par administeredAtMs)", () => {
    const data = makeReportData();
    const rows = buildCsvDoses(data, () => ({
      pumpId: 'p',
      caregiverId: 'c',
      dosesAdministered: 1,
    }));
    expect(rows[0]?.administeredAtMs).toBeGreaterThan(rows[1]?.administeredAtMs ?? 0);
  });
});

describe('generateMedicalCsv — zero-knowledge (structure minimaliste)', () => {
  it("n'expose pas le `freeFormTag` (minimisation)", () => {
    // Un CsvReportDose ne peut structurellement pas porter de freeFormTag
    // (test statique implicite). On vérifie ici qu'une serialisation
    // n'émet aucun champ supplémentaire.
    const csv = generateMedicalCsv([makeDose()]);
    const headerLine = csv.slice(CSV_UTF8_BOM.length).split(CSV_LINE_SEP)[0] ?? '';
    const columnCount = headerLine.split(CSV_FIELD_SEP).length;
    expect(columnCount).toBe(CSV_COLUMNS.length);
    // Pas de colonne pump_name, child_alias, caregiver_display_name, freeFormTag
    expect(headerLine).not.toContain('free_form');
    expect(headerLine).not.toContain('pump_name');
    expect(headerLine).not.toContain('display_name');
    expect(headerLine).not.toContain('first_name');
  });
});
