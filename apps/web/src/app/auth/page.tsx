'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AuthShell,
  EmailForm,
  SentBlock,
  type AuthInvitation,
  type AuthState,
} from '@kinhale/ui/auth';

import { apiFetch, ApiError } from '../../lib/api-client';
import { getInvitationPublic } from '../../lib/invitations/client';
import { buildAuthCopy, mapInvitationRole } from '../../lib/auth/copy';

const RESEND_COOLDOWN_S = 60;

function AuthPageInner(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const copy = React.useMemo(() => buildAuthCopy(t), [t]);

  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<AuthState>('enter');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [resendIn, setResendIn] = React.useState(0);
  const [invitation, setInvitation] = React.useState<AuthInvitation | null>(null);

  // Garde-fou anti-double-effet — chaque inviteToken n'est résolu qu'une
  // fois, même en cas de re-render (StrictMode, mocks de tests…).
  const resolvedInviteRef = React.useRef<string | null>(null);

  // Si ?invite=<token> est présent on récupère le `displayName` + `role`
  // exposés publiquement (sans PIN ni info santé). Échec silencieux : on
  // tombe sur l'écran sans personnalisation, jamais bloquant.
  //
  // Anti-oracle (kz-securite KIN-098 P1) : `getInvitationPublic` peut
  // renvoyer 404 (token inexistant), 410 (expiré), 423 (verrouillé). Le
  // catch unique ci-dessous écrase ces 3 statuts en un comportement
  // identique côté UI — pas d'oracle d'énumération côté navigateur, pas
  // de log différentiel côté Sentry. NE PAS introduire de branche par
  // status sans repasser kz-securite.
  React.useEffect(() => {
    if (inviteToken === null || inviteToken === '') return;
    if (resolvedInviteRef.current === inviteToken) return;
    resolvedInviteRef.current = inviteToken;
    let cancelled = false;

    // P1 kz-securite : retirer immédiatement le token de l'URL pour ne pas
    // le voir fuiter via Referer, historique navigateur ou copier-coller.
    // L'effet a déjà capturé `inviteToken` en paramètre — on peut donc
    // nettoyer la barre d'adresse sans perdre la valeur en cours d'usage.
    if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
      router.replace('/auth');
    }

    getInvitationPublic(inviteToken)
      .then((info) => {
        if (cancelled) return;
        setInvitation({
          inviterName: info.displayName,
          role: mapInvitationRole(info.targetRole),
        });
      })
      .catch(() => {
        // Anti-fuite : on ne révèle pas si le token est invalide ou expiré
        // sur la page d'auth. L'utilisateur verra l'écran standard.
      });

    return (): void => {
      cancelled = true;
    };
  }, [inviteToken, router]);

  // Décompteur du resend (côté client uniquement). L'authoritative reste
  // côté serveur via rate-limit ; ce timer améliore juste l'UX.
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => {
      setResendIn((n) => Math.max(0, n - 1));
    }, 1000);
    return (): void => clearTimeout(id);
  }, [resendIn]);

  const sendMagicLink = React.useCallback(
    async (currentEmail: string): Promise<void> => {
      setSubmitting(true);
      setErrorMessage(null);
      try {
        await apiFetch('/auth/magic-link', {
          method: 'POST',
          body: JSON.stringify({ email: currentEmail.trim() }),
        });
        setState('sent');
        setResendIn(RESEND_COOLDOWN_S);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          setErrorMessage(t('auth.errors.rateLimited'));
        } else if (err instanceof ApiError) {
          setErrorMessage(t('auth.errorSend'));
        } else {
          setErrorMessage(t('auth.errors.network'));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [t],
  );

  const handleSubmit = React.useCallback((): void => {
    void sendMagicLink(email);
  }, [email, sendMagicLink]);

  const handleResend = React.useCallback((): void => {
    if (resendIn > 0) return;
    void sendMagicLink(email);
  }, [email, resendIn, sendMagicLink]);

  const handleChangeEmail = React.useCallback((): void => {
    setState('enter');
    setErrorMessage(null);
  }, []);

  const handleOpenMail = React.useCallback((): void => {
    if (typeof window === 'undefined') return;
    window.location.href = 'mailto:';
  }, []);

  return (
    <AuthShell copy={copy} layout="web" invitation={invitation}>
      {state === 'enter' && (
        <EmailForm
          copy={copy}
          value={email}
          onChange={setEmail}
          onSubmit={handleSubmit}
          submitting={submitting}
          errorMessage={errorMessage}
          autoFocus
        />
      )}
      {state === 'sent' && (
        <SentBlock
          copy={copy}
          email={email}
          resendIn={resendIn}
          onResend={handleResend}
          onChangeEmail={handleChangeEmail}
          onOpenMail={handleOpenMail}
          layout="web"
        />
      )}
    </AuthShell>
  );
}

// `useSearchParams()` exige un boundary `<Suspense>` côté Next.js 15 — sinon
// un build strict bascule la page entière en client-side rendering forcé.
export default function AuthPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
