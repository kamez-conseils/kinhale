import React, { type JSX } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { Buffer } from 'buffer';
import { YStack, XStack, H1, H2, Text, Button, Card, Input } from 'tamagui';
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
import {
  getDeletionStatus,
  postDeletionRequest,
  postDeletionCancel,
  type DeletionStatus,
} from '../../src/lib/account-deletion/client';

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

      <AccountDeletionSection />

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

/**
 * Section « Supprimer mon foyer » mobile — KIN-086, E9-S03 + E9-S04.
 * Pendant fidèle de la section web (pattern symétrique).
 */
function AccountDeletionSection(): JSX.Element {
  const { t } = useTranslation('common');
  const requiredWord = t('accountDeletion.confirmationWord');
  type DialogState =
    | { kind: 'closed' }
    | { kind: 'open'; word: string; email: string; submitting: boolean }
    | { kind: 'sent' }
    | { kind: 'error'; messageKey: string };
  const [status, setStatus] = React.useState<DeletionStatus | null>(null);
  const [dialog, setDialog] = React.useState<DialogState>({ kind: 'closed' });
  const [cancelState, setCancelState] = React.useState<
    | { kind: 'idle' }
    | { kind: 'cancelling' }
    | { kind: 'success' }
    | { kind: 'error'; messageKey: string }
  >({ kind: 'idle' });

  const refreshStatus = React.useCallback(async (): Promise<void> => {
    try {
      const s = await getDeletionStatus();
      setStatus(s);
    } catch {
      // Silencieux côté mobile — l'UI reste utilisable pour l'export.
    }
  }, []);

  React.useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleSubmit = async (): Promise<void> => {
    if (dialog.kind !== 'open') return;
    if (dialog.word !== requiredWord) {
      setDialog({ kind: 'error', messageKey: 'accountDeletion.errors.wordMismatch' });
      return;
    }
    setDialog({ ...dialog, submitting: true });
    try {
      const word = (requiredWord === 'DELETE' ? 'DELETE' : 'SUPPRIMER') as 'SUPPRIMER' | 'DELETE';
      await postDeletionRequest({ confirmationWord: word, email: dialog.email });
      setDialog({ kind: 'sent' });
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'network';
      const messageKey =
        code === 'invalid_credentials'
          ? 'accountDeletion.errors.emailMismatch'
          : code === 'already_pending'
            ? 'accountDeletion.errors.alreadyPending'
            : 'accountDeletion.errors.network';
      setDialog({ kind: 'error', messageKey });
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelState({ kind: 'cancelling' });
    try {
      await postDeletionCancel();
      setCancelState({ kind: 'success' });
      await refreshStatus();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'unknown';
      const messageKey =
        code === 'grace_period_expired'
          ? 'accountDeletion.pending.cancelExpired'
          : 'accountDeletion.pending.cancelError';
      setCancelState({ kind: 'error', messageKey });
    }
  };

  const isPending = status?.status === 'pending_deletion';
  const scheduledIso =
    status?.scheduledAtMs !== null && status?.scheduledAtMs !== undefined
      ? new Date(status.scheduledAtMs).toISOString().slice(0, 10)
      : '';

  return (
    <Card padded bordered>
      <YStack gap="$3">
        <H2>{t('accountDeletion.sectionTitle')}</H2>
        <Text fontSize="$2">{t('accountDeletion.description')}</Text>
        <Text fontSize="$2" color="$color9">
          {t('accountDeletion.consequences')}
        </Text>
        <Text fontSize="$2" color="$color9">
          {t('accountDeletion.exportFirst')}
        </Text>

        {isPending ? (
          <YStack
            gap="$2"
            padding="$3"
            backgroundColor="$orange3"
            borderRadius="$3"
            accessibilityRole="alert"
          >
            <Text fontWeight="bold" color="$orange11">
              {t('accountDeletion.pending.bannerTitle')}
            </Text>
            <Text color="$orange11">
              {t('accountDeletion.pending.bannerMessage', { date: scheduledIso })}
            </Text>
            <Button
              onPress={() => {
                void handleCancel();
              }}
              disabled={cancelState.kind === 'cancelling'}
              accessibilityLabel={t('accountDeletion.pending.cancelCta')}
              accessibilityRole="button"
            >
              {cancelState.kind === 'cancelling'
                ? t('accountDeletion.pending.cancelling')
                : t('accountDeletion.pending.cancelCta')}
            </Button>
            {cancelState.kind === 'error' ? (
              <Text color="$red10" accessibilityLiveRegion="polite">
                {t(cancelState.messageKey)}
              </Text>
            ) : null}
            {cancelState.kind === 'success' ? (
              <Text color="$green10">{t('accountDeletion.pending.cancelSuccess')}</Text>
            ) : null}
          </YStack>
        ) : dialog.kind === 'closed' ? (
          <Button
            onPress={() => setDialog({ kind: 'open', word: '', email: '', submitting: false })}
            theme="red"
            accessibilityLabel={t('accountDeletion.openDialogCta')}
            accessibilityRole="button"
          >
            {t('accountDeletion.openDialogCta')}
          </Button>
        ) : dialog.kind === 'open' ? (
          <YStack gap="$3" padding="$3" borderWidth={1} borderColor="$color7" borderRadius="$3">
            <Text fontWeight="bold">{t('accountDeletion.dialogTitle')}</Text>
            <Text>{t('accountDeletion.dialogInstruction', { word: requiredWord })}</Text>
            <Input
              value={dialog.word}
              onChangeText={(v: string) => setDialog({ ...dialog, word: v })}
              placeholder={requiredWord}
              accessibilityLabel={t('accountDeletion.dialogTitle')}
            />
            <Text>{t('accountDeletion.emailLabel')}</Text>
            <Input
              value={dialog.email}
              onChangeText={(v: string) => setDialog({ ...dialog, email: v })}
              placeholder={t('accountDeletion.emailPlaceholder')}
              accessibilityLabel={t('accountDeletion.emailLabel')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <XStack gap="$2">
              <Button
                onPress={() => {
                  void handleSubmit();
                }}
                disabled={dialog.submitting || dialog.word !== requiredWord || dialog.email === ''}
                theme="red"
                accessibilityRole="button"
              >
                {t('accountDeletion.submitCta')}
              </Button>
              <Button
                onPress={() => setDialog({ kind: 'closed' })}
                theme="alt2"
                accessibilityRole="button"
              >
                {t('accountDeletion.cancelDialog')}
              </Button>
            </XStack>
          </YStack>
        ) : dialog.kind === 'sent' ? (
          <Text color="$green10" accessibilityLiveRegion="polite">
            {t('accountDeletion.stepUpSent')}
          </Text>
        ) : (
          <YStack gap="$2">
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(dialog.messageKey)}
            </Text>
            <Button
              onPress={() => setDialog({ kind: 'closed' })}
              theme="alt2"
              accessibilityRole="button"
            >
              {t('accountDeletion.cancelDialog')}
            </Button>
          </YStack>
        )}
      </YStack>
    </Card>
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
