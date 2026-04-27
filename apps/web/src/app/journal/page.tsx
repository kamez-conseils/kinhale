'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { projectCaregivers, projectDoses } from '@kinhale/sync';
import {
  HistoryListMobile,
  HistoryListWeb,
  type HistoryFilter,
  type HistoryNavItem,
} from '@kinhale/ui/history';

import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import {
  buildCalendarCells,
  buildFeed,
  buildHistoryListMessages,
  buildStats,
} from '../../lib/journal/messages';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function JournalPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  const [hydrated, setHydrated] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [reference, setReference] = useState<Date>(() => new Date());

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
  }, [accessToken, householdId, hydrated, initDoc, router]);

  const doses = React.useMemo(() => (doc !== null ? projectDoses(doc) : []), [doc]);
  const caregivers = React.useMemo(
    () =>
      doc !== null
        ? projectCaregivers(doc).map((c) => ({
            caregiverId: c.caregiverId,
            alias: c.displayName,
          }))
        : [],
    [doc],
  );

  const locale = i18n.language === 'en' ? 'en-CA' : 'fr-CA';
  const messages = React.useMemo(() => buildHistoryListMessages(t, reference), [t, reference]);

  const cells = React.useMemo(
    () => buildCalendarCells({ doses, currentDeviceId: deviceId, caregivers, reference, locale }),
    [doses, deviceId, caregivers, reference, locale],
  );
  const stats = React.useMemo(
    () => buildStats({ doses, currentDeviceId: deviceId, caregivers, reference, locale }),
    [doses, deviceId, caregivers, reference, locale],
  );
  const feed = React.useMemo(
    () => buildFeed(t, { doses, currentDeviceId: deviceId, caregivers, reference, locale }, filter),
    [t, doses, deviceId, caregivers, reference, locale, filter],
  );

  const navItems = React.useMemo<HistoryNavItem[]>(
    () => [
      { key: 'home', label: t('pumps.nav.home'), onPress: () => router.push('/') },
      { key: 'history', label: t('pumps.nav.history'), active: true },
      {
        key: 'pumps',
        label: t('pumps.nav.pumps'),
        onPress: () => router.push('/pumps'),
      },
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
      {
        key: 'settings',
        label: t('pumps.nav.settings'),
        onPress: () => router.push('/settings/notifications'),
      },
    ],
    [router, t],
  );

  if (!hydrated || accessToken === null || isDesktop === null) {
    return null;
  }

  const handlers = {
    onPressAdd: (): void => router.push('/journal/add'),
    onPressExport: (): void => router.push('/reports'),
    onPressEntry: (id: string): void => router.push(`/journal/edit/${id}`),
    onPressPrevMonth: (): void => {
      setReference((prev) => {
        const next = new Date(prev);
        next.setMonth(next.getMonth() - 1, 1);
        return next;
      });
    },
    onPressNextMonth: (): void => {
      setReference((prev) => {
        const next = new Date(prev);
        next.setMonth(next.getMonth() + 1, 1);
        return next;
      });
    },
    onChangeFilter: (f: HistoryFilter): void => setFilter(f),
  };

  if (isDesktop) {
    return (
      <HistoryListWeb
        messages={messages}
        cells={cells}
        stats={stats}
        feed={feed}
        activeFilter={filter}
        navItems={navItems}
        handlers={handlers}
      />
    );
  }

  return (
    <HistoryListMobile
      messages={messages}
      cells={cells}
      stats={stats}
      feed={feed}
      activeFilter={filter}
      handlers={handlers}
    />
  );
}
