'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Label, Card } from 'tamagui';
import {
  buildReportStrings,
  generateMedicalReport,
  MS_PER_DAY,
  presetRange,
  validateDateRange,
  type DateRange,
  type RangePreset,
} from '@kinhale/reports';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { ApiError } from '../../lib/api-client';
import { postReportGeneratedAudit } from '../../lib/reports/audit-client';

/** Version du générateur — lue depuis `NEXT_PUBLIC_APP_VERSION` si fournie. */
const GENERATOR_LABEL = `Kinhale ${process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview'}`;

type UiState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; pdfBlobUrl: string; audit: 'synced' | 'pending' }
  | { kind: 'error'; messageKey: string };

/**
 * Écran « Rapport médecin » (E8-S01 + E8-S02 + E8-S05, UI web).
 *
 * Flux :
 * 1. Choix plage (presets 30/90 j ou custom).
 * 2. Validation via `validateDateRange` — message d'erreur i18n immédiat.
 * 3. `generateMedicalReport` (doc Automerge local → HTML + hash SHA-256).
 * 4. Impression navigateur via `window.print()` d'une iframe détachée qui
 *    charge le HTML (génère le PDF via le moteur d'impression natif —
 *    aucune dépendance JS supplémentaire ; zero-knowledge préservé).
 * 5. Appel audit trail `POST /audit/report-generated` (best-effort).
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
        if (prev.kind === 'ready') URL.revokeObjectURL(prev.pdfBlobUrl);
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
      if (prev.kind === 'ready') URL.revokeObjectURL(prev.pdfBlobUrl);
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

      // Génère aussi un blob URL téléchargement brut (fallback téléchargement
      // HTML si le user ne veut pas passer par la boîte d'impression).
      const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
      const pdfBlobUrl = URL.createObjectURL(blob);

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

      setState({ kind: 'ready', pdfBlobUrl, audit: auditStatus });
    } catch {
      setState({ kind: 'error', messageKey: 'report.ui.generationError' });
    }
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
                {/* Tamagui `Input` ne supporte pas `type="date"` côté web — on rend
                    un input HTML natif pour bénéficier du date picker navigateur. */}
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

          <Button onPress={handleGenerate} disabled={state.kind === 'generating' || doc === null}>
            {state.kind === 'generating' ? t('report.ui.generating') : t('report.ui.generateCta')}
          </Button>

          {state.kind === 'error' ? (
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(state.messageKey)}
            </Text>
          ) : null}

          {state.kind === 'ready' ? (
            <YStack gap="$2">
              <H2>{t('report.ui.downloadCta')}</H2>
              <XStack gap="$2">
                <Button
                  tag="a"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...({ href: state.pdfBlobUrl, download: 'kinhale-report.html' } as any)}
                >
                  {t('report.ui.downloadCta')}
                </Button>
              </XStack>
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
 * Calcule la `DateRange` effective en fonction du preset choisi et des
 * champs custom. Pour les dates custom, on lit les valeurs `YYYY-MM-DD`
 * et on les interprète en UTC minuit/fin de journée (borne `endMs` =
 * 23:59:59.999 pour inclure toutes les prises du jour de fin).
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
// Pre-calcule MS_PER_DAY à l'export pour éviter un tree-shake trop agressif
// côté bundler — inutilisé localement mais référencé par d'autres consumers.
export { MS_PER_DAY };
