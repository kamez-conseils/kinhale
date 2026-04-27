'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

import { Theme } from 'tamagui';
import { InviteForm, type InviteFormState } from '@kinhale/ui/caregivers';
import type { CaregiverRole as PresentationCaregiverRole } from '@kinhale/ui/home';

import { createInvitation, type CreatedInvitation } from '../../../lib/invitations/client';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';
import { buildInviteFormMessages, inviteRoleToInternal } from '../../../lib/caregivers/messages';

export default function InviteCaregiverPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();

  const [state, setState] = useState<InviteFormState>({
    name: '',
    email: '',
    role: 'contributor',
  });
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  // Pré-remplissage depuis les query params (lien depuis /caregivers).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const role = params.get('role');
    setState((s) => ({
      ...s,
      ...(name !== null && name !== '' ? { name } : {}),
      ...(role === 'restricted_contributor' ? { role: 'restricted' as const } : {}),
    }));
  }, []);

  useEffect(() => {
    if (created === null) return undefined;
    const payload = `${window.location.origin}/accept-invitation/${created.token}?pin=${created.pin}`;
    void QRCode.toDataURL(payload).then((url) => setQrDataUrl(url));
    const tick = (): void => setRemainingMs(Math.max(0, created.expiresAtMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [created]);

  const messages = React.useMemo(() => buildInviteFormMessages(t), [t]);

  const handleSubmit = async (s: InviteFormState): Promise<void> => {
    if (!online) return;
    if (s.name.trim().length === 0) return;
    setError(null);
    try {
      const result = await createInvitation({
        targetRole: inviteRoleToInternal(s.role),
        displayName: s.name.trim(),
      });
      setCreated(result);
    } catch (e) {
      const code = (e as Error).message;
      const key =
        code === 'invitation_quota_exceeded' ? 'invitation.errorQuota' : 'invitation.errorExpired';
      setError(t(key));
    }
  };

  const handleCopy = (): void => {
    if (created === null) return;
    void navigator.clipboard.writeText(
      `${window.location.origin}/accept-invitation/${created.token}`,
    );
  };

  if (!authenticated) return null;

  // Mode 2 : QR code après création (même flux que v1, juste reskiné).
  if (created !== null) {
    const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
    return (
      <Theme name="kinhale_light">
        <main
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--background)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              maxWidth: 520,
              margin: '40px auto',
              padding: '0 24px 48px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              color: 'var(--color)',
              fontFamily: 'var(--font-body, "Inter", system-ui, sans-serif)',
            }}
          >
            <h1
              style={{
                fontFamily: 'var(--font-display, "Inter Tight", "Inter", system-ui, sans-serif)',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.56px',
                margin: 0,
              }}
            >
              {t('invitation.qrTitle')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--colorMuted)', margin: 0, lineHeight: 1.5 }}>
              {t('invitation.qrInstruction')}
            </p>
            {qrDataUrl !== null && (
              <div
                style={{
                  alignSelf: 'center',
                  background: 'var(--surface)',
                  borderRadius: 18,
                  padding: 20,
                  border: '0.5px solid var(--borderColor)',
                }}
              >
                <img src={qrDataUrl} alt="QR" width={240} height={240} />
              </div>
            )}
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 14,
                border: '0.5px solid var(--borderColor)',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--colorMore)' }}>
                {t('invitation.pinLabel')}
              </span>
              <span
                data-testid="pin-value"
                style={{
                  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: 'var(--color)',
                }}
              >
                {created.pin}
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--colorMore)', margin: 0 }}>
              {t('invitation.expiresIn', { minutes })}
            </p>
            <button
              onClick={handleCopy}
              aria-label={t('invitation.copyLink')}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                background: 'var(--maint)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              {t('invitation.copyLink')}
            </button>
            <button
              onClick={() => router.push('/caregivers')}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--colorMuted)',
                padding: '10px 16px',
                borderRadius: 12,
                border: '0.5px solid var(--borderColorStrong)',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              {t('invitation.cancelCta')}
            </button>
          </div>
        </main>
      </Theme>
    );
  }

  // Mode 1 : formulaire d'invitation (clinical-calm v2).
  return (
    <Theme name="kinhale_light">
      <main
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--background)',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: '40px auto',
            padding: '0 24px 48px',
          }}
        >
          <InviteForm
            messages={messages}
            state={state}
            onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            submitDisabled={!online || state.name.trim().length === 0}
            mode="web"
            handlers={{
              onCancel: () => router.push('/caregivers'),
              onSubmit: (s) => {
                void handleSubmit(s);
              },
            }}
            availableRoles={
              ['contributor', 'restricted'] as ReadonlyArray<PresentationCaregiverRole>
            }
          />
          {!online && (
            <p
              data-testid="offline-guard-message"
              role="status"
              style={{
                marginTop: 14,
                padding: '10px 14px',
                background: 'var(--amberSoft)',
                color: 'var(--amberInk)',
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {t('offlineGuard.message')}
            </p>
          )}
          {error !== null && (
            <p
              role="status"
              style={{
                marginTop: 14,
                padding: '10px 14px',
                background: 'var(--rescueSoft)',
                color: 'var(--rescueInk)',
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {error}
            </p>
          )}
        </div>
      </main>
    </Theme>
  );
}
