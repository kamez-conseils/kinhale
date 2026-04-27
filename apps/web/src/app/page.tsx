'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { HomeDashboard, HomeWebDashboard, type HomeNavItem } from '@kinhale/ui/home';
import { useAuthStore } from '../stores/auth-store';
import { useDocStore } from '../stores/doc-store';
import { buildHomeMessages } from '../lib/home/messages';
import { buildHomeDashboardData } from '../lib/home/build-data';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function HomePage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  const [hydrated, setHydrated] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  // `docInitialized` est true seulement après que `initDoc` a résolu —
  // permet de distinguer « doc en cours de chargement IDB » (pas de
  // dashboard, pas de redirect) de « foyer vraiment vide, onboarding
  // requis » (redirect vers /onboarding/child).
  const [docInitialized, setDocInitialized] = useState(false);

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
    if (householdId !== null && !docInitialized) {
      void initDoc(householdId).finally(() => setDocInitialized(true));
    }
  }, [accessToken, householdId, hydrated, initDoc, router, docInitialized]);

  useEffect(() => {
    if (accessToken === null) return undefined;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [accessToken]);

  const locale = i18n.language === 'en' ? 'en-CA' : 'fr-CA';

  const built = React.useMemo(
    () => buildHomeDashboardData({ doc, deviceId, now, t, locale }),
    [doc, deviceId, now, t, locale],
  );

  const messages = React.useMemo(
    () => buildHomeMessages(t, { childName: built.childName, locale, now }),
    [t, built.childName, locale, now],
  );

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

  // Redirige vers l'onboarding une fois `initDoc` terminé si le foyer
  // n'a aucune entité (cas typique : utilisateur fraîchement inscrit).
  // On ne fait PAS la redirection tant que `docInitialized` est faux —
  // sinon on flasherait un état "vide" alors que le doc IDB est encore
  // en cours de déchiffrement.
  useEffect(() => {
    if (!hydrated || accessToken === null) return;
    if (!docInitialized) return;
    if (built.isEmptyHousehold) {
      router.replace('/onboarding/child');
    }
  }, [hydrated, accessToken, docInitialized, built.isEmptyHousehold, router]);

  if (!hydrated || accessToken === null || isDesktop === null) {
    return null;
  }
  // Doc en cours de chargement IDB — on ne rend rien plutôt qu'un
  // dashboard vide qui pourrait suggérer "aucune donnée" alors qu'elles
  // arrivent. Le redirect onboarding ci-dessus se déclenchera après
  // `docInitialized` si le foyer est réellement vide.
  if (!docInitialized || built.isEmptyHousehold) {
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
        data={built.data}
        handlers={handlers}
        navItems={navItems}
      />
    );
  }

  return <HomeDashboard messages={messages} data={built.data} handlers={handlers} />;
}
