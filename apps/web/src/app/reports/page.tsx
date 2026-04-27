'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation, type UseTranslationResponse } from 'react-i18next';

import {
  aggregateReportData,
  buildCsvDoses,
  buildReportStrings,
  generateMedicalCsv,
  generateMedicalReport,
  presetRange,
  validateDateRange,
  type DateRange,
} from '@kinhale/reports';
import { projectChild, projectDoses, type KinhaleDoc } from '@kinhale/sync';
import {
  ReportsListMobile,
  ReportsListWeb,
  type RangePreset as PresentationRangePreset,
  type ReportsNavItem,
} from '@kinhale/ui/reports';

import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { ApiError } from '../../lib/api-client';
import {
  postReportGeneratedAudit,
  postReportSharedAudit,
  type ShareMethod,
  type SystemShareMethod,
} from '../../lib/reports/audit-client';
import {
  aggregateUiStats,
  buildDailySeries,
  buildReportsMessages,
  buildSelectedRangeLabel,
  buildStats,
  presetToInternal,
  rescueDosesToEvents,
} from '../../lib/reports/messages';

const GENERATOR_LABEL = `Kinhale ${process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;
const DESKTOP_BREAKPOINT_PX = 1024;

type ReadyState = {
  kind: 'ready';
  pdfBlobUrl: string;
  csvBlobUrl: string;
  csvFilename: string;
  pdfFilename: string;
  reportHash: string;
  audit: 'synced' | 'pending';
};

type UiState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | ReadyState
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Rapports » clinical-calm v2 (KIN-115).
 *
 * Préserve toute la logique de génération PDF / CSV + audit logging
 * de la v1 (E8-S01-S05, KIN-084). Seule la couche présentationnelle
 * change — sidebar dashboard, RangePicker, StatBlock × 4, charts SVG,
 * journal des secours, banner sticky « Rapport prêt ».
 */
export default function ReportsPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  const [hydrated, setHydrated] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [preset, setPreset] = useState<PresentationRangePreset>('30d');
  const [state, setState] = useState<UiState>({ kind: 'idle' });
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
      const update = (): void => setIsDesktop(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (accessToken === null) {
      router.replace('/auth');
      return;
    }
    if (householdId !== null) {
      void initDoc(householdId);
    }
  }, [accessToken, hydrated, householdId, initDoc, router]);

  // Cleanup blob URLs au démontage.
  useEffect(
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

  const locale = i18n.language === 'en' ? 'en-CA' : 'fr-CA';

  const range = React.useMemo<DateRange>(
    () => presetRange(presetToInternal(preset), Date.now()),
    [preset],
  );

  const reportData = React.useMemo(() => {
    if (doc === null) return null;
    return aggregateReportData(doc, range);
  }, [doc, range]);

  const totalDays = Math.max(1, Math.round((range.endMs - range.startMs) / 86_400_000));

  const stats = React.useMemo(() => {
    if (reportData === null) {
      return {
        adherencePct: 0,
        missedDays: 0,
        totalDays,
        rescueCount: 0,
        symptomDays: 0,
        nightWakings: 0,
      };
    }
    return aggregateUiStats(reportData, totalDays);
  }, [reportData, totalDays]);

  const statsMessages = React.useMemo(() => buildStats(t, stats), [t, stats]);

  const childName = React.useMemo(() => {
    const projected = doc !== null ? projectChild(doc) : null;
    if (projected === null) return t('home.dashboard.childName');
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - projected.birthYear);
    return `${projected.firstName.toUpperCase()}, ${t('settings.child.ageYearsFormat', { count: ageYears }).toUpperCase()}`;
  }, [doc, t]);

  const selectedRangeLabel = buildSelectedRangeLabel(t, range.startMs, range.endMs, locale);

  const messages = React.useMemo(
    () => buildReportsMessages({ t, childName, selectedRangeLabel, stats: statsMessages }),
    [t, childName, selectedRangeLabel, statsMessages],
  );

  const allDoses = React.useMemo(() => (doc !== null ? projectDoses(doc) : []), [doc]);

  const rescueEvents = React.useMemo(
    () => rescueDosesToEvents(allDoses, range.startMs, range.endMs, locale),
    [allDoses, range.startMs, range.endMs, locale],
  );

  const series = React.useMemo(() => buildDailySeries(allDoses, Date.now(), 30), [allDoses]);

  const navItems = React.useMemo<ReportsNavItem[]>(
    () => [
      { key: 'home', label: t('pumps.nav.home'), onPress: () => router.push('/') },
      {
        key: 'history',
        label: t('pumps.nav.history'),
        onPress: () => router.push('/journal'),
      },
      { key: 'pumps', label: t('pumps.nav.pumps'), onPress: () => router.push('/pumps') },
      {
        key: 'caregivers',
        label: t('pumps.nav.caregivers'),
        onPress: () => router.push('/caregivers'),
      },
      { key: 'reports', label: t('pumps.nav.reports'), active: true },
      {
        key: 'settings',
        label: t('pumps.nav.settings'),
        onPress: () => router.push('/settings'),
      },
    ],
    [router, t],
  );

  const handleGenerate = async (): Promise<void> => {
    if (doc === null) return;
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
        locale: i18n.language === 'en' ? 'en' : 'fr',
      });

      const iframe = iframeRef.current;
      if (iframe !== null) {
        iframe.srcdoc = result.html;
        iframe.onload = (): void => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            // Pop-up bloquant : l'utilisateur peut télécharger via le banner.
          }
        };
      }

      const pdfBlob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
      const pdfBlobUrl = URL.createObjectURL(pdfBlob);

      const aggregated = aggregateReportData(doc, range);
      const csvDoses = buildCsvDoses(aggregated, buildLookup(doc));
      const csv = generateMedicalCsv(csvDoses);
      const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const csvBlobUrl = URL.createObjectURL(csvBlob);

      const iso = new Date(now).toISOString().slice(0, 10);

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
        csvFilename: `kinhale-report-${iso}.csv`,
        pdfFilename: `kinhale-report-${iso}.html`,
        reportHash: result.contentHash,
        audit: auditStatus,
      });
    } catch {
      setState({ kind: 'error', messageKey: 'report.ui.generationError' });
    }
  };

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
        // Annulé par l'utilisateur.
      }
      return;
    }
    triggerDownload(blobUrl, filename);
    const downloadMethod: ShareMethod =
      auditMethod === 'system_share' ? 'download' : 'csv_download';
    await logShare(reportHash, downloadMethod);
  };

  if (!hydrated || accessToken === null || isDesktop === null) {
    return null;
  }

  const handlers = {
    onChangeRange: (next: PresentationRangePreset): void => setPreset(next),
    onPressExport: (): void => {
      void handleGenerate();
    },
    onPressShare: (): void => {
      // Si rapport déjà prêt, le banner gère le partage.
      // Sinon on génère ; l'utilisateur cliquera ensuite sur « Partager ».
      if (state.kind !== 'ready') {
        void handleGenerate();
      }
    },
  };

  const layoutProps = {
    messages,
    activeRange: preset,
    rescueEvents,
    adherenceSeries: series.adherence,
    rescueSeries: series.rescue,
    handlers,
  };

  return (
    <>
      {isDesktop ? (
        <ReportsListWeb {...layoutProps} navItems={navItems} />
      ) : (
        <ReportsListMobile {...layoutProps} />
      )}

      {state.kind === 'generating' && (
        <div role="status" data-testid="reports-generating" style={overlayStyle}>
          {t('report.ui.generating')}
        </div>
      )}

      {state.kind === 'error' && (
        <div
          role="status"
          data-testid="reports-error"
          style={{ ...overlayStyle, background: 'var(--rescueSoft)', color: 'var(--rescueInk)' }}
        >
          {t(state.messageKey)}
        </div>
      )}

      {state.kind === 'ready' && (
        <ReadyBanner
          state={state}
          t={t}
          onDownloadPdf={() => {
            triggerDownload(state.pdfBlobUrl, state.pdfFilename);
            void logShare(state.reportHash, 'download');
          }}
          onDownloadCsv={() => {
            triggerDownload(state.csvBlobUrl, state.csvFilename);
            void logShare(state.reportHash, 'csv_download');
          }}
          onSharePdf={() => {
            void handleShareFile(
              state.pdfBlobUrl,
              state.pdfFilename,
              'text/html',
              'system_share',
              state.reportHash,
            );
          }}
          onClose={() => {
            URL.revokeObjectURL(state.pdfBlobUrl);
            URL.revokeObjectURL(state.csvBlobUrl);
            setState({ kind: 'idle' });
          }}
        />
      )}

      <iframe
        ref={iframeRef}
        title="kinhale-report-print"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, border: 0, left: -9999, top: -9999 }}
      />
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--surface)',
  color: 'var(--color)',
  padding: '12px 18px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 500,
  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  border: '0.5px solid var(--borderColor)',
  zIndex: 100,
};

interface ReadyBannerProps {
  state: ReadyState;
  t: UseTranslationResponse<'common', undefined>['t'];
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  onSharePdf: () => void;
  onClose: () => void;
}

function ReadyBanner({
  state,
  t,
  onDownloadPdf,
  onDownloadCsv,
  onSharePdf,
  onClose,
}: ReadyBannerProps): React.JSX.Element {
  return (
    <div
      role="status"
      data-testid="reports-ready"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface)',
        color: 'var(--color)',
        padding: '14px 18px',
        borderRadius: 14,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        border: '0.5px solid var(--borderColor)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, marginRight: 8 }}>
        {t('report.ui.pdf.sectionTitle')}
      </span>
      <button onClick={onDownloadPdf} style={primaryBtnStyle}>
        {t('report.ui.pdf.downloadCta')}
      </button>
      <button onClick={onSharePdf} style={secondaryBtnStyle}>
        {t('report.ui.pdf.shareCta')}
      </button>
      <button onClick={onDownloadCsv} style={secondaryBtnStyle}>
        {t('report.ui.csv.downloadCta')}
      </button>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          color: 'var(--colorMore)',
          fontSize: 18,
          cursor: 'pointer',
          padding: 4,
          marginLeft: 4,
        }}
      >
        ×
      </button>
      {state.audit === 'pending' && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--amberInk)',
            background: 'var(--amberSoft)',
            padding: '4px 8px',
            borderRadius: 99,
            marginLeft: 4,
          }}
        >
          {t('report.ui.auditFailed')}
        </span>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  appearance: 'none',
  cursor: 'pointer',
  background: 'var(--maint)',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: 10,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  appearance: 'none',
  cursor: 'pointer',
  background: 'var(--surface)',
  color: 'var(--colorMuted)',
  padding: '8px 14px',
  borderRadius: 10,
  border: '0.5px solid var(--borderColorStrong)',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

function triggerDownload(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  return (doseId) => map.get(doseId) ?? null;
}
