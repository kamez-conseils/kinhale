// Types présentationnels pour la page Réglages (hub clinical-calm v2).

export type SettingsRowKind = 'toggle' | 'segment' | 'link' | 'value' | 'danger';

export interface SettingsToggleRow {
  key: string;
  kind: 'toggle';
  label: string;
  sub?: string | undefined;
  checked: boolean;
}

export interface SettingsSegmentOption {
  value: string;
  label: string;
}

export interface SettingsSegmentRow {
  key: string;
  kind: 'segment';
  label: string;
  options: ReadonlyArray<SettingsSegmentOption>;
  value: string;
}

export interface SettingsLinkRow {
  key: string;
  kind: 'link';
  label: string;
  sub?: string | undefined;
  /** Si vrai, ouvre dans un nouvel onglet (icône externe). */
  external?: boolean | undefined;
}

export interface SettingsValueRow {
  key: string;
  kind: 'value';
  label: string;
  value: string;
  /** Si vrai, le `value` est rendu en `font-mono` avec tabular-nums. */
  mono?: boolean | undefined;
}

export interface SettingsDangerRow {
  key: string;
  kind: 'danger';
  label: string;
  sub?: string | undefined;
}

export type SettingsRow =
  | SettingsToggleRow
  | SettingsSegmentRow
  | SettingsLinkRow
  | SettingsValueRow
  | SettingsDangerRow;

export type SettingsSectionIcon = 'bell' | 'paint' | 'shield' | 'info';

export interface SettingsSection {
  key: string;
  icon: SettingsSectionIcon;
  /** Titre de la section, déjà localisé. */
  title: string;
  rows: ReadonlyArray<SettingsRow>;
}

// ── Profil enfant card ──────────────────────────────────────────────────

export interface ChildProfileSummary {
  /** Nom complet, ex. « Léa Tremblay ». */
  name: string;
  /** Initiale (1 caractère) pour l'avatar. */
  initial: string;
  /** Hue (0-360) pour la couleur de l'avatar. */
  hue: number;
  /** Détails secondaires séparés par « · » (âge, poids, prescripteur). */
  details: ReadonlyArray<string>;
}

// ── Sidebar ─────────────────────────────────────────────────────────────

export interface SettingsNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

// ── Messages ────────────────────────────────────────────────────────────

export interface SettingsListMessages {
  childName: string;
  title: string;
  /** Sous-titre header sur web (ex. « Préférences du foyer »). */
  subtitle?: string | undefined;
  /** Libellé bouton « Se déconnecter ». */
  signOutCta: string;
  /** Disclaimer Kinhale. */
  notMedical: string;
  /** Libellé du bouton « Modifier le profil enfant ». */
  editProfileCta: string;
}

export interface SettingsListHandlers {
  onPressEditProfile?: (() => void) | undefined;
  onPressRow?: ((sectionKey: string, rowKey: string) => void) | undefined;
  onChangeToggle?: ((sectionKey: string, rowKey: string, checked: boolean) => void) | undefined;
  onChangeSegment?: ((sectionKey: string, rowKey: string, value: string) => void) | undefined;
  onPressSignOut?: (() => void) | undefined;
}
