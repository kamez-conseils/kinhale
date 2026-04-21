'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, Text } from 'tamagui';
import { apiFetch, ApiError } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/auth-store';
import { getOrCreateDevice } from '../../../lib/device';

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

function VerifyInner(): React.JSX.Element {
  const { t } = useTranslation('common');
  const params = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (token === null || token === '') {
      setError(t('auth.missingToken'));
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
        setError(t('auth.verifyError'));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // params, router, setAuth, t are all stable refs — effect must run once on mount only
  }, []);

  if (error !== null) {
    return (
      <YStack padding="$4" flex={1} alignItems="center" justifyContent="center">
        <Text color="$red10" role="alert">
          {error}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack padding="$4" flex={1} alignItems="center" justifyContent="center">
      <Text>{t('auth.verifying')}</Text>
    </YStack>
  );
}

export default function VerifyPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
