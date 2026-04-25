/**
 * Types partagés du module privacy-export (KIN-085, ADR-D14).
 *
 * Ces interfaces décrivent :
 * - le format JSON déterministe produit par `serializeDocForExport`,
 * - le payload attendu en provenance du backend (`/me/privacy/export/metadata`),
 * - le résultat retourné par `buildPrivacyArchive`.
 *
 * Toutes les structures sont **plates et sérialisables JSON** sans
 * conversion supplémentaire — un consommateur tiers (médecin, RPRP, autre
 * appli compatible RGPD) peut les lire directement.
 */

import type { ProjectedCaregiver } from '@kinhale/sync';

/**
 * Sous-ensemble de la projection `ProjectedDose` exposé dans l'archive.
 *
 * On exclut volontairement `signerPublicKeyHex`, `signatureHex` et
 * `eventId` (sous-jacents à `SignedEventRecord`) qui sont des détails
 * d'implémentation Automerge non utiles à un consommateur RGPD.
 *
 * `freeFormTag` est conservé : contrairement au rapport médecin (RM8) qui
 * filtre les notes libres, l'export de portabilité doit inclure **toutes**
 * les données saisies par l'utilisateur (art. 20 RGPD : « les données la
 * concernant »).
 */
export interface SerializedDose {
  readonly doseId: string;
  readonly pumpId: string;
  readonly childId: string;
  readonly caregiverId: string;
  readonly administeredAtMs: number;
  readonly doseType: 'maintenance' | 'rescue';
  readonly dosesAdministered: number;
  readonly symptoms: ReadonlyArray<string>;
  readonly circumstances: ReadonlyArray<string>;
  readonly freeFormTag: string | null;
  readonly status: 'recorded' | 'pending_review';
  readonly recordedByDeviceId: string;
  readonly recordedAtMs: number;
}

/**
 * Pompe sérialisée pour l'export. Contient toutes les propriétés calculables
 * depuis le doc Automerge ; `dosesRemaining` est une projection dérivée des
 * `DoseAdministered` (voir `projectPumps`).
 */
export interface SerializedPump {
  readonly pumpId: string;
  readonly name: string;
  readonly pumpType: 'maintenance' | 'rescue';
  readonly totalDoses: number;
  readonly dosesRemaining: number;
  readonly expiresAtMs: number | null;
  readonly registeredAtMs: number;
}

export interface SerializedPlan {
  readonly planId: string;
  readonly pumpId: string;
  readonly scheduledHoursUtc: ReadonlyArray<number>;
  readonly startAtMs: number;
  readonly endAtMs: number | null;
  readonly recordedAtMs: number;
}

export interface SerializedChild {
  readonly childId: string;
  readonly firstName: string;
  readonly birthYear: number;
  readonly recordedByDeviceId: string;
  readonly recordedAtMs: number;
}

/**
 * Aidant sérialisé : sous-ensemble de `ProjectedCaregiver`. Tous les champs
 * sont déjà non sensibles en dehors de `displayName` qui est nécessaire à
 * la portabilité (l'utilisateur a saisi ce nom, donc il a le droit de le
 * récupérer).
 */
export type SerializedCaregiver = Pick<
  ProjectedCaregiver,
  'caregiverId' | 'role' | 'displayName' | 'status' | 'invitedAtMs' | 'acceptedAtMs'
>;

/**
 * Document Kinhale sérialisé pour l'export RGPD/Loi 25.
 *
 * Toutes les listes sont **triées de façon déterministe** (par identifiant
 * stable ou timestamp) afin que `serializeDocForExport(doc) === serializeDocForExport(doc)`
 * produise toujours le même JSON — propriété indispensable pour reproduire
 * le hash SHA-256 du fichier `health-data.json`.
 *
 * `householdId` est conservé en clair : c'est un UUID opaque, déjà connu
 * du relais (au sens qu'il est l'index principal de la mailbox), et il
 * permet à l'utilisateur d'auditer l'archive.
 *
 * `exportedAtMs` est l'horodatage de génération côté client. Un export
 * regénéré 1 ms plus tard produira un autre hash — c'est attendu.
 */
export interface SerializedDoc {
  readonly householdId: string;
  readonly exportedAtMs: number;
  readonly schemaVersion: 1;
  readonly child: SerializedChild | null;
  readonly caregivers: ReadonlyArray<SerializedCaregiver>;
  readonly pumps: ReadonlyArray<SerializedPump>;
  readonly plans: ReadonlyArray<SerializedPlan>;
  readonly doses: ReadonlyArray<SerializedDose>;
}

/**
 * Résumé d'un device enregistré côté relais. **Aucune donnée santé.**
 *
 * `lastSeenMs` est null si le relais ne suit pas la dernière activité —
 * ce qui est le cas en v1.0 (l'info n'est pas tracée pour minimisation,
 * mais le champ est prévu pour une évolution v1.1).
 */
export interface RelayDeviceInfo {
  readonly deviceId: string;
  readonly registeredAtMs: number;
  readonly lastSeenMs: number | null;
}

/**
 * Résumé d'un audit event concernant l'utilisateur. `eventData` est
 * volontairement typé `unknown` côté contrat — c'est un JSONB opaque côté
 * relais qui peut évoluer au fil des features (`report_generated`,
 * `report_shared`, `privacy_export`, futur `account_deletion_requested`).
 *
 * Le format précis est documenté dans `audit_events` (schema.ts).
 */
export interface RelayAuditEventInfo {
  readonly eventType: string;
  readonly eventData: unknown;
  readonly createdAtMs: number;
}

/**
 * Préférences de notifications connues du relais. Les types absents de la
 * liste sont implicitement `enabled: true` (cf. SPECS §9 — sanctuarisation
 * des `missed_dose` et `security_alert`).
 */
export interface RelayNotificationPreferenceInfo {
  readonly notificationType: string;
  readonly enabled: boolean;
  readonly updatedAtMs: number;
}

export interface RelayQuietHoursInfo {
  readonly enabled: boolean;
  readonly startLocalTime: string;
  readonly endLocalTime: string;
  readonly timezone: string;
  readonly updatedAtMs: number;
}

/**
 * Métadonnées relais retournées par `GET /me/privacy/export/metadata`.
 *
 * Toutes les propriétés sont **scope-isolées** par `accountId` (le `sub` du
 * JWT) côté API. **Aucune** donnée d'autres utilisateurs n'est jamais incluse
 * — c'est testé en kz-securite.
 */
export interface RelayExportMetadata {
  /** UUID du compte (pseudonyme — l'email n'est jamais exposé en clair). */
  readonly accountId: string;
  /** Horodatage de réponse serveur (ms UTC). */
  readonly exportedAtMs: number;
  /** Devices enregistrés du compte. */
  readonly devices: ReadonlyArray<RelayDeviceInfo>;
  /** Audit events concernant le compte (report_generated, report_shared, …). */
  readonly auditEvents: ReadonlyArray<RelayAuditEventInfo>;
  /** Préférences de notifications matérialisées (les défauts implicites sont absents). */
  readonly notificationPreferences: ReadonlyArray<RelayNotificationPreferenceInfo>;
  /** Quiet hours ou null si jamais configurées. */
  readonly quietHours: RelayQuietHoursInfo | null;
  /** Nombre de push tokens enregistrés (pas le contenu — RM16 minimisation). */
  readonly pushTokensCount: number;
}

/**
 * Arguments du builder d'archive — assemble doc local + métadonnées relais
 * + traduction du README.
 */
export interface BuildPrivacyArchiveArgs {
  readonly serializedDoc: SerializedDoc;
  readonly relayMetadata: RelayExportMetadata;
  readonly reportHtml: string;
  readonly reportCsv: string;
  readonly generatedAtMs: number;
  readonly appVersion: string;
}

/**
 * Résultat de `buildPrivacyArchive`. Le hash de l'archive complète est
 * recalculable côté serveur via `sha256Hex(zipBytes)` — c'est cette valeur
 * qui est postée à `POST /audit/privacy-export`.
 */
export interface BuildPrivacyArchiveResult {
  /** Bytes du ZIP — STORE mode (pas de compression, données déjà compactes). */
  readonly zipBytes: Uint8Array;
  /** Hash SHA-256 hex (64 chars) du ZIP entier. */
  readonly archiveHash: string;
  /** Hashes individuels de chaque fichier de l'archive (clé = nom de fichier). */
  readonly fileHashes: Readonly<Record<string, string>>;
}
