import { describe, expect, it } from 'vitest';
import { buildPrivacyReadme } from './build-readme.js';

const FIXED_MS = Date.UTC(2026, 3, 24, 12, 0, 0);

describe('buildPrivacyReadme', () => {
  it('inclut une section FR ET une section EN (i18n bilingue obligatoire)', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: { 'health-data.json': 'a'.repeat(64) },
    });

    expect(out).toContain('Archive de portabilité');
    expect(out).toContain('Data portability archive');
    expect(out).toContain('RGPD art. 20');
    expect(out).toContain('GDPR art. 20');
  });

  it('inclut le disclaimer non-DM (RM27) en FR et EN', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });

    expect(out).toContain('ne remplace pas');
    expect(out).toContain('aucune interprétation');
    expect(out).toContain('does not replace');
    expect(out).toContain('no medical interpretation');
  });

  it("affiche le tableau d'intégrité avec les hashes triés alphabétiquement", () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {
        'zfile.txt': 'z'.repeat(64),
        'afile.txt': 'a'.repeat(64),
        'mfile.txt': 'm'.repeat(64),
      },
    });

    const aIdx = out.indexOf('afile.txt');
    const mIdx = out.indexOf('mfile.txt');
    const zIdx = out.indexOf('zfile.txt');
    expect(aIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it('inclut accountId et householdId en clair (transparence vers le sujet)', () => {
    const out = buildPrivacyReadme({
      accountId: 'pseudo-12345',
      householdId: 'hh-67890',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });
    expect(out).toContain('pseudo-12345');
    expect(out).toContain('hh-67890');
  });

  it('inclut la version Kinhale dans les deux sections', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0-rc1',
      fileHashes: {},
    });
    // Compte les occurrences — au moins 2 (FR + EN).
    const matches = out.match(/v1\.0\.0-rc1/g);
    expect(matches).not.toBeNull();
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('affiche un message dédié si aucun fichier (cas dégénéré)', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });
    expect(out).toContain('aucun fichier');
    expect(out).toContain('no file');
  });

  it('affiche une URL de contact security@kinhale.health', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });
    expect(out).toContain('security@kinhale.health');
  });

  it('mentionne explicitement la promesse zero-knowledge en FR et EN', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });
    expect(out).toContain("n'a JAMAIS accès");
    expect(out).toContain('NEVER accesses');
  });

  it('est déterministe — mêmes inputs → mêmes outputs', () => {
    const args = {
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: { 'a.txt': 'x'.repeat(64), 'b.txt': 'y'.repeat(64) },
    };
    expect(buildPrivacyReadme(args)).toBe(buildPrivacyReadme(args));
  });

  it('ne contient aucun mot interprétatif médical (anti-DM)', () => {
    const out = buildPrivacyReadme({
      accountId: 'acc-1',
      householdId: 'hh-1',
      generatedAtMs: FIXED_MS,
      appVersion: 'v1.0.0',
      fileHashes: {},
    });
    // Liste blanche : ces mots ne doivent JAMAIS apparaître dans un README produit
    // (ils signaleraient une dérive vers du DM).
    const forbiddenFr = ['augmenter dose', 'consulter médecin urgent', 'sévère', 'critique'];
    const forbiddenEn = ['increase dose', 'urgently see your doctor', 'severe', 'critical'];
    for (const w of forbiddenFr) expect(out.toLowerCase()).not.toContain(w);
    for (const w of forbiddenEn) expect(out.toLowerCase()).not.toContain(w);
  });
});
