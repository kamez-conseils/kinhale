import type { NotificationType } from './notification-type.js';

/**
 * Quiet hours par aidant (SPECS §9 + story E5-S08).
 *
 * Paramètres scalaires uniques (pas une collection par type de notif) :
 * - `enabled` : l'utilisateur peut temporairement désactiver sans perdre ses valeurs.
 * - `startLocalTime`, `endLocalTime` : format `"HH:mm"` (24h, zéro padding).
 *   La plage est **inclusive sur start, exclusive sur end** — cohérent avec la
 *   sémantique courante d'un intervalle horaire ("à partir de 22h, jusqu'à 7h").
 * - `timezone` : IANA (ex: `America/Toronto`). Source canonique : l'aidant
 *   choisit son fuseau à la configuration (auto-détection via
 *   `Intl.DateTimeFormat().resolvedOptions().timeZone` côté client).
 *
 * Si `start === end`, la plage est **vide** (désactivation implicite).
 * Si `start > end` (ex : 22:00 → 07:00), la plage **traverse minuit** : on
 * considère dedans tout instant `t >= start OR t < end` dans le fuseau.
 *
 * Refs: SPECS §9, E5-S08, RM25 (exception missed_dose).
 */
export interface QuietHours {
  readonly enabled: boolean;
  readonly startLocalTime: string; // HH:mm
  readonly endLocalTime: string; // HH:mm
  readonly timezone: string; // IANA
}

/**
 * Types de notification qui **contournent** les quiet hours (exception sécurité).
 *
 * La règle SPECS §9 précise que les quiet hours ne doivent jamais silencier :
 * - `missed_dose` : RM25, protection sanitaire (dose planifiée non confirmée).
 * - `security_alert` : intégrité du compte (login suspect, clé rotatée).
 *
 * L'ensemble est volontairement **disjoint** de la notion plus générale
 * `ALWAYS_ENABLED_NOTIFICATION_TYPES` : ici on ne parle pas de désactivation
 * par l'utilisateur, mais de contournement d'un mécanisme de filtrage temporel.
 * Les deux ensembles coïncident aujourd'hui, mais ce n'est pas garanti à
 * l'avenir — on isole la sémantique pour éviter un couplage implicite.
 */
export const QUIET_HOURS_OVERRIDE_TYPES: ReadonlyArray<NotificationType> = [
  'missed_dose',
  'security_alert',
] as const;

/**
 * Vérifie si un type donné contourne les quiet hours (exception sécurité).
 * Voir {@link QUIET_HOURS_OVERRIDE_TYPES}.
 */
export function isQuietHoursOverrideType(type: NotificationType): boolean {
  return QUIET_HOURS_OVERRIDE_TYPES.includes(type);
}

/**
 * Parse une chaîne `"HH:mm"` en paire d'entiers validés.
 *
 * - Rejette tout format qui n'est **pas exactement** `HH:mm` avec zéro padding.
 * - Rejette les heures ≥ 24 et les minutes ≥ 60.
 *
 * Ce parseur est aussi utilisé côté API pour valider le payload Zod : on
 * veut un rejet 400 explicite plutôt qu'un "toString" silencieux. Lever une
 * erreur plutôt que retourner `null` force l'appelant à gérer le cas.
 */
export function parseLocalTime(value: string): { hour: number; minute: number } {
  // Regex stricte : deux chiffres + deux chiffres séparés par ':'.
  const match = /^([0-9]{2}):([0-9]{2})$/.exec(value);
  if (match === null) {
    throw new Error(`Invalid local time format (expected HH:mm): ${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Local time out of range: ${value}`);
  }
  return { hour, minute };
}

/**
 * Retourne `true` si `now` tombe dans la plage quiet hours définie, en
 * respectant le fuseau IANA de l'aidant. Sinon `false`.
 *
 * Implémentation : on extrait l'heure + minute **locales** via
 * `Intl.DateTimeFormat(timezone)` (disponible nativement Node 20 full ICU et
 * Hermes avec Intl). On compare ensuite deux entiers `hourOfDay × 60 + minute`
 * dans l'intervalle `[0, 1440[`. Pas de manipulation de `Date` arithmétique
 * — le DST est entièrement géré par `Intl` (une seule minute peut être
 * sautée au passage été et doublée au passage hiver, mais le test porte
 * sur l'heure **apparente** dans le fuseau local, ce qui est précisément
 * la sémantique attendue par l'utilisateur : "entre 22h et 7h chez moi").
 *
 * Sémantique : inclusif à start, exclusif à end (cf. {@link QuietHours}).
 *
 * Fail-safe : si le fuseau est invalide, on retourne `false` (on laisse
 * passer la notification) plutôt que de lever une exception qui ferait
 * planter le dispatcher. Cette règle est préférable à un silence trop
 * large (risque de manquer une notif non critique) mais surtout évite un
 * incident de fiabilité.
 */
export function isWithinQuietHours(now: Date, quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;

  let start: { hour: number; minute: number };
  let end: { hour: number; minute: number };
  try {
    start = parseLocalTime(quietHours.startLocalTime);
    end = parseLocalTime(quietHours.endLocalTime);
  } catch {
    return false;
  }

  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  if (startMin === endMin) return false; // Plage vide.

  let localHour: number;
  let localMinute: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: quietHours.timezone,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour');
    const minutePart = parts.find((p) => p.type === 'minute');
    if (hourPart === undefined || minutePart === undefined) return false;
    // Intl renvoie parfois "24" pour minuit avec hour12=false ; normaliser.
    const rawHour = Number(hourPart.value);
    localHour = rawHour === 24 ? 0 : rawHour;
    localMinute = Number(minutePart.value);
  } catch {
    // Fuseau IANA invalide ou ICU non disponible — fail-safe.
    return false;
  }

  const nowMin = localHour * 60 + localMinute;

  if (startMin < endMin) {
    // Plage « simple » (ex: 13:00 → 17:00) : dedans si start ≤ now < end.
    return nowMin >= startMin && nowMin < endMin;
  }
  // Plage traversant minuit (ex: 22:00 → 07:00) : dedans si now ≥ start OR now < end.
  return nowMin >= startMin || nowMin < endMin;
}
