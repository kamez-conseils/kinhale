import type { TFunction } from 'i18next';

import type {
  CaregiverProfileView,
  CaregiversListMessages,
  InviteFormMessages,
  PendingInvitationStage,
  PendingInvitationView,
} from '@kinhale/ui/caregivers';
// `CaregiverRole` est défini dans le module `home` (déjà exporté
// largement). Voir `caregivers/index.ts` pour la note sur la dé-dup.
import type { CaregiverRole } from '@kinhale/ui/home';
import type { ProjectedCaregiver } from '@kinhale/sync';

import type { InvitationSummary } from '../invitations/client';

/**
 * Hue déterministe (0-360) calculée depuis l'identifiant de l'aidant
 * pour produire un avatar coloré stable d'une session à l'autre. Pas
 * de hash cryptographique nécessaire (palette esthétique).
 */
function hueFromId(id: string): number {
  let acc = 0;
  for (let i = 0; i < id.length; i += 1) {
    acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  }
  return acc % 360;
}

/**
 * Initiales depuis un nom complet : 1ʳᵉ lettre des deux premiers mots,
 * ou 2 premières lettres si un seul mot. Toujours en MAJUSCULES.
 */
function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Mappe le rôle interne (`admin` / `contributor` / `restricted_contributor`)
 * vers le type `CaregiverRole` utilisé par la couche présentationnelle.
 */
function mapInternalRole(role: string): CaregiverRole {
  if (role === 'admin') return 'admin';
  if (role === 'restricted_contributor' || role === 'restricted') return 'restricted';
  return 'contributor';
}

export interface BuildContext {
  /** ID du device courant — utilisé pour la pastille « Vous ». */
  currentDeviceId: string | null;
  /** Locale BCP-47 pour formater les dates (« 24 avril »). */
  locale: string;
  /** Référence temporelle (par défaut now()). */
  now?: Date;
}

export function projectedCaregiverToView(
  c: ProjectedCaregiver,
  ctx: BuildContext,
): CaregiverProfileView {
  const role = mapInternalRole(c.role);
  return {
    id: c.caregiverId,
    name: c.displayName,
    initials: initialsFor(c.displayName),
    relation: '',
    role,
    presence: 'offline',
    hue: hueFromId(c.caregiverId),
    ...(ctx.currentDeviceId !== null && c.caregiverId === ctx.currentDeviceId
      ? { isYou: true }
      : {}),
  };
}

function stageOf(inv: InvitationSummary): PendingInvitationStage {
  if (inv.hasRecipientPublicKey !== true) return 'awaitingRecipient';
  if (inv.hasSealedGroupKey !== true) return 'awaitingSeal';
  return 'sealedWaiting';
}

function formatShortDate(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(ms));
}

export function invitationToPendingView(
  inv: InvitationSummary,
  ctx: BuildContext,
): PendingInvitationView {
  const role = mapInternalRole(inv.targetRole);
  return {
    token: inv.token,
    name: inv.displayName,
    initials: initialsFor(inv.displayName),
    role,
    stage: stageOf(inv),
    sentLabel: formatShortDate(inv.createdAtMs, ctx.locale),
    hue: hueFromId(inv.token),
  };
}

export function buildCaregiversListMessages(
  t: TFunction<'common'>,
  count: number,
): CaregiversListMessages {
  return {
    childName: t('home.dashboard.childName'),
    title: t('caregivers.title'),
    subtitle: count === 0 ? t('caregivers.subtitle_zero') : t('caregivers.subtitle', { count }),
    inviteCta: t('caregivers.inviteCta'),
    inviteShort: t('caregivers.inviteShort'),
    sectionActive: t('caregivers.sectionActive'),
    sectionPending: t('caregivers.sectionPending'),
    youTag: t('caregivers.youTag'),
    onlineNow: t('caregivers.onlineNow'),
    roleLabel: {
      admin: t('caregivers.role.admin'),
      contributor: t('caregivers.role.contributor'),
      restricted: t('caregivers.role.restricted'),
    },
    roleDescription: {
      admin: t('caregivers.roleDescription.admin'),
      contributor: t('caregivers.roleDescription.contributor'),
      restricted: t('caregivers.roleDescription.restricted'),
    },
    resendCta: t('caregivers.resendCta'),
    withdrawCta: t('caregivers.withdrawCta'),
    stageAwaitingRecipient: t('caregivers.stage.awaitingRecipient', { date: '' }),
    stageAwaitingSeal: t('caregivers.stage.awaitingSeal', { date: '' }),
    stageSealedWaiting: t('caregivers.stage.sealedWaiting'),
    permissionsTitle: t('caregivers.permissionsTitle'),
    permission1: t('caregivers.permission1'),
    permission2: t('caregivers.permission2'),
    permission3: t('caregivers.permission3'),
    permission4: t('caregivers.permission4'),
    permission5: t('caregivers.permission5'),
    permYes: t('caregivers.permYes'),
    permNo: t('caregivers.permNo'),
    notMedical: t('caregivers.notMedical'),
  };
}

/**
 * Phrase localisée pour chaque stade — l'app utilise la date d'envoi
 * de l'invitation pour personnaliser le libellé.
 */
export function buildStageLabel(
  t: TFunction<'common'>,
  stage: PendingInvitationStage,
  sentLabel: string,
): string {
  switch (stage) {
    case 'awaitingRecipient':
      return t('caregivers.stage.awaitingRecipient', { date: sentLabel });
    case 'awaitingSeal':
      return t('caregivers.stage.awaitingSeal', { date: sentLabel });
    case 'sealedWaiting':
      return t('caregivers.stage.sealedWaiting');
  }
}

export function buildPendingPrimaryCta(
  t: TFunction<'common'>,
): (view: PendingInvitationView) => string | null {
  return (view) => {
    if (view.stage === 'awaitingSeal') {
      return t('caregivers.primaryCta.awaitingSeal');
    }
    return null;
  };
}

export function buildInviteFormMessages(t: TFunction<'common'>): InviteFormMessages {
  return {
    title: t('caregivers.invite.title'),
    subtitle: t('caregivers.invite.subtitle'),
    nameLabel: t('caregivers.invite.nameLabel'),
    namePlaceholder: t('caregivers.invite.namePlaceholder'),
    emailLabel: t('caregivers.invite.emailLabel'),
    emailPlaceholder: t('caregivers.invite.emailPlaceholder'),
    chooseRoleLabel: t('caregivers.invite.chooseRoleLabel'),
    roleLabel: {
      admin: t('caregivers.role.admin'),
      contributor: t('caregivers.role.contributor'),
      restricted: t('caregivers.role.restricted'),
    },
    roleDescription: {
      admin: t('caregivers.roleDescription.admin'),
      contributor: t('caregivers.roleDescription.contributor'),
      restricted: t('caregivers.roleDescription.restricted'),
    },
    cancelCta: t('caregivers.invite.cancelCta'),
    sendCta: t('caregivers.invite.sendCta'),
  };
}

/**
 * Mappe le `CaregiverRole` présentationnel (`'admin' | 'contributor' |
 * 'restricted'`) vers le rôle interne accepté par
 * `createInvitation` (`'contributor' | 'restricted_contributor'`).
 *
 * `admin` n'est PAS un rôle d'invitation — la promotion en admin se
 * fait après acceptation, via un événement séparé. Côté formulaire on
 * masque le choix `admin` à l'utilisateur (`availableRoles`).
 */
export function inviteRoleToInternal(
  role: CaregiverRole,
): 'contributor' | 'restricted_contributor' {
  return role === 'restricted' ? 'restricted_contributor' : 'contributor';
}
