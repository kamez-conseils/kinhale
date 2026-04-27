import type { TFunction } from 'i18next';

import {
  projectCaregivers,
  projectChild,
  projectDoses,
  projectPlan,
  projectPumps,
  type KinhaleDoc,
  type ProjectedCaregiver,
  type ProjectedDose,
  type ProjectedPump,
} from '@kinhale/sync';
import type {
  ActivityItem,
  CaregiverRole,
  CaregiverView,
  HomeDashboardData,
  InhalerView,
  ScheduleSlot,
  ScheduleSlotState,
  StatusTime,
} from '@kinhale/ui/home';

// Palette de teintes (oklch) pour les pastilles aidants. Affectation
// déterministe par index pour rester stable d'un rendu à l'autre — la
// même personne garde toujours la même teinte.
const CAREGIVER_PALETTE: ReadonlyArray<string> = [
  'oklch(56% 0.07 235)', // sky
  'oklch(58% 0.115 35)', // coral
  'oklch(72% 0.115 75)', // amber
  'oklch(60% 0.10 145)', // leaf
  'oklch(60% 0.085 295)', // plum
  'oklch(58% 0.07 200)', // teal
  'oklch(58% 0.07 65)', // sand
  'oklch(58% 0.04 270)', // slate
];

// Fenêtre de tolérance autour d'une heure planifiée — réplique la logique
// `projections/reminders.ts` (5 min avant, 30 min après) pour décider si un
// créneau est confirmé/à venir/en retard.
const SLOT_WINDOW_BEFORE_MS = 5 * 60 * 1000;
const SLOT_WINDOW_AFTER_MS = 30 * 60 * 1000;

const RECENT_ACTIVITY_LIMIT = 4;
const LOW_STOCK_RATIO = 0.25;

interface BuildHomeDataInput {
  /** Document Automerge du foyer, ou `null` si non encore hydraté. */
  readonly doc: KinhaleDoc | null;
  /** Device courant — sert à calculer le rôle de l'utilisateur connecté. */
  readonly deviceId: string | null;
  /** Horloge injectée pour test pur. */
  readonly now: Date;
  /** `t()` i18next courant (namespace `common`). */
  readonly t: TFunction<'common'>;
  /** Locale BCP-47, ex. `'fr-CA'` ou `'en-CA'`. */
  readonly locale: string;
}

export interface HomeBuildResult {
  /** Données prêtes à être passées aux composants `@kinhale/ui/home`. */
  readonly data: HomeDashboardData;
  /** Prénom réel de l'enfant projeté, ou `null` si onboarding pas terminé. */
  readonly childName: string | null;
  /** Le foyer n'a encore aucune entité enregistrée → onboarding requis. */
  readonly isEmptyHousehold: boolean;
}

/**
 * Construit la projection présentationnelle complète du tableau de bord à
 * partir du document Automerge local. Pure : aucune écriture, aucun appel
 * réseau, aucun log.
 *
 * Zero-knowledge : la fonction lit uniquement les projections déjà dérivées
 * en local par `@kinhale/sync` ; aucune chaîne contenant de donnée santé
 * n'est jamais loguée. En cas de doc `null` (hydratation en cours) on
 * renvoie un état vide cohérent — le caller décide d'afficher un skeleton
 * ou l'état d'accueil onboarding via `isEmptyHousehold`.
 */
export function buildHomeDashboardData(input: BuildHomeDataInput): HomeBuildResult {
  const { doc, deviceId, now, t, locale } = input;

  if (doc === null) {
    return {
      data: emptyData(),
      childName: null,
      isEmptyHousehold: true,
    };
  }

  const child = projectChild(doc);
  const pumps = projectPumps(doc);
  const doses = projectDoses(doc);
  const caregivers = projectCaregivers(doc);
  const plan = projectPlan(doc);

  const isEmptyHousehold = pumps.length === 0 && doses.length === 0 && caregivers.length === 0;

  const role = deriveRole(caregivers, deviceId);
  const inhalers = pumps.map((p) => projectedPumpToInhalerView(p, t));
  const scheduleSlots = buildScheduleSlots(plan, doses, now, t);
  const activity = buildActivity(doses, caregivers, deviceId, now, t, locale);
  const caregiverViews = buildCaregivers(caregivers, deviceId, t);
  const time = deriveStatusTime(scheduleSlots);

  return {
    data: {
      role,
      time,
      scheduleSlots,
      inhalers,
      activity,
      caregivers: caregiverViews,
    },
    childName: child?.firstName ?? null,
    isEmptyHousehold,
  };
}

function emptyData(): HomeDashboardData {
  return {
    role: 'contributor',
    time: 'on-track',
    scheduleSlots: [],
    inhalers: [],
    activity: [],
    caregivers: [],
  };
}

/**
 * Mappe un rôle backend (`admin` | `contributor` | `restricted_contributor`)
 * vers le rôle d'affichage attendu par le composant Home.
 *
 * `restricted_contributor` (garderie) → `restricted` (vue dédiée
 * `DaycareRestrictedView`). Tout rôle inconnu retombe sur `contributor`
 * (par défaut le moins privilégié non restreint).
 */
function deriveRole(
  caregivers: ReadonlyArray<ProjectedCaregiver>,
  deviceId: string | null,
): CaregiverRole {
  if (deviceId === null) return 'contributor';
  const me = caregivers.find((c) => c.caregiverId === deviceId);
  if (me === undefined) return 'contributor';
  if (me.role === 'admin') return 'admin';
  if (me.role === 'restricted_contributor' || me.role === 'restricted') return 'restricted';
  return 'contributor';
}

function projectedPumpToInhalerView(p: ProjectedPump, t: TFunction<'common'>): InhalerView {
  const isMaint = p.pumpType === 'maintenance';
  const contextLabel = isMaint
    ? t('home.dashboard.context.maint')
    : t('home.dashboard.context.rescue');
  // expiry encodée en chaîne ISO ; `''` = expiration inconnue. Le
  // formatter (`messages.ts > formatExpiryStatus`) interprète la chaîne
  // vide comme « inconnue » sans tenter de la parser.
  const expiry = p.expiresAtMs !== null ? new Date(p.expiresAtMs).toISOString() : '';
  const isLow = p.totalDoses > 0 && p.dosesRemaining <= Math.floor(p.totalDoses * LOW_STOCK_RATIO);
  return {
    id: p.pumpId,
    name: p.name,
    contextLabel,
    kind: isMaint ? 'maint' : 'rescue',
    doses: p.dosesRemaining,
    total: p.totalDoses,
    expiry,
    ...(isLow ? { isLow: true } : {}),
  };
}

interface BuiltSlot extends ScheduleSlot {
  readonly targetMs: number;
}

function buildScheduleSlots(
  plan: ReturnType<typeof projectPlan>,
  doses: ReadonlyArray<ProjectedDose>,
  now: Date,
  t: TFunction<'common'>,
): ScheduleSlot[] {
  if (plan === null) return [];

  const nowMs = now.getTime();

  // Bornes UTC du jour courant (locale machine — l'app vise des foyers
  // sédentaires, on aligne sur le fuseau de l'utilisateur, pas UTC strict).
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const slots: BuiltSlot[] = [];
  for (const hour of plan.scheduledHoursUtc) {
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    const target = new Date(startOfDay);
    // `scheduledHoursUtc` stocke des heures UTC entières — on convertit
    // vers le fuseau local pour l'affichage, sans décaler le createur de
    // la dose côté domaine (RM2 raisonne en UTC pour la matérialisation).
    target.setUTCHours(Math.floor(hour), 0, 0, 0);
    const targetMs = target.getTime();
    if (targetMs < startOfDay.getTime() || targetMs > endOfDay.getTime()) continue;

    const state = computeSlotState({
      plan,
      doses,
      targetMs,
      nowMs,
    });

    const time = formatHourMinute(target);
    slots.push({
      label: labelForHour(target.getHours(), t),
      time,
      state,
      targetMs,
    });
  }

  // Tri chronologique pour un affichage stable matin → soir.
  slots.sort((a, b) => a.targetMs - b.targetMs);
  // On strippe `targetMs` (interne, utilisé pour le tri) avant de retourner :
  // il ne fait pas partie du contrat `ScheduleSlot`.
  return slots.map((s) => ({ label: s.label, time: s.time, state: s.state }));
}

function computeSlotState({
  plan,
  doses,
  targetMs,
  nowMs,
}: {
  plan: NonNullable<ReturnType<typeof projectPlan>>;
  doses: ReadonlyArray<ProjectedDose>;
  targetMs: number;
  nowMs: number;
}): ScheduleSlotState {
  const windowStart = targetMs - SLOT_WINDOW_BEFORE_MS;
  const windowEnd = targetMs + SLOT_WINDOW_AFTER_MS;

  const confirmed = doses.some(
    (d) =>
      d.status !== 'voided' &&
      d.doseType === 'maintenance' &&
      d.pumpId === plan.pumpId &&
      d.administeredAtMs >= windowStart &&
      d.administeredAtMs <= windowEnd,
  );
  if (confirmed) return 'done';
  if (nowMs < windowStart) return 'pending';
  if (nowMs <= windowEnd) return 'overdue';
  return 'missed';
}

function labelForHour(hour24: number, t: TFunction<'common'>): string {
  // Libellé court (Matin / Midi / Après-midi / Soir / Nuit) lu en plus du
  // `time` (HH:MM) qui reste l'info principale. Mêmes seuils que
  // `lib/journal/messages.ts > slotForHour` pour rester cohérent entre
  // dashboard et historique.
  if (hour24 < 5 || hour24 >= 21) return t('home.dashboard.slot.night');
  if (hour24 < 12) return t('home.dashboard.slot.morning');
  if (hour24 < 14) return t('home.dashboard.slot.noon');
  if (hour24 < 18) return t('home.dashboard.slot.afternoon');
  return t('home.dashboard.slot.evening');
}

function formatHourMinute(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildActivity(
  doses: ReadonlyArray<ProjectedDose>,
  caregivers: ReadonlyArray<ProjectedCaregiver>,
  deviceId: string | null,
  now: Date,
  t: TFunction<'common'>,
  locale: string,
): ActivityItem[] {
  // `projectDoses` retourne déjà trié par administeredAtMs décroissant.
  // On filtre les voided pour ne pas polluer l'aperçu d'accueil.
  const visible = doses.filter((d) => d.status !== 'voided').slice(0, RECENT_ACTIVITY_LIMIT);

  return visible.map((d) => {
    const isRescue = d.doseType === 'rescue';
    const label =
      d.doseType === 'maintenance'
        ? t('home.dashboard.activity.maintLabel', { count: d.dosesAdministered })
        : t('home.dashboard.activity.rescueLabel', { count: d.dosesAdministered });
    const item: ActivityItem = {
      id: d.doseId,
      kind: isRescue ? 'rescue' : 'maint',
      label,
      who: aliasFor(d.caregiverId, caregivers, deviceId, t),
      time: formatLocalTime(d.administeredAtMs, locale),
      ago: formatRelative(d.administeredAtMs, now, t),
    };
    if (isRescue && d.circumstances.length > 0) {
      const first = d.circumstances[0];
      if (typeof first === 'string' && first.length > 0) {
        item.cause = t(`journal.circumstance.${first}`, { defaultValue: first });
      }
    }
    if (d.status === 'pending_review') {
      item.syncNote = t('home.dashboard.syncPendingLabel');
    }
    return item;
  });
}

function aliasFor(
  caregiverId: string,
  caregivers: ReadonlyArray<ProjectedCaregiver>,
  deviceId: string | null,
  t: TFunction<'common'>,
): string {
  if (deviceId !== null && caregiverId === deviceId) {
    return t('home.dashboard.actor.you');
  }
  const found = caregivers.find((c) => c.caregiverId === caregiverId);
  if (found !== undefined && found.displayName.length > 0) {
    return found.displayName;
  }
  return t('home.dashboard.actor.unknown');
}

function formatLocalTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function formatRelative(ms: number, now: Date, t: TFunction<'common'>): string {
  const deltaMs = now.getTime() - ms;
  // Futur (ex. édition d'horodatage) → on retombe sur "à l'instant" plutôt
  // que d'afficher une valeur négative déroutante.
  if (deltaMs < 0) return t('home.dashboard.ago.justNow');
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return t('home.dashboard.ago.justNow');
  if (minutes < 60) return t('home.dashboard.ago.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('home.dashboard.ago.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 2) return t('home.dashboard.ago.yesterday');
  return t('home.dashboard.ago.days', { count: days });
}

function buildCaregivers(
  caregivers: ReadonlyArray<ProjectedCaregiver>,
  deviceId: string | null,
  t: TFunction<'common'>,
): CaregiverView[] {
  return caregivers.map((c, i) => {
    const isMe = deviceId !== null && c.caregiverId === deviceId;
    const accent =
      CAREGIVER_PALETTE[i % CAREGIVER_PALETTE.length] ?? CAREGIVER_PALETTE[0] ?? 'oklch(58% 0 0)';
    const initial = (c.displayName.length > 0 ? c.displayName : t('home.dashboard.actor.unknown'))
      .trim()
      .slice(0, 1)
      .toUpperCase();
    return {
      id: c.caregiverId,
      name: isMe ? t('home.dashboard.actor.you') : c.displayName,
      roleLabel: roleLabel(c.role, t),
      initial: initial.length > 0 ? initial : '·',
      // Sans channel WS dédié on ne peut pas afficher de présence — on
      // marque tout le monde "online: false" pour rester honnête. Le dot
      // gris est neutre et le label sous l'avatar reste informatif.
      online: false,
      accentColor: accent,
    };
  });
}

function roleLabel(role: string, t: TFunction<'common'>): string {
  if (role === 'admin') return t('auth.role.admin');
  if (role === 'restricted_contributor' || role === 'restricted') {
    return t('auth.role.restricted');
  }
  return t('auth.role.contributor');
}

/**
 * Heuristique de hero : on prend le premier slot **non confirmé** du jour.
 * - aucun → `on-track` (rien à faire)
 * - `overdue` ou `missed` → `overdue` (rouge/ambre, "confirmez la dose")
 * - `pending` futur → `evening` (bleu, "prise prévue")
 * - `done` (tous confirmés) → `on-track`
 *
 * On ne distingue pas matin/soir au niveau du hero — la maquette
 * clinical-calm utilise `evening` comme variante "à venir" et `morning`
 * n'est plus rendu spécifiquement (cf. StatusHero qui retombe sur
 * `on-track` pour `morning`).
 */
function deriveStatusTime(slots: ReadonlyArray<ScheduleSlot>): StatusTime {
  if (slots.length === 0) return 'on-track';
  const allDone = slots.every((s) => s.state === 'done');
  if (allDone) return 'on-track';
  const hasOverdue = slots.some((s) => s.state === 'overdue' || s.state === 'missed');
  if (hasOverdue) return 'overdue';
  // Au moins un slot en attente → cible bleu calme « à venir ».
  return 'evening';
}
