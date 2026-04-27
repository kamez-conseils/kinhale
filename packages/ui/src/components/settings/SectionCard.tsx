import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { BellIcon, InfoIcon, PaintIcon, ShieldIcon } from './icons';
import type { SettingsSectionIcon } from './types';

interface IconRendererProps {
  size?: number;
  color?: string;
}

const ICONS: Record<SettingsSectionIcon, React.FC<IconRendererProps>> = {
  bell: BellIcon,
  paint: PaintIcon,
  shield: ShieldIcon,
  info: InfoIcon,
};

export interface SectionCardProps {
  icon: SettingsSectionIcon;
  /** Titre uppercase letterspacé. */
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ icon, title, children }: SectionCardProps): React.JSX.Element {
  const IconComponent = ICONS[icon];
  return (
    <YStack>
      <XStack alignItems="center" gap={8} paddingHorizontal={18} paddingTop={14} paddingBottom={10}>
        <Stack
          width={22}
          height={22}
          borderRadius={6}
          alignItems="center"
          justifyContent="center"
          style={{
            background: 'color-mix(in oklch, var(--maint) 14%, var(--surface))',
          }}
        >
          <Text color="$maint" display="flex" alignItems="center" justifyContent="center">
            <IconComponent size={13} color="currentColor" />
          </Text>
        </Stack>
        <Text
          tag="h2"
          margin={0}
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
        >
          {title}
        </Text>
      </XStack>
      <YStack
        backgroundColor="$surface"
        borderRadius={14}
        borderWidth={0.5}
        borderColor="$borderColor"
        overflow="hidden"
      >
        {children}
      </YStack>
    </YStack>
  );
}
