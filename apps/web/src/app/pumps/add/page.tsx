'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { AddPumpFlow, type AddPumpFormState, type AddPumpStepIndex } from '@kinhale/ui/pumps';

import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';
import { buildAddPumpMessages, buildDefaultSchedule } from '../../../lib/pumps/messages';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function AddPumpPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPump = useDocStore((s) => s.appendPump);

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

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

  const messages = React.useMemo(() => buildAddPumpMessages(t), [t]);
  const initialSchedule = React.useMemo(() => buildDefaultSchedule(t), [t]);

  const [step, setStep] = useState<AddPumpStepIndex>(0);
  const [state, setState] = useState<AddPumpFormState>({
    name: '',
    substance: '',
    dose: '',
    unit: 'µg',
    colorKey: null,
    kind: null,
    puffsPerDose: 1,
    deviceKey: null,
    prescriber: '',
    pharmacy: '',
    schedule: initialSchedule,
    escalation: false,
  });

  // Si la langue change après l'init, on rafraîchit les libellés des
  // créneaux du `schedule` sans toucher aux toggles `on` ni aux heures.
  useEffect(() => {
    setState((s) => {
      const merged = initialSchedule.map((slot) => {
        const existing = s.schedule.find((p) => p.key === slot.key);
        if (!existing) return slot;
        return { ...existing, label: slot.label };
      });
      return { ...s, schedule: merged };
    });
  }, [initialSchedule]);

  const handleChange = (patch: Partial<AddPumpFormState>): void => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  if (!authenticated || isDesktop === null) {
    return null;
  }

  const handleCancel = (): void => router.push('/pumps');

  const handleSubmit = async (s: AddPumpFormState): Promise<void> => {
    if (!online) {
      setPersistError(t('offlineGuard.message'));
      return;
    }
    const trimmedName = s.name.trim();
    if (trimmedName.length === 0) {
      setPersistError(t('pumps.errors.nameRequired'));
      return;
    }
    if (s.kind === null) {
      setPersistError(t('pumps.errors.kindRequired'));
      return;
    }
    setPersistError(null);
    try {
      const kp = await getOrCreateDevice();
      // `totalDoses` n'est pas demandé par le wizard v2 (les bouffées
      // par prise et la cadence ne suffisent pas à le calculer
      // automatiquement). On utilise une valeur par défaut conservative
      // (200 doses, courante pour un Salbutamol/Fluticasone) — le champ
      // sera ajouté à un prochain wizard étendu.
      await appendPump(
        {
          pumpId: crypto.randomUUID(),
          name: trimmedName,
          pumpType: s.kind === 'maint' ? 'maintenance' : 'rescue',
          totalDoses: 200,
          expiresAtMs: null,
        },
        deviceId,
        kp.secretKey,
      );
    } catch {
      setPersistError(t('pumps.errors.saveFailed'));
    }
  };

  const handleLogFirstDose = (): void => {
    router.push(state.kind === 'rescue' ? '/journal/add?kind=rescue' : '/journal/add?kind=maint');
  };

  return (
    <>
      <AddPumpFlow
        messages={messages}
        state={state}
        onChange={handleChange}
        step={step}
        onStepChange={setStep}
        mode={isDesktop ? 'web' : 'mobile'}
        handlers={{
          onCancel: handleCancel,
          onSubmit: (s) => {
            void handleSubmit(s);
          },
          onLogFirstDose: handleLogFirstDose,
        }}
      />
      {persistError !== null && (
        <div
          role="status"
          data-testid="pump-add-error"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--amberSoft)',
            color: 'var(--amberInk)',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            zIndex: 100,
          }}
        >
          {persistError}
        </div>
      )}
    </>
  );
}
