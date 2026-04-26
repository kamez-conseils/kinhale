'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AuthShell, SigningBlock } from '@kinhale/ui/auth';

import { apiFetch, ApiError } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth-store';
import { getOrCreateDevice, createGroupKey } from '../../../lib/device';
import { buildAuthCopy } from '../../../lib/auth/copy';

function decodeJwtPayload(token: string): { sub: string; deviceId: string; householdId: string } {
  const part = token.split('.')[1] ?? '';
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const claims = JSON.parse(json) as Record<string, unknown>;
  if (
    typeof claims['sub'] !== 'string' ||
    typeof claims['deviceId'] !== 'string' ||
    typeof claims['householdId'] !== 'string'
  ) {
    throw new Error('JWT payload manquant : sub, deviceId ou householdId absent');
  }
  return { sub: claims['sub'], deviceId: claims['deviceId'], householdId: claims['householdId'] };
}

// Codes d'erreur stockés dans le state — la traduction est dérivée à chaque
// render via `t()`, ce qui rend les messages réactifs au changement de
// langue (revue kz-review M4 KIN-098).
type VerifyErrorCode = 'missing-token' | 'verify-error';

function VerifyInner(): React.JSX.Element {
  const { t } = useTranslation('common');
  const params = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [errorCode, setErrorCode] = React.useState<VerifyErrorCode | null>(null);
  const copy = React.useMemo(() => buildAuthCopy(t), [t]);

  React.useEffect(() => {
    const token = params.get('token');
    if (token === null || token === '') {
      setErrorCode('missing-token');
      return;
    }
    void (async () => {
      try {
        const { accessToken } = await apiFetch<{ accessToken: string }>(
          `/auth/verify?token=${encodeURIComponent(token)}`,
        );
        const claims = decodeJwtPayload(accessToken);
        setAuth(accessToken, claims.deviceId, claims.householdId);
        const kp = await getOrCreateDevice();
        // KIN-095 — Génère la clé de groupe E2EE locale si elle n'existe pas
        // encore (cas : ce device crée ou ré-attache le foyer). Idempotent.
        // TODO KIN-025-web : intégration flux QR invite côté web — chaque
        // aidant crée actuellement sa propre groupKey, pas de partage
        // cross-device sur web. Suivi via l'issue de suivi
        // « [Bloquant v1.0 multi-aidant web] flux QR invite côté web ».
        await createGroupKey(claims.householdId);
        try {
          await apiFetch('/auth/register-device', {
            method: 'POST',
            token: accessToken,
            body: JSON.stringify({ publicKeyHex: kp.publicKeyHex }),
          });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 409)) {
            throw err;
          }
          // 409 = device already registered — expected on repeat visits
        }
        router.push('/journal');
      } catch {
        setErrorCode('verify-error');
      }
    })();
    // L'effet ne doit s'exécuter qu'une fois au montage : la vérification
    // d'un magic link est unique et non-rejouable. Les messages d'erreur
    // sont dérivés du code via t() à chaque render — réactifs i18n.
  }, []);

  const errorMessage =
    errorCode === 'missing-token'
      ? copy.missingToken
      : errorCode === 'verify-error'
        ? copy.verifyError
        : null;

  return (
    <AuthShell copy={copy} layout="web">
      <SigningBlock
        copy={copy}
        errorMessage={errorMessage}
        retryCta={
          errorCode !== null
            ? {
                label: copy.verifyRetryCta,
                onPress: (): void => router.replace('/auth'),
              }
            : null
        }
      />
    </AuthShell>
  );
}

export default function VerifyPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
