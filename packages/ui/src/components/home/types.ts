// Shared types for the Home dashboard. Components are presentational :
// they receive `messages` (already-localised strings) and `data` props.
// The consuming page is responsible for wiring i18n + projections.

export type CaregiverRole = 'admin' | 'contributor' | 'restricted';

export type StatusTime = 'morning' | 'evening' | 'overdue' | 'on-track';

export type ScheduleSlotState = 'done' | 'pending' | 'overdue' | 'missed';

export interface ScheduleSlot {
  label: string;
  time: string;
  state: ScheduleSlotState;
  tag?: string;
}

export type InhalerKind = 'maint' | 'rescue';

export interface InhalerView {
  id: string;
  name: string;
  contextLabel: string;
  kind: InhalerKind;
  doses: number;
  total: number;
  expiry: string;
  isLow?: boolean;
}

export type ActivityKind = 'maint' | 'rescue';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  label: string;
  who: string;
  time: string;
  ago: string;
  cause?: string;
  syncNote?: string;
}

export interface CaregiverView {
  id: string;
  name: string;
  roleLabel: string;
  initial: string;
  online: boolean;
  syncPending?: boolean;
  accentColor: string;
}
