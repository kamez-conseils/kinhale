import type { TFunction } from 'i18next';
import type { HomeDashboardMessages, InhalerView, ScheduleSlotState } from '@kinhale/ui/home';

// Construit l'objet `HomeDashboardMessages` attendu par les composants
// partagés à partir d'un `t()` i18next courant. Centralise le mapping pour
// ne pas dupliquer entre la version web et la future variante mobile.
export function buildHomeMessages(t: TFunction<'common'>): HomeDashboardMessages {
  const stateLabels: Record<ScheduleSlotState, string> = {
    done: t('home.dashboard.scheduleStateLabels.done'),
    pending: t('home.dashboard.scheduleStateLabels.pending'),
    overdue: t('home.dashboard.scheduleStateLabels.overdue'),
    missed: t('home.dashboard.scheduleStateLabels.missed'),
  };

  return {
    childName: t('home.dashboard.childName'),
    dateLabel: new Intl.DateTimeFormat('fr-CA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date()),
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
    formatExpiryStatus: (
      inh: InhalerView,
    ): { kind: 'normal' | 'soon' | 'expired'; label: string } => {
      // Heuristique simple : maquette uniquement, pas de données réelles ici.
      // Le wiring vers @kinhale/sync (date d'expiration projetée) viendra dans
      // une PR ultérieure quand on remplacera les données mockées.
      const expiryDate = new Date(inh.expiry);
      const now = new Date();
      const daysUntil = Math.floor((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysUntil < 0) {
        return { kind: 'expired', label: t('home.dashboard.expiry.expired') };
      }
      const dateLabel = new Intl.DateTimeFormat('fr-CA', {
        day: 'numeric',
        month: 'short',
      }).format(expiryDate);
      if (daysUntil < 45) {
        return { kind: 'soon', label: t('home.dashboard.expiry.soon', { date: dateLabel }) };
      }
      return { kind: 'normal', label: t('home.dashboard.expiry.normal', { date: dateLabel }) };
    },

    activityTitle: t('home.dashboard.activityTitle'),
    historyLabel: t('home.dashboard.historyLabel'),
    formatBy: (name: string): string => t('home.dashboard.by', { name }),

    caregiversTitle: t('home.dashboard.caregiversTitle'),
    syncPendingLabel: t('home.dashboard.syncPendingLabel'),

    quickActionCaption: t('home.dashboard.quickActionCaption'),
    quickMaintLabel: t('home.dashboard.quickMaint'),
    quickRescueLabel: t('home.dashboard.quickRescue'),

    notMedicalDevice: t('home.dashboard.notMedicalDevice'),
  };
}
