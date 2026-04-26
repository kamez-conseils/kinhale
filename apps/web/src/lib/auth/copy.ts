import type { AuthCopy, AuthRole } from '@kinhale/ui/auth';
import type { TFunction } from 'i18next';

// Construit l'objet AuthCopy attendu par les composants partagés à partir
// du `t()` i18next courant. Centralise le mapping pour ne pas le dupliquer
// entre `/auth` et `/auth/verify`.
export function buildAuthCopy(t: TFunction<'common'>): AuthCopy {
  const roleLabels: Record<AuthRole, string> = {
    admin: t('auth.role.admin'),
    contributor: t('auth.role.contributor'),
    restricted: t('auth.role.restricted'),
  };

  return {
    welcomeTitle: t('auth.welcomeTitle'),
    welcomeSub: t('auth.welcomeSub'),
    invitedAs: ({ who, role }: { who: string; role: string }): string =>
      t('auth.invitedAs', { who, role }),
    inviteHelper: t('auth.inviteHelper'),
    roleLabels,

    emailLabel: t('auth.emailLabel'),
    emailPlaceholder: t('auth.emailPlaceholder'),
    sendBtn: t('auth.sendBtn'),
    sendingBtn: t('auth.sendingBtn'),
    invalidEmail: t('auth.errors.invalidEmail'),
    secure: t('auth.secure'),

    sentTitle: t('auth.sentTitle'),
    sentSubLine1: t('auth.sentSubLine1'),
    sentSubLine2: t('auth.sentSubLine2'),
    openMail: t('auth.openMail'),
    didntGet: t('auth.didntGet'),
    resend: t('auth.resend'),
    resendIn: ({ n }: { n: number }): string => t('auth.resendIn', { n }),
    changeEmail: t('auth.changeEmail'),
    resendError: t('auth.resendError'),

    signingTitle: t('auth.signingTitle'),
    signingSub: t('auth.signingSub'),

    verifyError: t('auth.verifyError'),
    verifyRetryCta: t('auth.verifyRetryCta'),
    missingToken: t('auth.missingToken'),

    tagline: t('auth.tagline'),
    panelLine1: t('auth.panelLine1'),
    panelLine2: t('auth.panelLine2'),
    panelLine3: t('auth.panelLine3'),
    poweredOpen: t('auth.poweredOpen'),
    legal: t('auth.legal'),
    // Source unique du disclaimer non-dispositif-médical (RM27) : on
    // réutilise la clé `disclaimer.short` déjà publiée à travers l'app pour
    // garantir la cohérence — pas de copie indépendante.
    notMedical: t('disclaimer.short'),
  };
}

// Mappe le rôle remonté par l'API d'invitation vers le rôle visible UI.
// `restricted_contributor` est replié sur `restricted` pour la traduction.
export function mapInvitationRole(apiRole: 'contributor' | 'restricted_contributor'): AuthRole {
  return apiRole === 'restricted_contributor' ? 'restricted' : 'contributor';
}
