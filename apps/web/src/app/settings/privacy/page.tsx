'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Card, Input } from 'tamagui';
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
import {
  getDeletionStatus,
  postDeletionRequest,
  postDeletionCancel,
  type DeletionStatus,
} from '../../../lib/account-deletion/client';

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

/**
 * Section « Supprimer mon foyer » — KIN-086, E9-S03 + E9-S04.
 *
 * Affiche soit :
 * - le bouton de déclenchement + dialog de confirmation (état `active`),
 * - un bandeau d'avertissement + bouton « Annuler » (état `pending_deletion`).
 *
 * Le formulaire de confirmation exige la saisie EXACTE du mot
 * « SUPPRIMER » (FR) ou « DELETE » (EN) ainsi que l'adresse e-mail du
 * compte. Au submit, l'API envoie un e-mail de step-up auth — l'utilisateur
 * doit cliquer le lien dans les 5 min pour finaliser.
 */
function AccountDeletionSection(): React.JSX.Element {
  const { t } = useTranslation('common');
  // Détection de locale : on s'aligne sur la chaîne déjà utilisée dans la
  // page (`home.title === 'Kinhale'` est la même valeur dans les 2 locales,
  // donc on lit une clé dédiée — `accountDeletion.confirmationWord`).
  const requiredWord = t('accountDeletion.confirmationWord');
  type DialogState =
    | { kind: 'closed' }
    | { kind: 'open'; word: string; email: string; submitting: boolean }
    | { kind: 'sent' }
    | { kind: 'error'; messageKey: string };
  const [status, setStatus] = React.useState<DeletionStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
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
      setStatusError(null);
    } catch (err) {
      // En cas d'erreur (ex. session expirée, réseau), on ne bloque pas
      // l'UI — on affiche un message discret. La section export reste
      // pleinement utilisable.
      setStatusError(err instanceof Error ? err.message : 'unknown');
    }
  }, []);

  React.useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleSubmitRequest = async (): Promise<void> => {
    if (dialog.kind !== 'open') return;
    if (dialog.word !== requiredWord) {
      setDialog({ kind: 'error', messageKey: 'accountDeletion.errors.wordMismatch' });
      return;
    }
    setDialog({ ...dialog, submitting: true });
    try {
      // confirmationWord est typé par l'API en union `'SUPPRIMER' | 'DELETE'`.
      // Le requiredWord vient des locales — on coerce vers cette union.
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
            : code === 'invalid_body'
              ? 'accountDeletion.errors.invalidBody'
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
        ) : (
          <>
            {dialog.kind === 'closed' ? (
              <Button
                onPress={() => setDialog({ kind: 'open', word: '', email: '', submitting: false })}
                accessibilityLabel={t('accountDeletion.openDialogCta')}
                theme="red"
              >
                {t('accountDeletion.openDialogCta')}
              </Button>
            ) : null}

            {dialog.kind === 'open' ? (
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
                      void handleSubmitRequest();
                    }}
                    disabled={
                      dialog.submitting || dialog.word !== requiredWord || dialog.email === ''
                    }
                    theme="red"
                  >
                    {t('accountDeletion.submitCta')}
                  </Button>
                  <Button onPress={() => setDialog({ kind: 'closed' })} theme="alt2">
                    {t('accountDeletion.cancelDialog')}
                  </Button>
                </XStack>
              </YStack>
            ) : null}

            {dialog.kind === 'sent' ? (
              <Text color="$green10" accessibilityLiveRegion="polite">
                {t('accountDeletion.stepUpSent')}
              </Text>
            ) : null}

            {dialog.kind === 'error' ? (
              <YStack gap="$2">
                <Text color="$red10" accessibilityLiveRegion="polite">
                  {t(dialog.messageKey)}
                </Text>
                <Button onPress={() => setDialog({ kind: 'closed' })} theme="alt2">
                  {t('accountDeletion.cancelDialog')}
                </Button>
              </YStack>
            ) : null}
          </>
        )}

        {statusError !== null ? (
          <Text fontSize="$1" color="$color9">
            {/* On ne traduit pas une erreur réseau bas-niveau — message
                discret pour debug. */}
            ({statusError})
          </Text>
        ) : null}
      </YStack>
    </Card>
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
