import type {
  ActivityItem,
  CaregiverView,
  HomeDashboardData,
  InhalerView,
  ScheduleSlot,
} from '@kinhale/ui/home';

// Données mockées plausibles pour le dashboard Home, calées sur la maquette
// `docs/design/handoffs/2026-04-26-clinical-calm/project/Kinhale Home.html`.
//
// **Ce fichier est temporaire** : il sera remplacé par les projections
// `@kinhale/sync` réelles (doses, pompes, aidants depuis le doc Automerge
// chiffré local) dans une PR ultérieure dédiée au wiring.
//
// Pourquoi mocker maintenant : la PR-A refonde le rendu visuel du dashboard
// pour matcher la maquette. Brancher les vraies données implique aussi de
// retoucher les flux de projection — séparer les deux changements rend la
// revue beaucoup plus simple et limite le blast radius si un bug visuel
// nécessite un revert.

const today = new Date();
function inDays(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const inhalersMock: InhalerView[] = [
  {
    id: 'i-fluticasone',
    name: 'Fluticasone 50',
    contextLabel: 'Fond · matin et soir',
    kind: 'maint',
    doses: 142,
    total: 200,
    expiry: inDays(180),
  },
  {
    id: 'i-salbu-home',
    name: 'Salbutamol 100',
    contextLabel: 'Secours · maison',
    kind: 'rescue',
    doses: 22,
    total: 200,
    expiry: inDays(38),
    isLow: true,
  },
  {
    id: 'i-salbu-daycare',
    name: 'Salbutamol 100',
    contextLabel: 'Secours · garderie',
    kind: 'rescue',
    doses: 168,
    total: 200,
    expiry: inDays(220),
  },
];

const scheduleMock: ScheduleSlot[] = [
  { label: 'Matin', time: '8h00', state: 'done' },
  { label: 'Midi', time: '12h00', state: 'pending' },
  { label: 'Soir', time: '20h00', state: 'pending' },
];

const activityMock: ActivityItem[] = [
  {
    id: 'a1',
    kind: 'maint',
    label: 'Fluticasone — 1 dose',
    who: 'Sandrine',
    time: '8h05',
    ago: 'il y a 3 h',
  },
  {
    id: 'a2',
    kind: 'rescue',
    label: 'Salbutamol — 2 doses',
    who: 'Garderie',
    time: 'hier 14h22',
    ago: 'hier',
    cause: 'Effort',
  },
];

const caregiversMock: CaregiverView[] = [
  {
    id: 'c1',
    name: 'Sandrine',
    roleLabel: 'Admin',
    initial: 'S',
    online: true,
    accentColor: 'oklch(56% 0.07 235)',
  },
  {
    id: 'c2',
    name: 'Marc',
    roleLabel: 'Co-parent',
    initial: 'M',
    online: false,
    accentColor: 'oklch(58% 0.115 35)',
  },
  {
    id: 'c3',
    name: 'Garderie',
    roleLabel: 'Restreint',
    initial: 'G',
    online: true,
    syncPending: true,
    accentColor: 'oklch(72% 0.115 75)',
  },
];

export const mockHomeData: HomeDashboardData = {
  role: 'contributor',
  time: 'on-track',
  scheduleSlots: scheduleMock,
  inhalers: inhalersMock,
  activity: activityMock,
  caregivers: caregiversMock,
};
