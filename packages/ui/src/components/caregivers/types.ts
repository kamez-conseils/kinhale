// Types présentationnels pour les écrans Aidants (clinical-calm v2).
// Les composants sont purement présentationnels : ils reçoivent des
// props localisées et déjà mappées depuis `projectCaregivers` côté app.

/**
 * Rôle du foyer affiché dans les pastilles `RolePill` et la matrice de
 * permissions. Mappé côté app depuis le rôle interne (`admin`,
 * `contributor`, `restricted_contributor`).
 */
export type CaregiverRole = 'admin' | 'contributor' | 'restricted';

/**
 * Statut visuel d'un aidant dans la liste « actifs ». La couche app
 * dérive ce champ depuis le statut Automerge + l'éventuel suivi de
 * connexion.
 */
export type CaregiverPresence = 'online' | 'offline';

export interface CaregiverProfileView {
  id: string;
  /** Nom complet ou pseudonyme du foyer. */
  name: string;
  /** Initiales calculées côté app, ex. « ST ». */
  initials: string;
  /** Lien familial déjà localisé (« Parent », « Garderie »…). */
  relation: string;
  role: CaregiverRole;
  email?: string | undefined;
  presence: CaregiverPresence;
  /** Libellé localisé « Vu·e il y a 12 min ». Optionnel si présence==='online'. */
  lastSeenLabel?: string | undefined;
  /** Vrai pour l'aidant courant — ajoute la pastille « Vous ». */
  isYou?: boolean;
  /**
   * Hue (0-360) calculé côté app pour produire un avatar déterministe
   * basé sur `oklch(85% 0.06 hue)`. La pastille reste cohérente d'une
   * session à l'autre pour le même `id`.
   */
  hue: number;
}

export type PendingInvitationStage =
  | 'awaitingRecipient' // pending_acceptance — l'invité n'a pas encore ouvert le lien
  | 'awaitingSeal' // pending_sealing — pubkey reçue, l'admin doit sceller
  | 'sealedWaiting'; // sealed_waiting — sealé, l'invité doit accepter

export interface PendingInvitationView {
  /** Token court d'invitation (utilisé pour resend / revoke). */
  token: string;
  /** Nom affiché par l'admin lors de la création. */
  name: string;
  initials: string;
  email?: string | undefined;
  role: CaregiverRole;
  stage: PendingInvitationStage;
  /** Date d'envoi déjà formatée (ex. « 24 avril »). */
  sentLabel: string;
  hue: number;
}

// ── Sidebar (réutilisée) ────────────────────────────────────────────────

export interface CaregiversNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

// ── Messages ────────────────────────────────────────────────────────────

export interface CaregiversListMessages {
  childName: string;
  title: string;
  /** Sous-titre formaté avec le nombre, ex. « 5 personnes ont accès au profil ». */
  subtitle: string;
  inviteCta: string;
  inviteShort: string;
  sectionActive: string;
  sectionPending: string;
  youTag: string;
  onlineNow: string;
  /** Rôles localisés. */
  roleLabel: Record<CaregiverRole, string>;
  roleDescription: Record<CaregiverRole, string>;
  /** Boutons sur les rangées en attente. */
  resendCta: string;
  withdrawCta: string;
  /** Phrases pour chaque stade d'invitation. */
  stageAwaitingRecipient: string;
  stageAwaitingSeal: string;
  stageSealedWaiting: string;
  /** Permissions panel. */
  permissionsTitle: string;
  permission1: string;
  permission2: string;
  permission3: string;
  permission4: string;
  permission5: string;
  permYes: string;
  permNo: string;
  notMedical: string;
}

export interface CaregiversListHandlers {
  onPressInvite?: (() => void) | undefined;
  onPressCaregiver?: ((id: string) => void) | undefined;
  onPressResend?: ((token: string) => void) | undefined;
  onPressWithdraw?: ((token: string) => void) | undefined;
  /** Action principale sur un pending : « finaliser » (sceller). */
  onPressSeal?: ((token: string) => void) | undefined;
}

// ── Invite form ──────────────────────────────────────────────────────────

export interface InviteFormState {
  name: string;
  email: string;
  role: CaregiverRole;
}

export interface InviteFormMessages {
  title: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  chooseRoleLabel: string;
  roleLabel: Record<CaregiverRole, string>;
  roleDescription: Record<CaregiverRole, string>;
  cancelCta: string;
  sendCta: string;
}

export interface InviteFormHandlers {
  onCancel?: (() => void) | undefined;
  onSubmit?: ((state: InviteFormState) => void) | undefined;
}
