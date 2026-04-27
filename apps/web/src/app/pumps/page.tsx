'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { projectPumps } from '@kinhale/sync';
import {
  PumpsEmptyMobile,
  PumpsEmptyWeb,
  PumpsListMobile,
  PumpsListWeb,
  type PumpsNavItem,
  type PumpView,
} from '@kinhale/ui/pumps';

import { useDocStore } from '../../stores/doc-store';
import { useRequireAuth } from '../../lib/useRequireAuth';
import {
  buildPumpExpiryFormatter,
  buildPumpsEmptyMessages,
  buildPumpsListMessages,
  projectedPumpToView,
} from '../../lib/pumps/messages';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function PumpsListPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const doc = useDocStore((s) => s.doc);

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

  const pumps = React.useMemo<PumpView[]>(
    () => (doc !== null ? projectPumps(doc).map((p) => projectedPumpToView(p, t)) : []),
    [doc, t],
  );

  const pumpCount = pumps.length;
  const messages = React.useMemo(() => buildPumpsListMessages(t, pumpCount), [t, pumpCount]);
  const childName = t('home.dashboard.childName');
  const emptyMessages = React.useMemo(() => buildPumpsEmptyMessages(t, childName), [t, childName]);
  const formatExpiry = React.useMemo(
    () => buildPumpExpiryFormatter(t, i18n.language ?? 'fr'),
    [t, i18n.language],
  );
  const addCardHint = t('pumps.addCardHint');

  const navItems = React.useMemo<PumpsNavItem[]>(
    () => [
      { key: 'home', label: t('pumps.nav.home'), onPress: () => router.push('/') },
      {
        key: 'history',
        label: t('pumps.nav.history'),
        onPress: () => router.push('/journal'),
      },
      { key: 'pumps', label: t('pumps.nav.pumps'), active: true },
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
        onPress: () => router.push('/settings'),
      },
    ],
    [router, t],
  );

  if (!authenticated || isDesktop === null) {
    return null;
  }

  const handlers = {
    onPressAdd: (): void => router.push('/pumps/add'),
    onPressPump: (id: string): void => router.push(`/pumps/${id}`),
    onPressScan: (): void => router.push('/pumps/add?scan=1'),
    onPressManual: (): void => router.push('/pumps/add'),
  };

  if (pumpCount === 0) {
    if (isDesktop) {
      return (
        <PumpsEmptyWeb
          messages={emptyMessages}
          eyebrow={childName}
          navItems={navItems}
          handlers={{
            onPressScan: handlers.onPressScan,
            onPressManual: handlers.onPressManual,
          }}
        />
      );
    }
    return (
      <PumpsEmptyMobile
        messages={emptyMessages}
        handlers={{
          onPressScan: handlers.onPressScan,
          onPressManual: handlers.onPressManual,
        }}
      />
    );
  }

  if (isDesktop) {
    return (
      <PumpsListWeb
        messages={messages}
        pumps={pumps}
        formatExpiry={formatExpiry}
        navItems={navItems}
        addCardHint={addCardHint}
        handlers={{ onPressAdd: handlers.onPressAdd, onPressPump: handlers.onPressPump }}
      />
    );
  }

  return (
    <PumpsListMobile
      messages={messages}
      pumps={pumps}
      formatExpiry={formatExpiry}
      addCardHint={addCardHint}
      handlers={{ onPressAdd: handlers.onPressAdd, onPressPump: handlers.onPressPump }}
    />
  );
}
