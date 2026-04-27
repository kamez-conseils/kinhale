import * as React from 'react';
import { Text, XStack } from 'tamagui';

import { ShieldIcon } from './icons';
import type { CaregiverRole } from './types';

const ROLE_HUE_DEG: Record<CaregiverRole, number> = {
  admin: 235, // maint slate-blue
  contributor: 200, // teal
  restricted: 145, // green
};

export interface RolePillProps {
  role: CaregiverRole;
  label: string;
  /** Padding réduit pour les listes mobiles. */
  compact?: boolean;
}

export function RolePill({ role, label, compact = false }: RolePillProps): React.JSX.Element {
  const hue = ROLE_HUE_DEG[role];
  // Couleurs dérivées du hue via `oklch` — résolues en runtime via style
  // natif, car Tamagui ne supporte pas l'interpolation d'oklch côté props.
  const fg = `oklch(40% 0.12 ${hue})`;
  const bg = `oklch(95% 0.04 ${hue})`;
  const border = `oklch(85% 0.06 ${hue})`;
  return (
    <XStack
      alignItems="center"
      gap={5}
      paddingHorizontal={compact ? 8 : 10}
      paddingVertical={compact ? 2 : 3}
      borderRadius={99}
      borderWidth={0.5}
      style={{ background: bg, borderColor: border }}
    >
      <Text style={{ color: fg }} display="flex" alignItems="center" justifyContent="center">
        <ShieldIcon size={10} color="currentColor" />
      </Text>
      <Text fontSize={11} fontWeight="600" style={{ color: fg }}>
        {label}
      </Text>
    </XStack>
  );
}
