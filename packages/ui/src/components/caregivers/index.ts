export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { CaregiverRow } from './CaregiverRow';
export type { CaregiverRowProps } from './CaregiverRow';

export { CaregiversListMobile } from './CaregiversListMobile';
export type { CaregiversListMobileProps } from './CaregiversListMobile';

export { CaregiversListWeb } from './CaregiversListWeb';
export type { CaregiversListWebProps } from './CaregiversListWeb';

export { CaregiversSidebar } from './CaregiversSidebar';
export type { CaregiversSidebarProps } from './CaregiversSidebar';

export { InviteForm } from './InviteForm';
export type { InviteFormProps } from './InviteForm';

export { PendingRow } from './PendingRow';
export type { PendingRowProps } from './PendingRow';

export { PermsTable } from './PermsTable';
export type { PermsTableProps } from './PermsTable';

export { RolePill } from './RolePill';
export type { RolePillProps } from './RolePill';

// `CaregiverRole` est délibérément non re-exporté ici : le module
// `home` exporte déjà ce type (même union `'admin' | 'contributor' |
// 'restricted'`) et la dé-duplication via `export *` côté `src/index.ts`
// causerait une ambiguïté TS. Les consommateurs font
// `import type { CaregiverRole } from '@kinhale/ui/home'` ou
// `from '@kinhale/ui/caregivers/types'` selon leur point d'entrée.
export type {
  CaregiverPresence,
  CaregiverProfileView,
  CaregiversListHandlers,
  CaregiversListMessages,
  CaregiversNavItem,
  InviteFormHandlers,
  InviteFormMessages,
  InviteFormState,
  PendingInvitationStage,
  PendingInvitationView,
} from './types';
