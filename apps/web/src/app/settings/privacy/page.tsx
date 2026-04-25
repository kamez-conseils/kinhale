'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Card } from 'tamagui';
import {
  aggregateReportData,
  buildCsvDoses,
  buildPrivacyArchive,
  buildReportStrings,
  generateMedicalCsv,
  generateMedicalReport,
  serializeDocForExport,
  type RelayExportMetadata,
} from '@kinhale/reports';
import { projectDoses } from '@kinhale/sync';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useDocStore } from '../../../stores/doc-store';
import { useAuthStore } from '../../../stores/auth-store';
import { ApiError } from '../../../lib/api-client';
import {
  getPrivacyExportMetadata,
  postPrivacyExportAudit,
} from '../../../lib/privacy/export-client';

const GENERATOR_LABEL = `Kinhale ${process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | {
      kind: 'ready';
      blobUrl: string;
      filename: string;
      archiveHash: string;
      audit: 'synced' | 'pending';
    }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Paramètres → Confidentialité » — KIN-085, E9-S02, ADR-D14.
 *
 * Permet à l'utilisateur d'exercer son droit à la portabilité (RGPD art. 20,
 * Loi 25 art. 30). L'archive ZIP est entièrement générée côté client :
 * - sérialisation déterministe du doc Automerge local,
 * - rapport HTML + CSV produits via `@kinhale/reports`,
 * - métadonnées non-santé fetchées via `GET /me/privacy/export/metadata`,
 * - README.txt bilingue avec hashes SHA-256 individuels (intégrité vérifiable).
 *
 * Le relais ne voit jamais le contenu — seul un hash global est posté à
 * `POST /audit/privacy-export` pour la traçabilité conformité.
 */
export default function PrivacyExportPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const authenticated = useRequireAuth();
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);
  const [state, setState] = React.useState<UiState>({ kind: 'idle' });

  React.useEffect(() => {
    if (authenticated && householdId !== null) {
      void initDoc(householdId);
    }
  }, [authenticated, householdId, initDoc]);

  React.useEffect(
    () => (): void => {
      setState((prev) => {
        if (prev.kind === 'ready') {
          URL.revokeObjectURL(prev.blobUrl);
        }
        return prev;
      });
    },
    [],
  );

  const handleExport = async (): Promise<void> => {
    if (doc === null) {
      setState({ kind: 'error', messageKey: 'privacyExport.errors.notReady' });
      return;
    }

    setState((prev) => {
      if (prev.kind === 'ready') {
        URL.revokeObjectURL(prev.blobUrl);
      }
      return { kind: 'preparing' };
    });

    try {
      const metadata: RelayExportMetadata = await getPrivacyExportMetadata();
      const now = Date.now();

      // Plage maximum (~24 mois — limite de validateDateRange) pour produire
      // un rapport HTML / CSV exhaustif. C'est une portabilité, donc tout
      // le périmètre couvert par les rapports doit y être inclus.
      const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
      const fullRange = { startMs: now - TWO_YEARS_MS, endMs: now };

      const reportResult = await generateMedicalReport({
        doc,
        range: fullRange,
        strings: buildReportStrings((key, fallback) => t(key, fallback ?? key)),
        generator: GENERATOR_LABEL,
        generatedAtMs: now,
        locale: t('home.title') === 'Kinhale' ? 'fr' : 'en',
      });

      const reportData = aggregateReportData(doc, fullRange);
      const lookup = buildLookup(doc);
      const csvDoses = buildCsvDoses(reportData, lookup);
      const csv = generateMedicalCsv(csvDoses);

      const serializedDoc = serializeDocForExport(doc, now);

      const archive = await buildPrivacyArchive({
        serializedDoc,
        relayMetadata: metadata,
        reportHtml: reportResult.html,
        reportCsv: csv,
        generatedAtMs: now,
        appVersion: GENERATOR_LABEL,
      });

      // Rappel : `archive.zipBytes` est un Uint8Array. Le passer dans le
      // constructeur Blob nécessite de transmettre le buffer ; on évite la
      // copie en passant la vue directement (le constructeur Blob l'accepte).
      const blob = new Blob([archive.zipBytes.buffer as ArrayBuffer], {
        type: 'application/zip',
      });
      const blobUrl = URL.createObjectURL(blob);

      const iso = new Date(now).toISOString().slice(0, 10);
      const filename = `kinhale-privacy-export-${iso}.zip`;

      // Audit best-effort — l'archive est déjà disponible côté client.
      let auditStatus: 'synced' | 'pending' = 'synced';
      try {
        await postPrivacyExportAudit({
          archiveHash: archive.archiveHash,
          generatedAtMs: now,
        });
      } catch (err) {
        if (err instanceof ApiError || err instanceof TypeError) {
          auditStatus = 'pending';
        } else {
          throw err;
        }
      }

      setState({
        kind: 'ready',
        blobUrl,
        filename,
        archiveHash: archive.archiveHash,
        audit: auditStatus,
      });
    } catch (err) {
      // On distingue les erreurs metadata réseau (ApiError) des erreurs
      // pipeline (généralement crypto / WebCrypto). La granularité du
      // message i18n reste générique pour ne pas leak d'info technique.
      if (err instanceof ApiError) {
        setState({ kind: 'error', messageKey: 'privacyExport.errors.metadataFailed' });
      } else {
        setState({ kind: 'error', messageKey: 'privacyExport.errors.generationFailed' });
      }
    }
  };

  const triggerDownload = (blobUrl: string, filename: string): void => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const triggerSystemShare = async (blobUrl: string, filename: string): Promise<void> => {
    const blob = await fetch(blobUrl).then((r) => r.blob());
    const file = new File([blob], filename, { type: 'application/zip' });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] }) === true) {
      try {
        await nav.share({ files: [file], title: t('privacyExport.title') });
      } catch {
        // L'utilisateur a annulé — pas d'action supplémentaire.
      }
      return;
    }
    triggerDownload(blobUrl, filename);
  };

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('privacyExport.title')}</H1>
      <Text>{t('privacyExport.description')}</Text>

      <Card padded bordered>
        <YStack gap="$3">
          <H2>{t('privacyExport.sectionTitle')}</H2>
          <Text fontSize="$2">{t('privacyExport.contents')}</Text>

          <Button
            onPress={() => {
              void handleExport();
            }}
            disabled={state.kind === 'preparing' || doc === null}
            accessibilityLabel={t('privacyExport.exportCta')}
          >
            {state.kind === 'preparing'
              ? t('privacyExport.preparing')
              : t('privacyExport.exportCta')}
          </Button>

          {state.kind === 'error' ? (
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(state.messageKey)}
            </Text>
          ) : null}

          {state.kind === 'ready' ? (
            <YStack gap="$3">
              <Text color="$green10">{t('privacyExport.readyMessage')}</Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button onPress={() => triggerDownload(state.blobUrl, state.filename)}>
                  {t('privacyExport.downloadCta')}
                </Button>
                <Button
                  onPress={() => {
                    void triggerSystemShare(state.blobUrl, state.filename);
                  }}
                >
                  {t('privacyExport.shareCta')}
                </Button>
              </XStack>
              <Text fontSize="$1" color="$color10" selectable>
                {t('privacyExport.archiveHashLabel')}
                {': '}
                {state.archiveHash}
              </Text>
              <Text color={state.audit === 'synced' ? '$color10' : '$orange10'}>
                {state.audit === 'synced'
                  ? t('privacyExport.auditNotice')
                  : t('privacyExport.auditFailed')}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Card>

      <Text fontSize="$2" color="$color9">
        {t('privacyExport.disclaimer')}
      </Text>
      <Text fontSize="$2" color="$color9">
        {t('privacyExport.signedLinkComingSoon')}
      </Text>
    </YStack>
  );
}

function buildLookup(
  doc: Parameters<typeof projectDoses>[0],
): (doseId: string) => { pumpId: string; caregiverId: string; dosesAdministered: number } | null {
  const map = new Map<string, { pumpId: string; caregiverId: string; dosesAdministered: number }>();
  for (const d of projectDoses(doc)) {
    map.set(d.doseId, {
      pumpId: d.pumpId,
      caregiverId: d.caregiverId,
      dosesAdministered: d.dosesAdministered,
    });
  }
  return (doseId: string) => map.get(doseId) ?? null;
}
