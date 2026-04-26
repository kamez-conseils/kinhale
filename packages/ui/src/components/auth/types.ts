// Types partagés des composants auth.
//
// Les composants reçoivent leurs textes via props (pas d'import direct
// d'i18next) pour rester pure-presentational et testables sans monter le
// stack i18n. C'est l'app appelante (web/mobile) qui résout les chaînes
// via son hook habituel et les passe au composant.

export type AuthState = 'enter' | 'sent' | 'signing';

export type AuthRole = 'admin' | 'contributor' | 'restricted';

export interface AuthInvitation {
  inviterName: string;
  role: AuthRole;
}

export interface AuthCopy {
  // En-têtes
  welcomeTitle: string;
  welcomeSub: string;
  invitedAs: (vars: { who: string; role: string }) => string;
  inviteHelper: string;
  roleLabels: Record<AuthRole, string>;

  // Formulaire
  emailLabel: string;
  emailPlaceholder: string;
  sendBtn: string;
  sendingBtn: string;
  invalidEmail: string;
  secure: string;

  // État envoyé
  sentTitle: string;
  sentSubLine1: string;
  sentSubLine2: string;
  openMail: string;
  didntGet: string;
  resend: string;
  resendIn: (vars: { n: number }) => string;
  changeEmail: string;
  resendError: string;

  // État connexion en cours
  signingTitle: string;
  signingSub: string;

  // Erreur de vérification
  verifyError: string;
  verifyRetryCta: string;
  missingToken: string;

  // Pied de page / panneau marque
  tagline: string;
  panelLine1: string;
  panelLine2: string;
  panelLine3: string;
  poweredOpen: string;
  legal: string;
  notMedical: string;
}
