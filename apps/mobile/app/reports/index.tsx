import React, { type JSX } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Card, Label, Input } from 'tamagui';
import {
  buildReportStrings,
  generateMedicalReport,
  presetRange,
  validateDateRange,
  type DateRange,
  type RangePreset,
} from '@kinhale/reports';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';
import { ApiError } from '../../src/lib/api-client';
import { postReportGeneratedAudit } from '../../src/lib/reports/audit-client';

const GENERATOR_LABEL = `Kinhale ${process.env['EXPO_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; uri: string; audit: 'synced' | 'pending' }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Rapport médecin » — mobile (iOS + Android, Expo SDK 52).
 *
 * Utilise `expo-print.printToFileAsync({ html })` pour matérialiser un PDF
 * depuis le HTML canonique produit par `@kinhale/reports`. Le fichier est
 * stocké dans le répertoire cache de l'app (pas dans `FileSystem.documentDirectory`
 * — pas de donnée santé persistée plus longtemps que nécessaire, le cache
 * est purgé par l'OS).
 *
 * Le partage passe par l'API native (iOS Share Sheet / Android Intent)
 * pour que l'utilisateur choisisse Mail / AirDrop / WhatsApp / Fichiers.
 * Aucun appel réseau n'est fait par le client Kinhale pour le partage —
 * le relais Kamez n'a jamais accès au PDF.
 *
 * Refs: W9, E8-S01, E8-S02, E8-S05, ADR-D12.
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
          void FileSystem.deleteAsync(prev.uri, { idempotent: true });
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
        void FileSystem.deleteAsync(prev.uri, { idempotent: true });
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
      const uri = printed.uri;

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

      setState({ kind: 'ready', uri, audit: auditStatus });
    } catch {
      setState({ kind: 'error', messageKey: 'report.ui.generationError' });
    }
  };

  const handleShare = async (): Promise<void> => {
    if (state.kind !== 'ready') return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      if (Platform.OS !== 'web') {
        Alert.alert(t('report.ui.pageTitle'), t('report.ui.generationError'));
      }
      return;
    }
    const uri = state.uri;
    try {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      setState({ kind: 'idle' });
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
            <YStack gap="$2">
              <H2>{t('report.ui.shareCta')}</H2>
              <Button
                onPress={() => {
                  void handleShare();
                }}
                accessibilityRole="button"
              >
                {t('report.ui.shareCta')}
              </Button>
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
