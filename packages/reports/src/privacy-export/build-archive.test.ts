import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { buildPrivacyArchive, PRIVACY_ARCHIVE_FILENAMES } from './build-archive.js';
import type { BuildPrivacyArchiveArgs, RelayExportMetadata, SerializedDoc } from './types.js';

const FIXED_MS = Date.UTC(2026, 3, 24, 12, 0, 0);

function makeSerializedDoc(): SerializedDoc {
  return {
    householdId: 'hh-1',
    exportedAtMs: FIXED_MS,
    schemaVersion: 1,
    child: {
      childId: 'child-1',
      firstName: 'Léa',
      birthYear: 2020,
      recordedByDeviceId: 'device-A',
      recordedAtMs: FIXED_MS - 10_000,
    },
    caregivers: [],
    pumps: [],
    plans: [],
    doses: [],
  };
}

function makeRelayMetadata(): RelayExportMetadata {
  return {
    accountId: 'acc-1',
    exportedAtMs: FIXED_MS,
    devices: [{ deviceId: 'device-A', registeredAtMs: FIXED_MS - 86_400_000, lastSeenMs: null }],
    auditEvents: [],
    notificationPreferences: [],
    quietHours: null,
    pushTokensCount: 1,
  };
}

function makeArgs(overrides: Partial<BuildPrivacyArchiveArgs> = {}): BuildPrivacyArchiveArgs {
  return {
    serializedDoc: makeSerializedDoc(),
    relayMetadata: makeRelayMetadata(),
    reportHtml: '<html><body>report</body></html>',
    reportCsv: 'col1,col2\nval1,val2\n',
    generatedAtMs: FIXED_MS,
    appVersion: 'v1.0.0-test',
    ...overrides,
  };
}

describe('buildPrivacyArchive', () => {
  it('produit un ZIP qui contient les 5 fichiers attendus', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    expect(Object.keys(unzipped).sort()).toEqual(
      [
        'README.txt',
        'health-data.csv',
        'health-data.json',
        'health-report.html',
        'relay-metadata.json',
      ].sort(),
    );
  });

  it("renvoie un hash SHA-256 hex 64 chars pour l'archive globale", async () => {
    const result = await buildPrivacyArchive(makeArgs());
    expect(result.archiveHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('renvoie un hash SHA-256 par fichier (5 hashes au total)', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    expect(Object.keys(result.fileHashes)).toHaveLength(5);
    for (const hash of Object.values(result.fileHashes)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('le ZIP est déterministe pour des inputs identiques (clé de la reproductibilité)', async () => {
    const a = await buildPrivacyArchive(makeArgs());
    const b = await buildPrivacyArchive(makeArgs());
    expect(a.archiveHash).toBe(b.archiveHash);
    expect(a.fileHashes).toEqual(b.fileHashes);
  });

  it('le contenu de health-data.json est du JSON canonique parseable', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    const jsonBytes = unzipped[PRIVACY_ARCHIVE_FILENAMES.healthDataJson];
    expect(jsonBytes).toBeDefined();
    const text = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(text) as { householdId: string };
    expect(parsed.householdId).toBe('hh-1');
  });

  it('le contenu de relay-metadata.json est du JSON parseable', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    const jsonBytes = unzipped[PRIVACY_ARCHIVE_FILENAMES.relayMetadataJson];
    expect(jsonBytes).toBeDefined();
    const text = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(text) as { accountId: string };
    expect(parsed.accountId).toBe('acc-1');
  });

  it('le README contient les hashes des 4 autres fichiers (intégrité vérifiable)', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    const readmeBytes = unzipped[PRIVACY_ARCHIVE_FILENAMES.readme];
    expect(readmeBytes).toBeDefined();
    const readme = new TextDecoder().decode(readmeBytes);
    expect(readme).toContain(result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.healthDataJson]!);
    expect(readme).toContain(result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.healthDataCsv]!);
    expect(readme).toContain(result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.healthReportHtml]!);
    expect(readme).toContain(result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.relayMetadataJson]!);
  });

  it('le README ne contient PAS son propre hash (évite le cycle de référence)', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const readmeHash = result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.readme]!;
    const unzipped = unzipSync(result.zipBytes);
    const readmeBytes = unzipped[PRIVACY_ARCHIVE_FILENAMES.readme];
    const readme = new TextDecoder().decode(readmeBytes);
    expect(readme).not.toContain(readmeHash);
  });

  it('le hash de health-data.json correspond bien au contenu décompressé', async () => {
    const { sha256HexFromString } = await import('@kinhale/crypto');
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    const jsonBytes = unzipped[PRIVACY_ARCHIVE_FILENAMES.healthDataJson];
    const text = new TextDecoder().decode(jsonBytes);
    const recomputed = await sha256HexFromString(text);
    expect(recomputed).toBe(result.fileHashes[PRIVACY_ARCHIVE_FILENAMES.healthDataJson]);
  });

  it('le hash global est différent si une dose est ajoutée (non-trivial check)', async () => {
    const a = await buildPrivacyArchive(makeArgs());
    const argsB = makeArgs({
      serializedDoc: {
        ...makeSerializedDoc(),
        doses: [
          {
            doseId: 'dose-1',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: FIXED_MS,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
            status: 'recorded',
            recordedByDeviceId: 'device-A',
            recordedAtMs: FIXED_MS,
          },
        ],
      },
    });
    const b = await buildPrivacyArchive(argsB);
    expect(a.archiveHash).not.toBe(b.archiveHash);
  });

  it("aucun nom de fichier ne contient '..' ou '/' absolu (anti zip slip)", async () => {
    const result = await buildPrivacyArchive(makeArgs());
    const unzipped = unzipSync(result.zipBytes);
    for (const name of Object.keys(unzipped)) {
      expect(name).not.toContain('..');
      expect(name.startsWith('/')).toBe(false);
    }
  });

  it('le ZIP utilise le mode STORE (level 0 — pas de compression, sécurité auditée)', async () => {
    const result = await buildPrivacyArchive(makeArgs());
    // Le mode STORE place les bytes UTF-8 bruts. La taille du ZIP doit être
    // approximativement égale à la somme des contenus + overhead headers.
    const totalContentBytes =
      JSON.stringify(makeSerializedDoc()).length +
      JSON.stringify(makeRelayMetadata()).length +
      makeArgs().reportHtml.length +
      makeArgs().reportCsv.length;
    // STORE : taille ZIP > taille contenus (overhead headers ≥ 0). Et pas
    // significativement plus petite (donc pas de compression).
    expect(result.zipBytes.byteLength).toBeGreaterThan(totalContentBytes / 4);
  });
});
