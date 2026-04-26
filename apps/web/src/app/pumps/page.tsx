'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PumpsList, type PumpView } from '@kinhale/ui/pumps';
import { projectPumps } from '@kinhale/sync';

import { useDocStore } from '../../stores/doc-store';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { buildFormatExpiry, buildPumpsListCopy } from '../../lib/pumps/messages';

// Mappe une `ProjectedPump` (`@kinhale/sync`) vers `PumpView`
// (présentationnel). Le seuil isLow est calé à 25 % du total pour
// matcher le comportement existant côté domain.
function toPumpView(p: ReturnType<typeof projectPumps>[number]): PumpView {
  return {
    id: p.pumpId,
    name: p.name,
    contextLabel: p.pumpType === 'maintenance' ? 'Matin & soir' : 'Au besoin',
    kind: p.pumpType === 'maintenance' ? 'maint' : 'rescue',
    doses: p.dosesRemaining,
    total: p.totalDoses,
    expiry: p.expiresAtMs !== null ? new Date(p.expiresAtMs).toISOString() : null,
    isLow: p.dosesRemaining <= Math.floor(p.totalDoses * 0.25),
  };
}

export default function PumpsListPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const doc = useDocStore((s) => s.doc);

  const pumps = React.useMemo<PumpView[]>(
    () => (doc !== null ? projectPumps(doc).map(toPumpView) : []),
    [doc],
  );

  const copy = React.useMemo(() => buildPumpsListCopy(t, pumps.length), [t, pumps.length]);
  const formatExpiry = React.useMemo(
    () => buildFormatExpiry(t, i18n.language === 'en' ? 'en-CA' : 'fr-CA'),
    [t, i18n.language],
  );

  if (!authenticated) return null;

  return (
    <PumpsList
      pumps={pumps}
      copy={copy}
      formatExpiry={formatExpiry}
      onPressAdd={(): void => router.push('/pumps/add')}
      onPressPump={(pump): void => router.push(`/pumps/${pump.id}`)}
    />
  );
}
