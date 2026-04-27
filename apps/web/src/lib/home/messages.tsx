import * as React from 'react';
import type { TFunction } from 'i18next';
import { Text, YStack } from 'tamagui';

import type { HomeDashboardMessages, InhalerView, ScheduleSlotState } from '@kinhale/ui/home';

interface BuildOptions {
  /** Prénom réel de l'enfant projeté ; fallback i18n si onboarding incomplet. */
  readonly childName?: string | null;
  /** Locale BCP-47, ex. `'fr-CA'` ou `'en-CA'`. */
  readonly locale: string;
  /** Horloge injectée pour test pur. */
  readonly now: Date;
}

// Construit l'objet `HomeDashboardMessages` attendu par les composants
// partagés à partir d'un `t()` i18next courant. Centralise le mapping pour
// ne pas dupliquer entre la version web et la future variante mobile.
export function buildHomeMessages(
  t: TFunction<'common'>,
  options: BuildOptions,
): HomeDashboardMessages {
  const stateLabels: Record<ScheduleSlotState, string> = {
    done: t('home.dashboard.scheduleStateLabels.done'),
    pending: t('home.dashboard.scheduleStateLabels.pending'),
    overdue: t('home.dashboard.scheduleStateLabels.overdue'),
    missed: t('home.dashboard.scheduleStateLabels.missed'),
  };

  const childName =
    options.childName !== null && options.childName !== undefined && options.childName.length > 0
      ? options.childName
      : t('home.dashboard.childName');

  return {
    childName,
    dateLabel: new Intl.DateTimeFormat(options.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(options.now),
    roleLabel: t('home.dashboard.roleLabel'),

    status: {
      onTrackTitle: t('home.dashboard.status.onTrackTitle'),
      onTrackSub: t('home.dashboard.status.onTrackSub'),
      dueTitle: t('home.dashboard.status.dueTitle'),
      dueSub: t('home.dashboard.status.dueSub'),
      overdueTitle: t('home.dashboard.status.overdueTitle'),
      overdueSub: t('home.dashboard.status.overdueSub'),
    },

    scheduleTitle: t('home.dashboard.scheduleTitle'),
    scheduleStateLabels: stateLabels,

    inventoryTitle: t('home.dashboard.inventoryTitle'),
    refillSoonLabel: t('home.dashboard.refillSoonLabel'),
    formatDosesLeft: (n: number): string => t('home.dashboard.dosesLeft', { n }),
    formatExpiryStatus: buildExpiryFormatter(t, options.locale, options.now),
    inventoryEmpty: buildEmptySection(t('home.dashboard.inventory.empty')),

    activityTitle: t('home.dashboard.activityTitle'),
    historyLabel: t('home.dashboard.historyLabel'),
    formatBy: (name: string): string => t('home.dashboard.by', { name }),
    activityEmpty: buildEmptySection(t('home.dashboard.activity.empty')),

    caregiversTitle: t('home.dashboard.caregiversTitle'),
    syncPendingLabel: t('home.dashboard.syncPendingLabel'),

    quickActionCaption: t('home.dashboard.quickActionCaption'),
    quickMaintLabel: t('home.dashboard.quickMaint'),
    quickRescueLabel: t('home.dashboard.quickRescue'),

    notMedicalDevice: t('home.dashboard.notMedicalDevice'),
  };
}

/**
 * Calcule l'état d'expiration affiché pour une pompe.
 *
 * - `expiry === ''` (chaîne vide) → date inconnue, retourne label neutre
 *   « Date d'expiration inconnue » (pas un signal d'urgence).
 * - `daysUntil < 0` → expirée (rouge).
 * - `daysUntil < 45` → bientôt (ambre).
 * - sinon → normal (gris discret).
 *
 * `now` est injecté pour permettre des tests purs et déterministes —
 * `messages.ts` ne doit jamais lire `Date.now()` implicitement, sinon les
 * tests deviennent fragiles selon l'heure d'exécution CI.
 */
function buildExpiryFormatter(
  t: TFunction<'common'>,
  locale: string,
  now: Date,
): (inh: InhalerView) => { kind: 'normal' | 'soon' | 'expired'; label: string } {
  return (inh) => {
    if (inh.expiry === '') {
      return { kind: 'normal', label: t('home.dashboard.expiry.unknown') };
    }
    const expiryDate = new Date(inh.expiry);
    const ms = expiryDate.getTime();
    if (!Number.isFinite(ms)) {
      // Chaîne ISO mal formée — on ne tente pas d'inférer, on retombe sur
      // « inconnue » plutôt que d'afficher « Invalid Date » à l'utilisateur.
      return { kind: 'normal', label: t('home.dashboard.expiry.unknown') };
    }
    const daysUntil = Math.floor((ms - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0) {
      return { kind: 'expired', label: t('home.dashboard.expiry.expired') };
    }
    const dateLabel = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(expiryDate);
    if (daysUntil < 45) {
      return { kind: 'soon', label: t('home.dashboard.expiry.soon', { date: dateLabel }) };
    }
    return { kind: 'normal', label: t('home.dashboard.expiry.normal', { date: dateLabel }) };
  };
}

/**
 * Petit bloc « rien à afficher » utilisé par les sections Inventory et
 * Activity. Volontairement minimaliste : pas d'illustration, pas de CTA —
 * l'état d'accueil produit complet est rendu en amont par
 * `HomeEmptyState`. Cette variante intra-section sert juste à éviter
 * que le composant `Section` ait l'air cassé sans contenu.
 */
function buildEmptySection(label: string): React.ReactNode {
  return (
    <YStack paddingVertical="$3" alignItems="center">
      <Text fontSize={12} color="$colorMuted" textAlign="center">
        {label}
      </Text>
    </YStack>
  );
}
