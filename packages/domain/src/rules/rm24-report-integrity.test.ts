import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  computeReportIntegrityFooter,
  type ReportContentBlock,
  REPORT_INTEGRITY_FOOTER_VERSION,
  verifyReportIntegrityFooter,
} from './rm24-report-integrity';

const GENERATED_AT = new Date('2026-04-19T12:00:00Z');
const GENERATOR = 'kinhale-api/0.1.0';

function sampleBlocks(): readonly ReportContentBlock[] {
  return [
    { kind: 'metadata', text: 'Rapport foyer Famille de X — avril 2026' },
    { kind: 'dose', text: '2026-04-18 08:00 UTC — Fond 1 dose (Parent A)' },
    { kind: 'dose', text: '2026-04-18 14:30 UTC — Secours 1 dose + toux (Parent B)' },
    { kind: 'plan', text: 'Plan de fond : 2 doses/j matin et soir' },
    { kind: 'caregiver', text: 'Parent A (Admin), Parent B (Contributeur)' },
    { kind: 'disclaimer', text: 'Kinhale ne remplace pas un avis médical.' },
  ];
}

describe('RM24 — computeReportIntegrityFooter (chemin nominal)', () => {
  it('produit un footer avec hash 64 car hex, timestamp ISO et générateur', async () => {
    const footer = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(footer.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(footer.generatedAtUtc).toBe('2026-04-19T12:00:00.000Z');
    expect(footer.generator).toBe(GENERATOR);
    expect(footer.version).toBe(REPORT_INTEGRITY_FOOTER_VERSION);
  });

  it('est déterministe — même contenu + mêmes métadonnées = même hash', async () => {
    const a = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });
    const b = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(a.contentHash).toBe(b.contentHash);
  });

  it('contenu vide → hash du string vide canonique (cas dégénéré verrouillé)', async () => {
    const footer = await computeReportIntegrityFooter({
      content: [],
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });
    // Le hash d'un contenu vide est déterministe et testable.
    expect(footer.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RM24 — sensibilité aux modifications (anti-falsification)', () => {
  it("change d'un seul caractère dans un bloc → hash différent", async () => {
    const base = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const tampered = [...sampleBlocks()];
    tampered[1] = { kind: 'dose', text: '2026-04-18 08:01 UTC — Fond 1 dose (Parent A)' };

    const after = await computeReportIntegrityFooter({
      content: tampered,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(after.contentHash).not.toBe(base.contentHash);
  });

  it("change d'ordre des blocs → hash différent (ordre signifiant)", async () => {
    const base = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const reordered: ReportContentBlock[] = [...sampleBlocks()];
    // Swap des deux premières doses — ordre différent, contenu équivalent.
    const idx1 = 1;
    const idx2 = 2;
    const tmp = reordered[idx1] as ReportContentBlock;
    reordered[idx1] = reordered[idx2] as ReportContentBlock;
    reordered[idx2] = tmp;

    const after = await computeReportIntegrityFooter({
      content: reordered,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(after.contentHash).not.toBe(base.contentHash);
  });

  it('change de kind sans changer le text → hash différent (le kind est inclus)', async () => {
    const original: ReportContentBlock[] = [{ kind: 'dose', text: 'Hello' }];
    const swapped: ReportContentBlock[] = [{ kind: 'plan', text: 'Hello' }];

    const a = await computeReportIntegrityFooter({
      content: original,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });
    const b = await computeReportIntegrityFooter({
      content: swapped,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('encodage collision-safe : un bloc contenant le séparateur brut ne falsifie pas le hash', async () => {
    // Attaque classique d'un séparateur non préfixé par longueur :
    // [A][sep][B]  vs  [A\nsep\nB]  → même concat si séparateur \nsep\n.
    // Notre encodage préfixe chaque bloc par [kind:length], rendant la
    // collision impossible.
    const blocksA: ReportContentBlock[] = [
      { kind: 'dose', text: 'alpha' },
      { kind: 'dose', text: 'beta' },
    ];
    const blocksB: ReportContentBlock[] = [
      {
        kind: 'dose',
        text: 'alpha\n---\n[dose:4]\nbeta', // tentative de fabriquer la concat
      },
    ];

    const a = await computeReportIntegrityFooter({
      content: blocksA,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });
    const b = await computeReportIntegrityFooter({
      content: blocksB,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('changer generatedAtUtc ou generator ne change PAS contentHash (il ne couvre que le contenu)', async () => {
    const base = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const diffTime = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: new Date('2027-01-01T00:00:00Z'),
      generator: GENERATOR,
    });
    const diffGen = await computeReportIntegrityFooter({
      content: sampleBlocks(),
      generatedAtUtc: GENERATED_AT,
      generator: 'kinhale-api/0.2.0',
    });

    expect(diffTime.contentHash).toBe(base.contentHash);
    expect(diffGen.contentHash).toBe(base.contentHash);
  });
});

describe('RM24 — validation des paramètres', () => {
  it('refuse un generator vide (RM24_INVALID_GENERATOR)', async () => {
    await expect(
      computeReportIntegrityFooter({
        content: sampleBlocks(),
        generatedAtUtc: GENERATED_AT,
        generator: '',
      }),
    ).rejects.toMatchObject({
      name: 'DomainError',
      code: 'RM24_INVALID_GENERATOR',
    });
  });

  it('refuse un generator whitespace-only (RM24_INVALID_GENERATOR)', async () => {
    try {
      await computeReportIntegrityFooter({
        content: sampleBlocks(),
        generatedAtUtc: GENERATED_AT,
        generator: '   \t\n  ',
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM24_INVALID_GENERATOR');
    }
  });
});

describe('RM24 — verifyReportIntegrityFooter', () => {
  it('retourne true si le footer correspond au contenu', async () => {
    const blocks = sampleBlocks();
    const footer = await computeReportIntegrityFooter({
      content: blocks,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const ok = await verifyReportIntegrityFooter({ content: blocks, footer });
    expect(ok).toBe(true);
  });

  it('retourne false si contentHash altéré', async () => {
    const blocks = sampleBlocks();
    const footer = await computeReportIntegrityFooter({
      content: blocks,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const ok = await verifyReportIntegrityFooter({
      content: blocks,
      footer: {
        ...footer,
        // Flip du dernier caractère hex : le hash garde le bon format mais
        // ne correspond plus au contenu.
        contentHash:
          footer.contentHash.slice(0, 63) + (footer.contentHash.endsWith('0') ? '1' : '0'),
      },
    });

    expect(ok).toBe(false);
  });

  it('retourne false si ordre de blocs altéré', async () => {
    const original = sampleBlocks();
    const footer = await computeReportIntegrityFooter({
      content: original,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const reordered: ReportContentBlock[] = [...original];
    const idx1 = 1;
    const idx2 = 3;
    const tmp = reordered[idx1] as ReportContentBlock;
    reordered[idx1] = reordered[idx2] as ReportContentBlock;
    reordered[idx2] = tmp;

    const ok = await verifyReportIntegrityFooter({ content: reordered, footer });
    expect(ok).toBe(false);
  });

  it('retourne false si un bloc a été ajouté', async () => {
    const original = sampleBlocks();
    const footer = await computeReportIntegrityFooter({
      content: original,
      generatedAtUtc: GENERATED_AT,
      generator: GENERATOR,
    });

    const withExtra: ReportContentBlock[] = [...original, { kind: 'dose', text: 'Bloc injecté' }];

    const ok = await verifyReportIntegrityFooter({ content: withExtra, footer });
    expect(ok).toBe(false);
  });

  it('ne lève jamais même si le footer est bizarre', async () => {
    const blocks = sampleBlocks();

    const ok = await verifyReportIntegrityFooter({
      content: blocks,
      footer: {
        contentHash: 'not-a-valid-hash',
        generatedAtUtc: '2026-04-19T12:00:00.000Z',
        generator: 'x',
        version: '1',
      },
    });

    expect(ok).toBe(false);
  });
});
