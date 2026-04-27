'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { HomeDashboard, HomeWebDashboard, type HomeNavItem } from '@kinhale/ui/home';
import { useAuthStore } from '../stores/auth-store';
import { buildHomeMessages } from '../lib/home/messages';
import { mockHomeData } from '../lib/home/mock-data';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function HomePage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Le store zustand est persisté en localStorage. Au premier rendu côté
  // client, `accessToken` vaut `null` AVANT l'hydratation, puis prend la
  // vraie valeur. On attend donc le pump d'hydratation avant de décider
  // d'un redirect — sans ça, un utilisateur déjà connecté est renvoyé
  // sur /auth à chaque rechargement.
  const [hydrated, setHydrated] = useState(false);
  // `isDesktop` ne se calcule que côté client : matchMedia n'existe pas
  // pendant le SSR. On rend null le temps de l'hydratation pour éviter un
  // flash mobile→desktop sur les écrans larges.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

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
    if (hydrated && accessToken === null) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, router]);

  const messages = React.useMemo(() => buildHomeMessages(t), [t]);

  // Sidebar nav (desktop) localisée — clés `home.dashboard.nav.*` côté
  // i18n FR + EN. La règle non-négociable Kinhale impose i18n dès le
  // commit #1 — pas de fallback hardcodé côté composant partagé.
  const navItems = React.useMemo<HomeNavItem[]>(
    () => [
      { key: 'home', label: t('home.dashboard.nav.home'), active: true },
      {
        key: 'history',
        label: t('home.dashboard.nav.history'),
        onPress: () => router.push('/journal'),
      },
      {
        key: 'pumps',
        label: t('home.dashboard.nav.pumps'),
        onPress: () => router.push('/pumps'),
      },
      {
        key: 'caregivers',
        label: t('home.dashboard.nav.caregivers'),
        onPress: () => router.push('/caregivers'),
      },
      {
        key: 'reports',
        label: t('home.dashboard.nav.reports'),
        onPress: () => router.push('/reports'),
      },
      {
        key: 'onboarding',
        label: t('home.dashboard.nav.onboarding'),
        onPress: () => router.push('/onboarding/child'),
      },
      {
        key: 'settings',
        label: t('home.dashboard.nav.settings'),
        onPress: () => router.push('/settings'),
      },
    ],
    [router, t],
  );

  if (!hydrated || accessToken === null || isDesktop === null) {
    return null;
  }

  const handlers = {
    onPressMaint: (): void => router.push('/journal/add?kind=maint'),
    onPressRescue: (): void => router.push('/journal/add?kind=rescue'),
    onPressHistory: (): void => router.push('/journal'),
  };

  if (isDesktop) {
    return (
      <HomeWebDashboard
        messages={messages}
        data={mockHomeData}
        handlers={handlers}
        navItems={navItems}
      />
    );
  }

  return <HomeDashboard messages={messages} data={mockHomeData} handlers={handlers} />;
}
