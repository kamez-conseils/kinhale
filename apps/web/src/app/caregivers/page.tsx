'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { projectCaregivers } from '@kinhale/sync';
import { fromHex, sealedBoxEncrypt, toHex } from '@kinhale/crypto';
import {
  CaregiversListMobile,
  CaregiversListWeb,
  type CaregiverProfileView,
  type CaregiversNavItem,
  type InviteFormState,
  type PendingInvitationView,
} from '@kinhale/ui/caregivers';

import { useDocStore } from '../../stores/doc-store';
import { useAuthStore } from '../../stores/auth-store';
import {
  listInvitations,
  revokeInvitation,
  sealInvitation,
  type InvitationSummary,
} from '../../lib/invitations/client';
import { getGroupKey } from '../../lib/device';
import { useRequireAuth } from '../../lib/useRequireAuth';
import {
  buildCaregiversListMessages,
  buildInviteFormMessages,
  buildPendingPrimaryCta,
  buildStageLabel,
  invitationToPendingView,
  projectedCaregiverToView,
} from '../../lib/caregivers/messages';

const DESKTOP_BREAKPOINT_PX = 1024;

export default function CaregiversPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const doc = useDocStore((s) => s.doc);

  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sealingToken, setSealingToken] = useState<string | null>(null);

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

  const refresh = React.useCallback(async () => {
    if (accessToken === null || accessToken === '') return;
    try {
      setInvitations(await listInvitations());
      setError(null);
    } catch {
      setError(t('invitation.errorLoadList'));
    }
  }, [accessToken, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRevoke = async (token: string): Promise<void> => {
    try {
      await revokeInvitation(token);
      await refresh();
    } catch {
      setError(t('invitation.errorLoadList'));
    }
  };

  // Logique X25519 sealing — INCHANGÉE depuis l'implémentation v1
  // (KIN-096). Critique sécurité — toute modification doit passer par
  // kz-securite + tests vectors. La couche présentationnelle a changé,
  // pas la cryptographie.
  const handleSeal = async (token: string): Promise<void> => {
    const inv = invitations.find((i) => i.token === token);
    if (inv === undefined) return;
    if (sealingToken !== null) return;
    if (typeof householdId !== 'string' || householdId.length === 0) {
      setError(t('invitation.errorSealMissingGroupKey'));
      return;
    }
    setSealingToken(inv.token);
    setError(null);
    try {
      const groupKey = await getGroupKey(householdId);
      if (
        inv.hasRecipientPublicKey !== true ||
        typeof inv.recipientPublicKeyHex !== 'string' ||
        inv.recipientPublicKeyHex.length !== 64
      ) {
        setError(t('invitation.errorSealNoPubkey'));
        return;
      }
      const recipientPublicKey = fromHex(inv.recipientPublicKeyHex);
      const sealed = await sealedBoxEncrypt(groupKey, recipientPublicKey);
      await sealInvitation(inv.token, toHex(sealed));
      await refresh();
    } catch {
      setError(t('invitation.errorSealFailed'));
    } finally {
      setSealingToken(null);
    }
  };

  // Mapping vers les types présentationnels.
  const caregivers = React.useMemo<CaregiverProfileView[]>(() => {
    const projected = doc !== null ? projectCaregivers(doc) : [];
    return projected.map((c) =>
      projectedCaregiverToView(c, { currentDeviceId: deviceId, locale: 'fr-CA' }),
    );
  }, [doc, deviceId]);

  const locale = i18n.language === 'en' ? 'en-CA' : 'fr-CA';
  const pending = React.useMemo<PendingInvitationView[]>(
    () =>
      invitations.map((inv) => invitationToPendingView(inv, { currentDeviceId: deviceId, locale })),
    [invitations, deviceId, locale],
  );

  const totalCount = caregivers.length + pending.length;
  const messages = React.useMemo(() => buildCaregiversListMessages(t, totalCount), [t, totalCount]);
  const inviteMessages = React.useMemo(() => buildInviteFormMessages(t), [t]);
  const primaryCta = React.useMemo(() => buildPendingPrimaryCta(t), [t]);

  const stageLabels = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of pending) {
      map[p.stage] = buildStageLabel(t, p.stage, p.sentLabel);
    }
    return map;
  }, [t, pending]);

  // Form d'invitation (desktop uniquement — sur mobile on route vers
  // /caregivers/invite qui contient le QR code complet).
  const [inviteState, setInviteState] = useState<InviteFormState>({
    name: '',
    email: '',
    role: 'contributor',
  });
  const handleInviteChange = (patch: Partial<InviteFormState>): void => {
    setInviteState((s) => ({ ...s, ...patch }));
  };

  const navItems = React.useMemo<CaregiversNavItem[]>(
    () => [
      { key: 'home', label: t('pumps.nav.home'), onPress: () => router.push('/') },
      {
        key: 'history',
        label: t('pumps.nav.history'),
        onPress: () => router.push('/journal'),
      },
      { key: 'pumps', label: t('pumps.nav.pumps'), onPress: () => router.push('/pumps') },
      { key: 'caregivers', label: t('pumps.nav.caregivers'), active: true },
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
    onPressInvite: (): void => router.push('/caregivers/invite'),
    onPressResend: (token: string): void => router.push(`/caregivers/invite?resend=${token}`),
    onPressWithdraw: (token: string): void => {
      void handleRevoke(token);
    },
    onPressSeal: (token: string): void => {
      void handleSeal(token);
    },
  };

  // L'envoi du form sur la colonne droite (desktop) renvoie vers
  // /caregivers/invite qui gère le QR code + flux complet — l'utilisateur
  // peut pré-remplir ici puis confirmer là-bas.
  const inviteHandlers = {
    onCancel: () => {
      setInviteState({ name: '', email: '', role: 'contributor' });
    },
    onSubmit: () => {
      router.push(
        `/caregivers/invite?name=${encodeURIComponent(inviteState.name)}&role=${
          inviteState.role === 'restricted' ? 'restricted_contributor' : 'contributor'
        }`,
      );
    },
  };

  if (isDesktop) {
    return (
      <>
        <CaregiversListWeb
          messages={messages}
          inviteMessages={inviteMessages}
          caregivers={caregivers}
          pending={pending}
          pendingStageLabels={stageLabels}
          pendingPrimaryCta={primaryCta}
          navItems={navItems}
          inviteState={inviteState}
          onInviteChange={handleInviteChange}
          inviteSubmitDisabled={
            inviteState.name.trim().length === 0 || inviteState.email.trim().length === 0
          }
          inviteHandlers={inviteHandlers}
          handlers={handlers}
        />
        {error !== null && (
          <div
            role="status"
            data-testid="caregivers-error"
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--rescueSoft)',
              color: 'var(--rescueInk)',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              zIndex: 100,
            }}
          >
            {error}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <CaregiversListMobile
        messages={messages}
        caregivers={caregivers}
        pending={pending}
        pendingStageLabels={stageLabels}
        pendingPrimaryCta={primaryCta}
        handlers={handlers}
      />
      {error !== null && (
        <div
          role="status"
          data-testid="caregivers-error"
          style={{
            position: 'fixed',
            bottom: 80,
            left: 16,
            right: 16,
            background: 'var(--rescueSoft)',
            color: 'var(--rescueInk)',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            zIndex: 100,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
