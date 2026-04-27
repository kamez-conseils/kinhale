import type { TFunction } from 'i18next';
import type { PumpExpiryKind, PumpView, PumpsListCopy, PumpFormCopy } from '@kinhale/ui/pumps';

const SOON_THRESHOLD_DAYS = 45;

// Construit le copy pour la liste à partir d'un `t()` i18next courant.
export function buildPumpsListCopy(t: TFunction<'common'>, count: number): PumpsListCopy {
  return {
    pageTitle: t('pumps.pageTitle'),
    pageSubtitle: count === 0 ? t('pumps.pageSubtitleZero') : t('pumps.pageSubtitle', { n: count }),
    sectionMaintTitle: t('pumps.sectionMaintTitle'),
    sectionRescueTitle: t('pumps.sectionRescueTitle'),
    emptyTitle: t('pumps.emptyTitle'),
    emptyBody: t('pumps.emptyBody'),
    addCta: t('pumps.addCta'),
    primaryBadge: t('pumps.primaryBadge'),
    stockLabel: t('pumps.stockLabel'),
    refillSoonLabel: t('pumps.refillSoonLabel'),
    locationLabel: t('pumps.locationLabel'),
  };
}

export function buildPumpFormCopy(t: TFunction<'common'>): PumpFormCopy {
  return {
    drugLabel: t('pumps.drugLabel'),
    drugPlaceholder: t('pumps.drugPlaceholder'),
    typeLabel: t('pumps.typeLabel'),
    kindMaintLabel: t('pumps.kindMaintLabel'),
    kindMaintSub: t('pumps.kindMaintSub'),
    kindRescueLabel: t('pumps.kindRescueLabel'),
    kindRescueSub: t('pumps.kindRescueSub'),
    dosesTotalLabel: t('pumps.dosesTotalLabel'),
    dosesPlaceholder: t('pumps.dosesPlaceholder'),
    expiryLabel: t('pumps.expiryLabel'),
    expiryPlaceholder: t('pumps.expiryPlaceholder'),
    locationLabel: t('pumps.locationFieldLabel'),
    locationPlaceholder: t('pumps.locationFieldPlaceholder'),
  };
}

// Heuristique partagée — calcule le statut d'expiration selon la
// distance en jours entre `expiry` (ISO ou null) et aujourd'hui.
//   - null → 'normal' (la maquette tolère les pompes sans date)
//   - ≤ 0 jours → 'expired'
//   - ≤ 45 jours → 'soon'
//   - sinon → 'normal'
export function buildFormatExpiry(
  t: TFunction<'common'>,
  locale: string,
): (pump: PumpView) => { kind: PumpExpiryKind; label: string } {
  return (pump) => {
    if (pump.expiry === null) {
      return { kind: 'normal', label: t('pumps.expiryStatus.normal', { date: '—' }) };
    }
    const expiry = new Date(pump.expiry);
    if (Number.isNaN(expiry.getTime())) {
      return { kind: 'normal', label: t('pumps.expiryStatus.normal', { date: '—' }) };
    }
    const daysUntil = Math.floor((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntil <= 0) {
      return { kind: 'expired', label: t('pumps.expiryStatus.expired') };
    }
    if (daysUntil <= SOON_THRESHOLD_DAYS) {
      return { kind: 'soon', label: t('pumps.expiryStatus.soon', { n: daysUntil }) };
    }
    const dateLabel = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(expiry);
    return { kind: 'normal', label: t('pumps.expiryStatus.normal', { date: dateLabel }) };
  };
}
