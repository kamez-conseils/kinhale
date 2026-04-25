/**
 * Builder principal de l'archive de portabilité (KIN-085, ADR-D14).
 *
 * Orchestre le pipeline :
 * 1. Sérialise le doc Automerge local en JSON canonique.
 * 2. Sérialise les métadonnées relais en JSON canonique.
 * 3. Hashe individuellement chaque fichier (intégrité reproductible).
 * 4. Construit le `README.txt` bilingue avec le tableau de hashes.
 * 5. Hashe le README (le tableau du README ne contient pas son propre hash —
 *    on le calcule en dernier pour éviter le cycle).
 * 6. Empaquette tout dans un ZIP **STORE** (pas de compression, données
 *    déjà compactes ; évite tout risque CVE lié à un zlib/inflate buggé).
 * 7. Calcule le hash global de l'archive (utilisé pour l'audit trail relais).
 *
 * **Pure** : pas d'I/O, pas de réseau, pas de `Date.now()` caché. Toutes
 * les sources de variabilité (timestamp, version) sont passées en arguments.
 *
 * Refs: ADR-D14, KIN-085, RM24, RM27.
 */

import { sha256Hex, sha256HexFromString } from '@kinhale/crypto';
import { zipSync, type Zippable } from 'fflate';
import { buildPrivacyReadme } from './build-readme.js';
import { canonicalJsonStringify } from './serialize-doc.js';
import type { BuildPrivacyArchiveArgs, BuildPrivacyArchiveResult } from './types.js';

/** Nom des fichiers de l'archive — exposé pour les tests et clients. */
export const PRIVACY_ARCHIVE_FILENAMES = {
  healthDataJson: 'health-data.json',
  healthDataCsv: 'health-data.csv',
  healthReportHtml: 'health-report.html',
  relayMetadataJson: 'relay-metadata.json',
  readme: 'README.txt',
} as const;

/**
 * Construit l'archive de portabilité prête à télécharger / partager.
 *
 * @param args - Doc local sérialisé, métadonnées relais, HTML/CSV, version.
 * @returns ZIP bytes + hashes (archive globale + par fichier).
 */
export async function buildPrivacyArchive(
  args: BuildPrivacyArchiveArgs,
): Promise<BuildPrivacyArchiveResult> {
  const healthDataJson = canonicalJsonStringify(args.serializedDoc);
  const relayMetadataJson = canonicalJsonStringify(args.relayMetadata);

  // Hashes individuels — calculés AVANT le README pour qu'il les liste tous.
  const fileHashesWithoutReadme: Record<string, string> = {
    [PRIVACY_ARCHIVE_FILENAMES.healthDataJson]: await sha256HexFromString(healthDataJson),
    [PRIVACY_ARCHIVE_FILENAMES.healthDataCsv]: await sha256HexFromString(args.reportCsv),
    [PRIVACY_ARCHIVE_FILENAMES.healthReportHtml]: await sha256HexFromString(args.reportHtml),
    [PRIVACY_ARCHIVE_FILENAMES.relayMetadataJson]: await sha256HexFromString(relayMetadataJson),
  };

  const readmeText = buildPrivacyReadme({
    accountId: args.relayMetadata.accountId,
    householdId: args.serializedDoc.householdId,
    generatedAtMs: args.generatedAtMs,
    appVersion: args.appVersion,
    fileHashes: fileHashesWithoutReadme,
  });

  // Hash du README (calculé après — il référence les autres hashes mais
  // pas le sien, donc pas de cycle).
  const readmeHash = await sha256HexFromString(readmeText);

  const fileHashes: Record<string, string> = {
    ...fileHashesWithoutReadme,
    [PRIVACY_ARCHIVE_FILENAMES.readme]: readmeHash,
  };

  const encoder = new TextEncoder();
  // Toutes les entrées sont en mode STORE (level: 0) — pas de compression.
  // Les données santé sont déjà compactes, et le mode STORE élimine toute
  // surface d'attaque liée à un déflateur buggé (CVE potentielles).
  const zipInput: Zippable = {
    [PRIVACY_ARCHIVE_FILENAMES.healthDataJson]: [encoder.encode(healthDataJson), { level: 0 }],
    [PRIVACY_ARCHIVE_FILENAMES.healthDataCsv]: [encoder.encode(args.reportCsv), { level: 0 }],
    [PRIVACY_ARCHIVE_FILENAMES.healthReportHtml]: [encoder.encode(args.reportHtml), { level: 0 }],
    [PRIVACY_ARCHIVE_FILENAMES.relayMetadataJson]: [
      encoder.encode(relayMetadataJson),
      { level: 0 },
    ],
    [PRIVACY_ARCHIVE_FILENAMES.readme]: [encoder.encode(readmeText), { level: 0 }],
  };

  const zipBytes = zipSync(zipInput);
  const archiveHash = await sha256Hex(zipBytes);

  return {
    zipBytes,
    archiveHash,
    fileHashes,
  };
}
