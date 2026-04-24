import React, { type JSX } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Card, Label, Input } from 'tamagui';
import {
  aggregateReportData,
  buildCsvDoses,
  buildReportStrings,
  generateMedicalCsv,
  generateMedicalReport,
  presetRange,
  validateDateRange,
  type DateRange,
  type RangePreset,
} from '@kinhale/reports';
import { projectDoses, type KinhaleDoc } from '@kinhale/sync';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';
import { ApiError } from '../../src/lib/api-client';
import {
  postReportGeneratedAudit,
  postReportSharedAudit,
  type ShareMethod,
} from '../../src/lib/reports/audit-client';

const GENERATOR_LABEL = `Kinhale ${process.env['EXPO_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | {
      kind: 'ready';
      pdfUri: string;
      csvUri: string;
      reportHash: string;
      audit: 'synced' | 'pending';
    }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Rapport médecin » — mobile (iOS + Android, Expo SDK 52).
 *
 * KIN-084 ajoute :
 * - Export CSV brut parallèle au PDF (E8-S03).
 * - Boutons de partage par format (Télécharger ≡ share sheet Expo / Envoyer ≡
 *   share sheet explicite).
 * - Bouton « Lien signé 7 j » désactivé avec tooltip (ADR-D13).
 * - Audit `POST /audit/report-shared`.
 *
 * Refs: ADR-D12, ADR-D13, W9, E8-S01, E8-S02, E8-S03, E8-S04, E8-S05.
 */
export default function ReportsScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  const [preset, setPreset] = React.useState<RangePreset | 'custom'>('30d');
  const [customStart, setCustomStart] = React.useState<string>('');
  const [customEnd, setCustomEnd] = React.useState<string>('');
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
          void FileSystem.deleteAsync(prev.pdfUri, { idempotent: true });
          void FileSystem.deleteAsync(prev.csvUri, { idempotent: true });
        }
        return prev;
      });
    },
    [],
  );

  const handleGenerate = async (): Promise<void> => {
    if (doc === null) return;
    const range = computeRange(preset, customStart, customEnd);
    const validation = validateDateRange(range);
    if (!validation.ok) {
      setState({ kind: 'error', messageKey: `report.ui.errors.${validation.error}` });
      return;
    }
    setState((prev) => {
      if (prev.kind === 'ready') {
        void FileSystem.deleteAsync(prev.pdfUri, { idempotent: true });
        void FileSystem.deleteAsync(prev.csvUri, { idempotent: true });
      }
      return { kind: 'generating' };
    });
    try {
      const now = Date.now();
      const result = await generateMedicalReport({
        doc,
        range,
        strings: buildReportStrings((key, fallback) => t(key, fallback ?? key)),
        generator: GENERATOR_LABEL,
        generatedAtMs: now,
        locale: t('home.title') === 'Kinhale' ? 'fr' : 'en',
      });

      const printed = await Print.printToFileAsync({ html: result.html });
      const pdfUri = printed.uri;

      // Génère le CSV et l'écrit dans le cache de l'app (purgé à l'unmount).
      const reportData = aggregateReportData(doc, range);
      const csvDoses = buildCsvDoses(reportData, buildLookup(doc));
      const csv = generateMedicalCsv(csvDoses);
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const iso = new Date(now).toISOString().slice(0, 10);
      const csvUri = `${cacheDir}kinhale-report-${iso}.csv`;
      await FileSystem.writeAsStringAsync(csvUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let auditStatus: 'synced' | 'pending' = 'synced';
      try {
        await postReportGeneratedAudit({
          reportHash: result.contentHash,
          rangeStartMs: range.startMs,
          rangeEndMs: range.endMs,
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
        pdfUri,
        csvUri,
        reportHash: result.contentHash,
        audit: auditStatus,
      });
    } catch {
      setState({ kind: 'error', messageKey: 'report.ui.generationError' });
    }
  };

  /**
   * Logge un partage côté audit trail (best-effort). Aucun effet UX en cas
   * d'échec — le partage a déjà été matérialisé côté client.
   */
  const logShare = async (reportHash: string, method: ShareMethod): Promise<void> => {
    try {
      await postReportSharedAudit({
        reportHash,
        shareMethod: method,
        sharedAtMs: Date.now(),
      });
    } catch {
      // Best-effort.
    }
  };

  /**
   * Partage générique via `expo-sharing`. `mimeType` et `auditMethod` sont
   * passés par l'appelant pour distinguer PDF vs CSV côté audit.
   */
  const shareFile = async (
    uri: string,
    mimeType: string,
    auditMethod: ShareMethod,
    reportHash: string,
  ): Promise<void> => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      if (Platform.OS !== 'web') {
        const unavailableKey = auditMethod.startsWith('csv')
          ? 'report.ui.csv.shareUnavailable'
          : 'report.ui.pdf.shareUnavailable';
        Alert.alert(t('report.ui.pageTitle'), t(unavailableKey));
      }
      return;
    }
    try {
      await Sharing.shareAsync(uri, { mimeType });
      await logShare(reportHash, auditMethod);
    } catch {
      // L'utilisateur a annulé le share sheet — pas d'audit.
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1 accessibilityRole="header">{t('report.ui.pageTitle')}</H1>
      <Text>{t('report.ui.description')}</Text>

      <Card padded bordered>
        <YStack gap="$3">
          <Label>{t('report.ui.presetLabel')}</Label>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              size="$3"
              theme={preset === '30d' ? 'active' : null}
              onPress={() => setPreset('30d')}
            >
              {t('report.ui.preset30d')}
            </Button>
            <Button
              size="$3"
              theme={preset === '90d' ? 'active' : null}
              onPress={() => setPreset('90d')}
            >
              {t('report.ui.preset90d')}
            </Button>
            <Button
              size="$3"
              theme={preset === 'custom' ? 'active' : null}
              onPress={() => setPreset('custom')}
            >
              {t('report.ui.presetCustom')}
            </Button>
          </XStack>

          {preset === 'custom' ? (
            <XStack gap="$3" flexWrap="wrap">
              <YStack>
                <Label>{t('report.ui.startLabel')}</Label>
                <Input value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" />
              </YStack>
              <YStack>
                <Label>{t('report.ui.endLabel')}</Label>
                <Input value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" />
              </YStack>
            </XStack>
          ) : null}

          <Button
            onPress={() => {
              void handleGenerate();
            }}
            disabled={state.kind === 'generating' || doc === null}
            accessibilityRole="button"
          >
            {state.kind === 'generating' ? t('report.ui.generating') : t('report.ui.generateCta')}
          </Button>

          {state.kind === 'error' ? (
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(state.messageKey)}
            </Text>
          ) : null}

          {state.kind === 'ready' ? (
            <YStack gap="$4">
              {/* Section PDF */}
              <YStack gap="$2">
                <H2>{t('report.ui.pdf.sectionTitle')}</H2>
                <Button
                  onPress={() => {
                    void shareFile(
                      state.pdfUri,
                      'application/pdf',
                      'system_share',
                      state.reportHash,
                    );
                  }}
                  accessibilityRole="button"
                >
                  {t('report.ui.pdf.shareCta')}
                </Button>
                <Button disabled accessibilityLabel={t('report.ui.signedLink.comingSoonTooltip')}>
                  {t('report.ui.signedLink.cta')}
                </Button>
                <Text color="$color9" fontSize="$2">
                  {t('report.ui.signedLink.comingSoonTooltip')}
                </Text>
              </YStack>

              {/* Section CSV */}
              <YStack gap="$2">
                <H2>{t('report.ui.csv.sectionTitle')}</H2>
                <Text fontSize="$2">{t('report.ui.csv.description')}</Text>
                <Button
                  onPress={() => {
                    void shareFile(state.csvUri, 'text/csv', 'csv_system_share', state.reportHash);
                  }}
                  accessibilityRole="button"
                >
                  {t('report.ui.csv.shareCta')}
                </Button>
              </YStack>

              <Text color={state.audit === 'synced' ? '$color10' : '$orange10'}>
                {state.audit === 'synced' ? t('report.ui.auditNotice') : t('report.ui.auditFailed')}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Card>
    </YStack>
  );
}

function computeRange(
  preset: RangePreset | 'custom',
  customStart: string,
  customEnd: string,
): DateRange {
  if (preset === '30d' || preset === '90d') {
    return presetRange(preset, Date.now());
  }
  const startMs = customStart !== '' ? Date.parse(`${customStart}T00:00:00Z`) : Number.NaN;
  const endMs = customEnd !== '' ? Date.parse(`${customEnd}T23:59:59.999Z`) : Number.NaN;
  return { startMs, endMs };
}

/**
 * Construit un lookup `doseId → {pumpId, caregiverId, dosesAdministered}`
 * à partir du document Automerge. Le CSV a besoin de ces identifiants
 * opaques qui sont absents de `ReportData` (minimisation RM8 côté PDF).
 */
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
