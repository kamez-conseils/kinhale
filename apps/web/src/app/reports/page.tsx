'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Label, Card } from 'tamagui';
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
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { ApiError } from '../../lib/api-client';
import {
  postReportGeneratedAudit,
  postReportSharedAudit,
  type ShareMethod,
  type SystemShareMethod,
} from '../../lib/reports/audit-client';

/** Version du générateur — lue depuis `NEXT_PUBLIC_APP_VERSION` si fournie. */
const GENERATOR_LABEL = `Kinhale ${process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | {
      kind: 'ready';
      pdfBlobUrl: string;
      csvBlobUrl: string;
      csvFilename: string;
      pdfFilename: string;
      reportHash: string;
      audit: 'synced' | 'pending';
    }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Rapport médecin » — E8-S01+S02+S05 (PDF) **+ E8-S03+S04 (KIN-084)**.
 *
 * Nouveautés KIN-084 :
 * - Ajout d'une génération CSV brut parallèle (toutes les prises, incluant
 *   `pending_review`), côté 100% client.
 * - Trois modes de partage par format :
 *   - Télécharger (blob local + `<a download>`),
 *   - Envoyer (via `navigator.share` si dispo, sinon instruction explicite),
 *   - Lien signé 7 j **désactivé** (tooltip « v1.1 », cf. ADR-D13).
 * - Audit `POST /audit/report-shared` pour chaque partage réussi.
 *
 * Refs: ADR-D12, ADR-D13, E8-S03, E8-S04.
 */
export default function ReportsPage(): React.JSX.Element {
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
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    if (accessToken === null) {
      router.push('/auth');
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
          URL.revokeObjectURL(prev.pdfBlobUrl);
          URL.revokeObjectURL(prev.csvBlobUrl);
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
        URL.revokeObjectURL(prev.pdfBlobUrl);
        URL.revokeObjectURL(prev.csvBlobUrl);
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

      // Ouvre l'iframe d'impression. On utilise srcdoc pour tout rendre sans
      // réseau (zero-knowledge). Le navigateur appelle `print()` sur le
      // onload. L'utilisateur choisit « Enregistrer en PDF » dans la
      // boîte d'impression native.
      const iframe = iframeRef.current;
      if (iframe !== null) {
        iframe.srcdoc = result.html;
        iframe.onload = (): void => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            // Si `print()` échoue (popup bloquant), on reste sur l'écran
            // avec le blob accessible via bouton Télécharger.
          }
        };
      }

      // Blob URL téléchargement brut (fallback téléchargement HTML si
      // l'utilisateur ne veut pas passer par la boîte d'impression).
      const pdfBlob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
      const pdfBlobUrl = URL.createObjectURL(pdfBlob);

      // Génère aussi le CSV en parallèle (E8-S03).
      const reportData = aggregateReportData(doc, range);
      const csvDoses = buildCsvDoses(reportData, buildLookup(doc));
      const csv = generateMedicalCsv(csvDoses);
      const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const csvBlobUrl = URL.createObjectURL(csvBlob);

      const iso = new Date(now).toISOString().slice(0, 10);
      const csvFilename = `kinhale-report-${iso}.csv`;
      const pdfFilename = `kinhale-report-${iso}.html`;

      // Audit trail (best-effort).
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
        pdfBlobUrl,
        csvBlobUrl,
        csvFilename,
        pdfFilename,
        reportHash: result.contentHash,
        audit: auditStatus,
      });
    } catch {
      setState({ kind: 'error', messageKey: 'report.ui.generationError' });
    }
  };

  /**
   * Logge un partage côté audit trail (best-effort). En cas d'erreur, le
   * partage a déjà eu lieu côté client — on ne bloque pas l'UX.
   */
  const logShare = async (reportHash: string, method: ShareMethod): Promise<void> => {
    try {
      await postReportSharedAudit({
        reportHash,
        shareMethod: method,
        sharedAtMs: Date.now(),
      });
    } catch {
      // Best-effort : un échec d'audit ne doit pas remonter en UI.
    }
  };

  /**
   * Partage système via `navigator.share` si dispo + support de `files`.
   * Fallback : déclenche un téléchargement (comportement identique au bouton
   * Télécharger mais avec audit `system_share` pour distinguer l'intention).
   */
  const handleShareFile = async (
    blobUrl: string,
    filename: string,
    mimeType: string,
    auditMethod: SystemShareMethod,
    reportHash: string,
  ): Promise<void> => {
    const blob = await fetch(blobUrl).then((r) => r.blob());
    const file = new File([blob], filename, { type: mimeType });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] }) === true) {
      try {
        await nav.share({ files: [file], title: t('report.ui.pageTitle') });
        await logShare(reportHash, auditMethod);
      } catch {
        // L'utilisateur a annulé le picker — pas d'audit.
      }
      return;
    }
    triggerDownload(blobUrl, filename);
    const downloadMethod: ShareMethod =
      auditMethod === 'system_share' ? 'download' : 'csv_download';
    await logShare(reportHash, downloadMethod);
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('report.ui.pageTitle')}</H1>
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
                <Label htmlFor="report-start">{t('report.ui.startLabel')}</Label>
                <input
                  id="report-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ padding: 8, fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                />
              </YStack>
              <YStack>
                <Label htmlFor="report-end">{t('report.ui.endLabel')}</Label>
                <input
                  id="report-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ padding: 8, fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                />
              </YStack>
            </XStack>
          ) : null}

          <Button
            onPress={() => {
              void handleGenerate();
            }}
            disabled={state.kind === 'generating' || doc === null}
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
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    onPress={() => {
                      triggerDownload(state.pdfBlobUrl, state.pdfFilename);
                      void logShare(state.reportHash, 'download');
                    }}
                  >
                    {t('report.ui.pdf.downloadCta')}
                  </Button>
                  <Button
                    onPress={() => {
                      void handleShareFile(
                        state.pdfBlobUrl,
                        state.pdfFilename,
                        'text/html',
                        'system_share',
                        state.reportHash,
                      );
                    }}
                  >
                    {t('report.ui.pdf.shareCta')}
                  </Button>
                  <Button disabled accessibilityLabel={t('report.ui.signedLink.comingSoonTooltip')}>
                    {t('report.ui.signedLink.cta')}
                  </Button>
                </XStack>
                <Text color="$color9" fontSize="$2">
                  {t('report.ui.signedLink.comingSoonTooltip')}
                </Text>
              </YStack>

              {/* Section CSV */}
              <YStack gap="$2">
                <H2>{t('report.ui.csv.sectionTitle')}</H2>
                <Text fontSize="$2">{t('report.ui.csv.description')}</Text>
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    onPress={() => {
                      triggerDownload(state.csvBlobUrl, state.csvFilename);
                      void logShare(state.reportHash, 'csv_download');
                    }}
                  >
                    {t('report.ui.csv.downloadCta')}
                  </Button>
                  <Button
                    onPress={() => {
                      void handleShareFile(
                        state.csvBlobUrl,
                        state.csvFilename,
                        'text/csv',
                        'csv_system_share',
                        state.reportHash,
                      );
                    }}
                  >
                    {t('report.ui.csv.shareCta')}
                  </Button>
                </XStack>
              </YStack>

              <Text color={state.audit === 'synced' ? '$color10' : '$orange10'}>
                {state.audit === 'synced' ? t('report.ui.auditNotice') : t('report.ui.auditFailed')}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Card>

      {/* Iframe invisible servant uniquement à déclencher window.print sur le HTML.
          La MaxW/Height 0 garantit qu'elle n'occupe aucun espace visuel. */}
      <iframe
        ref={iframeRef}
        title="kinhale-report-print"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, border: 0, left: -9999, top: -9999 }}
      />
    </YStack>
  );
}

/**
 * Déclenche un téléchargement navigateur via un `<a download>` éphémère.
 * Factorisé pour éviter les `as any` dans le JSX.
 */
function triggerDownload(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Calcule la `DateRange` effective en fonction du preset choisi et des
 * champs custom. Pour les dates custom, on lit les valeurs `YYYY-MM-DD`
 * et on les interprète en UTC minuit/fin de journée.
 */
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
 * à partir du document Automerge, pour enrichir les lignes CSV avec les
 * identifiants opaques absents de `ReportData` (minimisation RM8 côté PDF).
 *
 * Le lookup reste **pur** (pas d'effet de bord) et n'expose aucun nom de
 * pompe ni prénom d'aidant — uniquement les UUID opaques.
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
