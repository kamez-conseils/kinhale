import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { ChevronIcon } from './icons';
import type { ChildProfileSummary } from './types';

export interface ChildProfileCardProps {
  child: ChildProfileSummary;
  /** Libellé `aria-label` pour le bouton « Modifier le profil ». */
  editLabel: string;
  mode?: 'mobile' | 'web';
  onPressEdit?: (() => void) | undefined;
}

export function ChildProfileCard({
  child,
  editLabel,
  mode = 'mobile',
  onPressEdit,
}: ChildProfileCardProps): React.JSX.Element {
  const avatarSize = mode === 'web' ? 56 : 48;
  return (
    <XStack
      alignItems="center"
      gap={14}
      paddingHorizontal={mode === 'web' ? 22 : 18}
      paddingVertical={mode === 'web' ? 20 : 18}
      backgroundColor="$surface"
      borderRadius={16}
      borderWidth={0.5}
      borderColor="$borderColor"
      marginBottom={14}
    >
      <Stack
        width={avatarSize}
        height={avatarSize}
        borderRadius={avatarSize / 2}
        alignItems="center"
        justifyContent="center"
        style={{
          background: `oklch(85% 0.06 ${child.hue})`,
        }}
      >
        <Text
          fontSize={mode === 'web' ? 20 : 18}
          fontWeight="600"
          style={{ color: `oklch(35% 0.10 ${child.hue})` }}
        >
          {child.initial}
        </Text>
      </Stack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={mode === 'web' ? 17 : 15} fontWeight="600" color="$color">
          {child.name}
        </Text>
        <Text fontSize={12.5} color="$colorMore" marginTop={2} numberOfLines={2}>
          {child.details.join(' · ')}
        </Text>
      </YStack>
      <Stack
        tag="button"
        cursor="pointer"
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColorStrong"
        paddingHorizontal={12}
        paddingVertical={6}
        borderRadius={99}
        accessibilityRole="button"
        accessibilityLabel={editLabel}
        testID="settings-edit-profile"
        {...(onPressEdit ? { onPress: onPressEdit } : {})}
      >
        <Text color="$colorMuted" display="flex" alignItems="center" justifyContent="center">
          <ChevronIcon size={12} color="currentColor" />
        </Text>
      </Stack>
    </XStack>
  );
}
