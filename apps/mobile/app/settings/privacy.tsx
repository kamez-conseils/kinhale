import React, { type JSX } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { Buffer } from 'buffer';
import { YStack, XStack, H1, H2, Text, Button, Card } from 'tamagui';
import {
  aggregateReportData,
  buildCsvDoses,
  buildPrivacyArchive,
  buildReportStrings,
  generateMedicalCsv,
  generateMedicalReport,
  serializeDocForExport,
} from '@kinhale/reports';
import { projectDoses, type KinhaleDoc } from '@kinhale/sync';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';
import { ApiError } from '../../src/lib/api-client';
import {
  getPrivacyExportMetadata,
  postPrivacyExportAudit,
} from '../../src/lib/privacy/export-client';

const GENERATOR_LABEL = `Kinhale ${process.env['EXPO_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | {
      kind: 'ready';
      uri: string;
      archiveHash: string;
      audit: 'synced' | 'pending';
    }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Paramètres → Confidentialité » mobile — KIN-085, E9-S02, ADR-D14.
 *
 * Pendant mobile de `apps/web/src/app/settings/privacy/page.tsx`. Différences :
 * - Utilise `expo-file-system` pour écrire le ZIP en cache (encodé base64).
 * - Utilise `Sharing.shareAsync` pour la share sheet OS.
 * - Purge le fichier cache à l'unmount.
 */
export default function PrivacyExportScreen(): JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);
  const [state, setState] = React.useState<UiState>({ kind: 'idle' });

  React.useEffect(() => {
    if (accessToken === null) {
      router.replace('/auth');
      return;
    }
    if (householdId !== null) {
      void initDoc(householdId);
    }
  }, [accessToken, householdId, initDoc, router]);

  React.useEffect(
    () => (): void => {
      setState((prev) => {
        if (prev.kind === 'ready') {
          // Purge proactive — l'archive contient des données santé en clair
          // pendant la durée de vie locale ; on minimise la fenêtre.
          void FileSystem.deleteAsync(prev.uri, { idempotent: true });
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
        void FileSystem.deleteAsync(prev.uri, { idempotent: true });
      }
      return { kind: 'preparing' };
    });

    try {
      const metadata = await getPrivacyExportMetadata();
      const now = Date.now();
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

      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const iso = new Date(now).toISOString().slice(0, 10);
      const uri = `${cacheDir}kinhale-privacy-export-${iso}.zip`;

      // expo-file-system n'accepte pas Uint8Array directement — on encode
      // en base64 via le polyfill `buffer` (déjà utilisé pour les clés crypto).
      const base64 = Buffer.from(archive.zipBytes).toString('base64');
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

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
        uri,
        archiveHash: archive.archiveHash,
        audit: auditStatus,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setState({ kind: 'error', messageKey: 'privacyExport.errors.metadataFailed' });
      } else {
        setState({ kind: 'error', messageKey: 'privacyExport.errors.generationFailed' });
      }
    }
  };

  const handleShare = async (uri: string): Promise<void> => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      if (Platform.OS !== 'web') {
        Alert.alert(t('privacyExport.title'), t('privacyExport.shareUnavailable'));
      }
      return;
    }
    try {
      await Sharing.shareAsync(uri, { mimeType: 'application/zip' });
    } catch {
      // Annulation utilisateur.
    }
  };

  if (accessToken === null) return null;

  return (
    <YStack padding="$4" gap="$4">
      <H1 accessibilityRole="header">{t('privacyExport.title')}</H1>
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
            accessibilityRole="button"
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
                <Button
                  onPress={() => {
                    void handleShare(state.uri);
                  }}
                  accessibilityRole="button"
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
  doc: KinhaleDoc,
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
