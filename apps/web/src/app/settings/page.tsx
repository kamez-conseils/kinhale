'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { projectChild } from '@kinhale/sync';
import {
  SettingsListMobile,
  SettingsListWeb,
  type ChildProfileSummary,
  type SettingsListMessages,
  type SettingsNavItem,
  type SettingsSection,
} from '@kinhale/ui/settings';

import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { useRequireAuth } from '../../lib/useRequireAuth';

const DESKTOP_BREAKPOINT_PX = 1024;

const APPEARANCE_THEME_DEFAULT = 'auto';
const APPEARANCE_TEXT_DEFAULT = 'm';

export default function SettingsPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const doc = useDocStore((s) => s.doc);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
      const update = (): void => setIsDesktop(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    return undefined;
  }, []);

  // États visuels (Réglages affiche les choix utilisateur ; la persistance
  // réelle est dans des sous-pages dédiées qui restent inchangées dans
  // cette PR. Le hub sert de carte de navigation + aperçu).
  const [theme, setTheme] = useState<string>(APPEARANCE_THEME_DEFAULT);
  const [textSize, setTextSize] = useState<string>(APPEARANCE_TEXT_DEFAULT);
  const [analytics, setAnalytics] = useState<boolean>(false);
  const [notifMorning, setNotifMorning] = useState<boolean>(true);
  const [notifEvening, setNotifEvening] = useState<boolean>(true);
  const [notifMissed, setNotifMissed] = useState<boolean>(true);
  const [notifLowStock, setNotifLowStock] = useState<boolean>(true);
  const [notifQuiet, setNotifQuiet] = useState<boolean>(true);

  const child = React.useMemo<ChildProfileSummary>(() => {
    const projected = doc !== null ? projectChild(doc) : null;
    if (projected === null) {
      return {
        name: t('settings.child.fallbackName'),
        initial: t('settings.child.fallbackInitial'),
        hue: 30,
        details: [],
      };
    }
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - projected.birthYear);
    const initial = projected.firstName.charAt(0).toUpperCase() || 'L';
    const details: string[] = [t('settings.child.ageYearsFormat', { count: ageYears })];
    return {
      name: projected.firstName,
      initial,
      hue: 30,
      details,
    };
  }, [doc, t]);

  const messages = React.useMemo<SettingsListMessages>(
    () => ({
      childName: t('home.dashboard.childName'),
      title: t('settings.title'),
      subtitle: t('settings.subtitle'),
      signOutCta: t('settings.signOut'),
      notMedical: t('settings.notMedical'),
      editProfileCta: t('settings.editProfile'),
    }),
    [t],
  );

  const sections = React.useMemo<SettingsSection[]>(
    () => [
      {
        key: 'notifications',
        icon: 'bell',
        title: t('settings.section.notifications'),
        rows: [
          {
            key: 'morning',
            kind: 'toggle',
            label: t('settings.notif.morning.label'),
            sub: t('settings.notif.morning.sub'),
            checked: notifMorning,
          },
          {
            key: 'evening',
            kind: 'toggle',
            label: t('settings.notif.evening.label'),
            sub: t('settings.notif.evening.sub'),
            checked: notifEvening,
          },
          {
            key: 'missed',
            kind: 'toggle',
            label: t('settings.notif.missed.label'),
            sub: t('settings.notif.missed.sub'),
            checked: notifMissed,
          },
          {
            key: 'lowStock',
            kind: 'toggle',
            label: t('settings.notif.lowStock.label'),
            sub: t('settings.notif.lowStock.sub'),
            checked: notifLowStock,
          },
          {
            key: 'quiet',
            kind: 'toggle',
            label: t('settings.notif.quiet.label'),
            sub: t('settings.notif.quiet.sub'),
            checked: notifQuiet,
          },
        ],
      },
      {
        key: 'appearance',
        icon: 'paint',
        title: t('settings.section.appearance'),
        rows: [
          {
            key: 'theme',
            kind: 'segment',
            label: t('settings.appearance.theme'),
            options: [
              { value: 'auto', label: t('settings.appearance.themeAuto') },
              { value: 'light', label: t('settings.appearance.themeLight') },
              { value: 'dark', label: t('settings.appearance.themeDark') },
            ],
            value: theme,
          },
          {
            key: 'language',
            kind: 'value',
            label: t('settings.appearance.language'),
            value: t('settings.appearance.languageValue'),
            mono: true,
          },
          {
            key: 'textSize',
            kind: 'segment',
            label: t('settings.appearance.textSize'),
            options: [
              { value: 's', label: t('settings.appearance.textSm') },
              { value: 'm', label: t('settings.appearance.textMd') },
              { value: 'l', label: t('settings.appearance.textLg') },
            ],
            value: textSize,
          },
        ],
      },
      {
        key: 'privacy',
        icon: 'shield',
        title: t('settings.section.privacy'),
        rows: [
          {
            key: 'share',
            kind: 'link',
            label: t('settings.privacy.share.label'),
            sub: t('settings.privacy.share.sub'),
          },
          {
            key: 'anonymize',
            kind: 'toggle',
            label: t('settings.privacy.anonymize.label'),
            sub: t('settings.privacy.anonymize.sub'),
            checked: analytics,
          },
          {
            key: 'export',
            kind: 'link',
            label: t('settings.privacy.export.label'),
            sub: t('settings.privacy.export.sub'),
          },
          {
            key: 'delete',
            kind: 'danger',
            label: t('settings.privacy.delete.label'),
            sub: t('settings.privacy.delete.sub'),
          },
        ],
      },
      {
        key: 'about',
        icon: 'info',
        title: t('settings.section.about'),
        rows: [
          {
            key: 'version',
            kind: 'value',
            label: t('settings.about.version'),
            value: t('settings.about.versionValue'),
            mono: true,
          },
          {
            key: 'terms',
            kind: 'link',
            label: t('settings.about.terms'),
          },
          {
            key: 'privacyPolicy',
            kind: 'link',
            label: t('settings.about.privacyPolicy'),
          },
          {
            key: 'openSource',
            kind: 'link',
            label: t('settings.about.openSource'),
            external: true,
          },
          {
            key: 'feedback',
            kind: 'link',
            label: t('settings.about.feedback'),
          },
        ],
      },
    ],
    [
      t,
      theme,
      textSize,
      analytics,
      notifMorning,
      notifEvening,
      notifMissed,
      notifLowStock,
      notifQuiet,
    ],
  );

  const navItems = React.useMemo<SettingsNavItem[]>(
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
      {
        key: 'reports',
        label: t('pumps.nav.reports'),
        onPress: () => router.push('/reports'),
      },
      { key: 'settings', label: t('pumps.nav.settings'), active: true },
    ],
    [router, t],
  );

  if (!authenticated || isDesktop === null) {
    return null;
  }

  const handleChangeToggle = (sectionKey: string, rowKey: string, checked: boolean): void => {
    if (sectionKey === 'notifications') {
      if (rowKey === 'morning') setNotifMorning(checked);
      else if (rowKey === 'evening') setNotifEvening(checked);
      else if (rowKey === 'missed') setNotifMissed(checked);
      else if (rowKey === 'lowStock') setNotifLowStock(checked);
      else if (rowKey === 'quiet') setNotifQuiet(checked);
    } else if (sectionKey === 'privacy' && rowKey === 'anonymize') {
      setAnalytics(checked);
    }
  };

  const handleChangeSegment = (sectionKey: string, rowKey: string, value: string): void => {
    if (sectionKey === 'appearance') {
      if (rowKey === 'theme') setTheme(value);
      else if (rowKey === 'textSize') setTextSize(value);
    }
  };

  const handlePressRow = (sectionKey: string, rowKey: string): void => {
    // Navigation vers les sous-pages existantes — préserve la logique
    // métier (export, suppression, partage médecin, notifications…).
    if (sectionKey === 'notifications') {
      router.push('/settings/notifications');
      return;
    }
    if (sectionKey === 'privacy') {
      if (rowKey === 'export') {
        router.push('/settings/privacy');
        return;
      }
      if (rowKey === 'delete') {
        router.push('/account/deletion-confirm');
        return;
      }
      if (rowKey === 'share') {
        router.push('/reports');
        return;
      }
    }
    if (sectionKey === 'about') {
      if (rowKey === 'openSource') {
        if (typeof window !== 'undefined') {
          window.open('https://github.com/kamez-conseils/kinhale', '_blank', 'noopener');
        }
        return;
      }
      router.push('/settings/about');
    }
  };

  const handleSignOut = (): void => {
    clearAuth();
    router.replace('/auth');
  };

  const props = {
    messages,
    child,
    sections,
    handlers: {
      onPressEditProfile: () => router.push('/onboarding/child'),
      onChangeToggle: handleChangeToggle,
      onChangeSegment: handleChangeSegment,
      onPressRow: handlePressRow,
      onPressSignOut: handleSignOut,
    },
  };

  if (isDesktop) {
    return <SettingsListWeb {...props} navItems={navItems} />;
  }
  return <SettingsListMobile {...props} />;
}
