import type { TFunction } from 'i18next';

import type {
  AddPumpDeviceOption,
  AddPumpMessages,
  AddPumpScheduleSlot,
  AddPumpUnit,
  PumpColorOption,
  PumpExpiryStatus,
  PumpKind,
  PumpsEmptyMessages,
  PumpsListMessages,
  PumpView,
} from '@kinhale/ui/pumps';
import type { ProjectedPump } from '@kinhale/sync';

// La palette de référence vit dans la maquette
// `docs/design/handoffs/2026-04-26-pumps-v2/project/Kinhale Ajouter pompe.html`
// (constante `AP_COLORS`). On garde les valeurs hex telles que définies
// par le design system clinical-calm — passer ces couleurs en oklch
// nécessiterait une revalidation visuelle par kz-design-review.
const COLOR_HEX: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'sky', value: '#5b8cc7' },
  { key: 'leaf', value: '#7aa05c' },
  { key: 'amber', value: '#d49a4b' },
  { key: 'coral', value: '#d97a6a' },
  { key: 'plum', value: '#9b7aa6' },
  { key: 'slate', value: '#7a8694' },
  { key: 'teal', value: '#5fa39a' },
  { key: 'sand', value: '#b89a78' },
];

const UNITS: ReadonlyArray<AddPumpUnit> = ['µg', 'mg', 'mL'];

const DEFAULT_SLOTS_KEYS: ReadonlyArray<{ key: string; defaultTime: string }> = [
  { key: 'morning', defaultTime: '07:30' },
  { key: 'afternoon', defaultTime: '12:30' },
  { key: 'evening', defaultTime: '19:30' },
  { key: 'night', defaultTime: '21:00' },
];

const DEVICE_KEYS: ReadonlyArray<string> = ['spacer', 'noSpacer', 'powder'];

const today = new Date();

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const ms = d.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

function formatExpiryDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function buildPumpsListMessages(
  t: TFunction<'common'>,
  pumpCount: number,
): PumpsListMessages {
  return {
    childName: t('home.dashboard.childName'),
    title: t('pumps.headerTitle'),
    subtitle:
      pumpCount === 0 ? t('pumps.subtitle_zero') : t('pumps.subtitle', { count: pumpCount }),
    add: t('pumps.add'),
    addShort: t('pumps.addShort'),
    sectionMaint: t('pumps.sectionMaint'),
    sectionRescue: t('pumps.sectionRescue'),
    primary: t('pumps.primary'),
    refill: t('pumps.refill'),
    stockLabel: t('pumps.stockLabel'),
    notMedical: t('disclaimer.notMedicalDevice'),
  };
}

export function buildPumpsEmptyMessages(
  t: TFunction<'common'>,
  childName: string,
): PumpsEmptyMessages {
  return {
    headerTitle: t('pumps.headerTitle'),
    headerCount: t('pumps.headerCount_format', { current: 0, total: 0 }),
    emptyHeading: t('pumps.empty.headingFormat', { name: childName }),
    subtitle: t('pumps.empty.subtitle'),
    benefit1Title: t('pumps.empty.benefit1Title'),
    benefit1Sub: t('pumps.empty.benefit1Sub'),
    benefit2Title: t('pumps.empty.benefit2Title'),
    benefit2Sub: t('pumps.empty.benefit2Sub'),
    benefit3Title: t('pumps.empty.benefit3Title'),
    benefit3Sub: t('pumps.empty.benefit3Sub'),
    scanCta: t('pumps.empty.scanCta'),
    manualCta: t('pumps.empty.manualCta'),
    tipLabel: t('pumps.empty.tipLabel'),
    helpText: t('pumps.empty.helpText'),
    notMedical: t('disclaimer.notMedicalDevice'),
  };
}

export function buildPumpExpiryFormatter(
  t: TFunction<'common'>,
  lang: string,
): (pump: PumpView) => PumpExpiryStatus {
  return (pump) => {
    if (pump.expiry === null) {
      return { kind: 'normal', label: t('pumps.expiryUnknown') };
    }
    const dLeft = daysUntil(pump.expiry);
    if (dLeft <= 0) {
      return { kind: 'expired', label: t('pumps.expired') };
    }
    if (dLeft <= 45) {
      return {
        kind: 'soon',
        label: t('pumps.expiresIn', { count: dLeft }),
      };
    }
    return {
      kind: 'normal',
      label: t('pumps.expires', { date: formatExpiryDate(pump.expiry, lang) }),
    };
  };
}

/**
 * Convertit une `ProjectedPump` (`@kinhale/sync`) vers `PumpView` (forme
 * présentationnelle). Le seuil `isLow` est calé à 25 % du total — calé
 * sur le comportement de la couche domaine, à harmoniser avec
 * `packages/domain` dans une PR ultérieure.
 *
 * Le contexte (« Matin & soir » / « Au besoin ») et le lieu sont
 * provisoirement déduits ou laissés vides : ces métadonnées arriveront
 * via le wizard d'ajout étendu (champ `location` à persister) et la
 * projection des plans (créneaux par pompe).
 */
export function projectedPumpToView(p: ProjectedPump, t: TFunction<'common'>): PumpView {
  const kind: PumpKind = p.pumpType === 'maintenance' ? 'maint' : 'rescue';
  const contextLabel =
    kind === 'maint' ? t('pumps.context.morningEvening') : t('pumps.context.asNeeded');
  const expiry = p.expiresAtMs !== null ? new Date(p.expiresAtMs).toISOString() : null;
  const isLow = p.dosesRemaining <= Math.floor(p.totalDoses * 0.25);
  return {
    id: p.pumpId,
    name: p.name,
    contextLabel,
    kind,
    doses: p.dosesRemaining,
    total: p.totalDoses,
    location: '',
    expiry,
    isLow,
  };
}

export function buildAddPumpMessages(t: TFunction<'common'>): AddPumpMessages {
  const colors: ReadonlyArray<PumpColorOption> = COLOR_HEX.map((c) => ({
    key: c.key,
    value: c.value,
    label: t(`pumps.add_flow.color.${c.key}`),
  }));

  const devices: ReadonlyArray<AddPumpDeviceOption> = DEVICE_KEYS.map((k) => ({
    key: k,
    label: t(`pumps.add_flow.step2.device.${k}`),
  }));

  return {
    modalTitle: t('pumps.add_flow.modalTitle'),
    stepShort: [
      t('pumps.add_flow.stepShort.identify'),
      t('pumps.add_flow.stepShort.dosage'),
      t('pumps.add_flow.stepShort.schedule'),
      t('pumps.add_flow.stepShort.ready'),
    ],
    step1: {
      short: t('pumps.add_flow.stepShort.identify'),
      heading: t('pumps.add_flow.step1.heading'),
      subtitle: t('pumps.add_flow.step1.subtitle'),
      scanCta: t('pumps.add_flow.step1.scanCta'),
      scanSub: t('pumps.add_flow.step1.scanSub'),
      orSeparator: t('pumps.add_flow.step1.orSeparator'),
      nameLabel: t('pumps.add_flow.step1.nameLabel'),
      namePlaceholder: t('pumps.add_flow.step1.namePlaceholder'),
      nameHelp: t('pumps.add_flow.step1.nameHelp'),
      substanceLabel: t('pumps.add_flow.step1.substanceLabel'),
      substancePlaceholder: t('pumps.add_flow.step1.substancePlaceholder'),
      doseLabel: t('pumps.add_flow.step1.doseLabel'),
      dosePlaceholder: t('pumps.add_flow.step1.dosePlaceholder'),
      unitLabel: t('pumps.add_flow.step1.unitLabel'),
      units: UNITS,
      colorLabel: t('pumps.add_flow.step1.colorLabel'),
      colorSub: t('pumps.add_flow.step1.colorSub'),
      colors,
    },
    step2: {
      short: t('pumps.add_flow.stepShort.dosage'),
      heading: t('pumps.add_flow.step2.heading'),
      subtitle: t('pumps.add_flow.step2.subtitle'),
      typeLabel: t('pumps.add_flow.step2.typeLabel'),
      typeMaintName: t('pumps.add_flow.step2.typeMaintName'),
      typeMaintSub: t('pumps.add_flow.step2.typeMaintSub'),
      typeRescueName: t('pumps.add_flow.step2.typeRescueName'),
      typeRescueSub: t('pumps.add_flow.step2.typeRescueSub'),
      puffsLabel: t('pumps.add_flow.step2.puffsLabel'),
      puffsSingular: t('pumps.add_flow.step2.puffsSingular'),
      puffsPlural: t('pumps.add_flow.step2.puffsPlural'),
      deviceLabel: t('pumps.add_flow.step2.deviceLabel'),
      devices,
      prescriberLabel: t('pumps.add_flow.step2.prescriberLabel'),
      prescriberPlaceholder: t('pumps.add_flow.step2.prescriberPlaceholder'),
      pharmacyLabel: t('pumps.add_flow.step2.pharmacyLabel'),
      pharmacyPlaceholder: t('pumps.add_flow.step2.pharmacyPlaceholder'),
    },
    step3: {
      short: t('pumps.add_flow.stepShort.schedule'),
      heading: t('pumps.add_flow.step3.heading'),
      subtitle: t('pumps.add_flow.step3.subtitle'),
      defaultSlots: buildDefaultSchedule(t),
      reminderLabel: t('pumps.add_flow.step3.reminderLabel'),
      reminderSub: t('pumps.add_flow.step3.reminderSub'),
      escalationLabel: t('pumps.add_flow.step3.escalationLabel'),
      escalationSub: t('pumps.add_flow.step3.escalationSub'),
    },
    step4: {
      short: t('pumps.add_flow.stepShort.ready'),
      heading: t('pumps.add_flow.step4.heading'),
      subtitle: t('pumps.add_flow.step4.subtitle'),
      summaryLabel: t('pumps.add_flow.step4.summaryLabel'),
      fieldPump: t('pumps.add_flow.step4.fieldPump'),
      fieldSubstance: t('pumps.add_flow.step4.fieldSubstance'),
      fieldType: t('pumps.add_flow.step4.fieldType'),
      fieldDose: t('pumps.add_flow.step4.fieldDose'),
      fieldSchedule: t('pumps.add_flow.step4.fieldSchedule'),
      firstDoseCta: t('pumps.add_flow.step4.firstDoseCta'),
      doneCta: t('pumps.add_flow.step4.doneCta'),
      notSet: t('pumps.add_flow.step4.notSet'),
    },
    cancel: t('pumps.add_flow.cancel'),
    back: t('pumps.add_flow.back'),
    next: t('pumps.add_flow.next'),
    save: t('pumps.add_flow.save'),
    previewLabel: t('pumps.add_flow.previewLabel'),
    previewHint: t('pumps.add_flow.previewHint'),
    previewKindMaint: t('pumps.add_flow.previewKindMaint'),
    previewKindRescue: t('pumps.add_flow.previewKindRescue'),
    previewDoseLabel: t('pumps.add_flow.previewDoseLabel'),
    previewPuffSingular: t('pumps.add_flow.previewPuffSingular'),
    previewPuffPlural: t('pumps.add_flow.previewPuffPlural'),
    notMedical: t('disclaimer.notMedicalDevice'),
  };
}

export function buildDefaultSchedule(t: TFunction<'common'>): ReadonlyArray<AddPumpScheduleSlot> {
  return DEFAULT_SLOTS_KEYS.map((s) => ({
    key: s.key,
    label: t(`pumps.add_flow.step3.slot.${s.key}`),
    time: s.defaultTime,
    on: false,
  }));
}
