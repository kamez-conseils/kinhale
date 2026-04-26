export { HomeDashboard } from './HomeDashboard';
export type {
  HomeDashboardData,
  HomeDashboardHandlers,
  HomeDashboardMessages,
  HomeDashboardProps,
} from './HomeDashboard';

export { HomeWebDashboard } from './HomeWebDashboard';
export type { HomeWebDashboardProps } from './HomeWebDashboard';

// Sub-components are exported for advanced consumers (Storybook, custom layouts).
export { Activity } from './Activity';
export { BottomActionBar } from './BottomActionBar';
export { Caregivers } from './Caregivers';
export { DaycareRestrictedView } from './DaycareRestrictedView';
export { Inventory } from './Inventory';
export { KinhaleHeader } from './KinhaleHeader';
export { ScheduleStrip } from './ScheduleStrip';
export { StatusHero } from './StatusHero';

export type {
  ActivityItem,
  ActivityKind,
  CaregiverRole,
  CaregiverView,
  InhalerKind,
  InhalerView,
  ScheduleSlot,
  ScheduleSlotState,
  StatusTime,
} from './types';
