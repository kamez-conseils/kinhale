// Types partagés pour les écrans Pumps (Mes pompes + Ajouter pompe v2).
// Les composants sont purement présentationnels : ils reçoivent
// `messages` (chaînes déjà localisées par l'app appelante) et `data`.

export type PumpKind = 'maint' | 'rescue';

export type PumpExpiryKind = 'normal' | 'soon' | 'expired';

export interface PumpExpiryStatus {
  kind: PumpExpiryKind;
  /** Libellé localisé prêt à afficher. */
  label: string;
}

export interface PumpView {
  id: string;
  name: string;
  /** Sous-titre court, ex. « Matin & soir » ou « Au besoin ». */
  contextLabel: string;
  kind: PumpKind;
  doses: number;
  total: number;
  /** Lieu de stockage déjà localisé (« Maison », « Garderie », « Sac à dos »…). */
  location: string;
  /**
   * Date d'expiration ISO 8601, ou `null` si inconnue (la projection
   * Automerge peut renvoyer `expiresAtMs: null`). Le composant ne
   * formate pas — l'app fournit `formatExpiry` qui retourne un libellé
   * adapté dans ce cas.
   */
  expiry: string | null;
  /** True si la barre de stock doit basculer en ambre. */
  isLow?: boolean;
  /** True si c'est la pompe principale du foyer pour son `kind`. */
  isPrimary?: boolean;
}

// ── Sidebar dashboard ────────────────────────────────────────────────────

export interface PumpsNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

// ── Page Mes pompes ──────────────────────────────────────────────────────

export interface PumpsListMessages {
  /** Eyebrow au-dessus du titre (ex. prénom enfant en majuscules). */
  childName: string;
  title: string;
  /** Sous-titre formaté avec le nombre, ex. `"4 pompes actives"`. */
  subtitle: string;
  add: string;
  addShort: string;
  sectionMaint: string;
  sectionRescue: string;
  primary: string;
  refill: string;
  /** Préfixe stock, ex. `"Stock"`. */
  stockLabel: string;
  notMedical: string;
}

export interface PumpsListHandlers {
  onPressAdd?: (() => void) | undefined;
  onPressPump?: ((id: string) => void) | undefined;
  onPressRefill?: ((id: string) => void) | undefined;
}

// ── Page État vide ───────────────────────────────────────────────────────

export interface PumpsEmptyMessages {
  /** Titre `<h1>` du header en haut de page (« Mes pompes »). */
  headerTitle: string;
  /** Compteur dans le header (« 0 / 0 »). */
  headerCount: string;
  /** Titre principal de l'état vide (`<h2>`), ex. « Ajoutez la première pompe de Léa ». */
  emptyHeading: string;
  /** Phrase d'accroche introduction. */
  subtitle: string;
  benefit1Title: string;
  benefit1Sub: string;
  benefit2Title: string;
  benefit2Sub: string;
  benefit3Title: string;
  benefit3Sub: string;
  scanCta: string;
  manualCta: string;
  tipLabel: string;
  helpText: string;
  notMedical: string;
}

export interface PumpsEmptyHandlers {
  onPressScan?: (() => void) | undefined;
  onPressManual?: (() => void) | undefined;
}

// ── Wizard Ajouter pompe ─────────────────────────────────────────────────

export type AddPumpStepIndex = 0 | 1 | 2 | 3;

/** Une pastille de couleur pour identifier visuellement la pompe. */
export interface PumpColorOption {
  /** Identifiant interne (`sky`, `leaf`, etc.). Stable, non-localisé. */
  key: string;
  /** Valeur CSS color (ex. `#5b8cc7` ou un oklch). */
  value: string;
  /** Nom localisé, utilisé en `aria-label` / `title`. */
  label: string;
}

export interface AddPumpDeviceOption {
  /** Identifiant interne stable. */
  key: string;
  /** Libellé localisé. */
  label: string;
}

export type AddPumpUnit = 'µg' | 'mg' | 'mL';

export interface AddPumpScheduleSlot {
  /** Identifiant interne stable (`morning`, `afternoon`, `evening`, `night`). */
  key: string;
  /** Libellé localisé du moment. */
  label: string;
  /** Heure suggérée au format `HH:mm`, ou chaîne vide si non encore définie. */
  time: string;
  /** Activation par l'utilisateur. */
  on: boolean;
}

export interface AddPumpFormState {
  // Step 1
  name: string;
  substance: string;
  dose: string;
  unit: AddPumpUnit;
  colorKey: string | null;
  // Step 2
  kind: PumpKind | null;
  puffsPerDose: number;
  deviceKey: string | null;
  prescriber: string;
  pharmacy: string;
  // Step 3
  schedule: ReadonlyArray<AddPumpScheduleSlot>;
  escalation: boolean;
}

export interface AddPumpStepLabels {
  /** Libellé court affiché dans le stepper, ex. `"Identifier"`. */
  short: string;
  /** Titre h2 de l'étape, ex. `"Identifier la pompe"`. */
  heading: string;
  /** Sous-titre / description sous le h2. */
  subtitle: string;
}

export interface AddPumpStep1Messages extends AddPumpStepLabels {
  scanCta: string;
  scanSub: string;
  orSeparator: string;
  nameLabel: string;
  namePlaceholder: string;
  nameHelp: string;
  substanceLabel: string;
  substancePlaceholder: string;
  doseLabel: string;
  dosePlaceholder: string;
  unitLabel: string;
  units: ReadonlyArray<AddPumpUnit>;
  colorLabel: string;
  colorSub: string;
  colors: ReadonlyArray<PumpColorOption>;
}

export interface AddPumpStep2Messages extends AddPumpStepLabels {
  typeLabel: string;
  typeMaintName: string;
  typeMaintSub: string;
  typeRescueName: string;
  typeRescueSub: string;
  puffsLabel: string;
  puffsSingular: string;
  puffsPlural: string;
  deviceLabel: string;
  devices: ReadonlyArray<AddPumpDeviceOption>;
  prescriberLabel: string;
  prescriberPlaceholder: string;
  pharmacyLabel: string;
  pharmacyPlaceholder: string;
}

export interface AddPumpStep3Messages extends AddPumpStepLabels {
  defaultSlots: ReadonlyArray<AddPumpScheduleSlot>;
  reminderLabel: string;
  reminderSub: string;
  escalationLabel: string;
  escalationSub: string;
}

export interface AddPumpStep4Messages extends AddPumpStepLabels {
  summaryLabel: string;
  fieldPump: string;
  fieldSubstance: string;
  fieldType: string;
  fieldDose: string;
  fieldSchedule: string;
  /** Bouton secondaire « Enregistrer la première dose ». */
  firstDoseCta: string;
  /** Bouton primaire « Terminé ». */
  doneCta: string;
  /** Placeholder valeur non encore renseignée. */
  notSet: string;
}

export interface AddPumpMessages {
  modalTitle: string;
  /** Étiquettes courtes des 4 étapes — utilisé par le `Stepper`. */
  stepShort: ReadonlyArray<string>;
  step1: AddPumpStep1Messages;
  step2: AddPumpStep2Messages;
  step3: AddPumpStep3Messages;
  step4: AddPumpStep4Messages;
  cancel: string;
  back: string;
  next: string;
  save: string;
  previewLabel: string;
  previewHint: string;
  previewKindMaint: string;
  previewKindRescue: string;
  previewDoseLabel: string;
  previewPuffSingular: string;
  previewPuffPlural: string;
  notMedical: string;
}

export interface AddPumpHandlers {
  onCancel?: (() => void) | undefined;
  onSubmit?: ((state: AddPumpFormState) => void) | undefined;
  onLogFirstDose?: ((state: AddPumpFormState) => void) | undefined;
}
