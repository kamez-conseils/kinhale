// Types présentationnels des composants Pumps. L'app appelante mappe
// ses projections (`@kinhale/sync`) vers ces types pure-presentational
// pour pouvoir tester les composants sans monter le doc Automerge.

export type PumpKind = 'maint' | 'rescue';

export interface PumpView {
  id: string;
  name: string;
  /** Sous-titre court (« Matin & soir », « Au besoin », etc.). */
  contextLabel: string;
  kind: PumpKind;
  /** Doses restantes. */
  doses: number;
  /** Doses initiales. */
  total: number;
  /** Date d'expiration au format ISO (`YYYY-MM-DD` ou ISO complet). */
  expiry: string | null;
  /** Vrai quand le stock passe sous le seuil d'alerte. */
  isLow?: boolean;
  /** Localisation libre (« Maison », « Garderie », etc.). */
  location?: string;
  /** Indique la pompe principale (badge). */
  isPrimary?: boolean;
}

export type PumpExpiryKind = 'normal' | 'soon' | 'expired';
