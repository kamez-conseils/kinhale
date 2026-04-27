import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { Avatar } from './Avatar';
import { MoreIcon } from './icons';
import { RolePill } from './RolePill';
import type { CaregiverProfileView } from './types';

export interface CaregiverRowProps {
  caregiver: CaregiverProfileView;
  /** Libellé pastille « Vous ». */
  youLabel: string;
  /** Libellé « En ligne ». */
  onlineLabel: string;
  /** Libellé du rôle déjà localisé. */
  roleLabel: string;
  mode?: 'mobile' | 'web';
  /** Si fourni, la rangée devient cliquable (hover + onPress). */
  onPress?: ((id: string) => void) | undefined;
}

export function CaregiverRow({
  caregiver,
  youLabel,
  onlineLabel,
  roleLabel,
  mode = 'mobile',
  onPress,
}: CaregiverRowProps): React.JSX.Element {
  return (
    <XStack
      alignItems="center"
      gap={14}
      paddingHorizontal={mode === 'web' ? 16 : 14}
      paddingVertical={mode === 'web' ? 14 : 12}
      borderBottomWidth={0.5}
      borderBottomColor="$borderColor"
      cursor={onPress ? 'pointer' : 'default'}
      tag={onPress ? 'button' : 'div'}
      borderWidth={0}
      backgroundColor="transparent"
      {...(onPress ? { onPress: () => onPress(caregiver.id) } : {})}
      {...(onPress ? { hoverStyle: { backgroundColor: '$surface2' } } : {})}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Avatar
        initials={caregiver.initials}
        hue={caregiver.hue}
        size={mode === 'web' ? 44 : 40}
        online={caregiver.presence === 'online'}
      />
      <YStack flex={1} minWidth={0}>
        <XStack alignItems="center" gap={8} flexWrap="wrap">
          <Text fontSize={14.5} fontWeight="600" color="$color">
            {caregiver.name}
          </Text>
          {caregiver.isYou === true && (
            <Stack
              paddingHorizontal={8}
              paddingVertical={1}
              backgroundColor="$surface2"
              borderRadius={99}
            >
              <Text
                fontSize={10}
                fontWeight="600"
                color="$colorMuted"
                textTransform="uppercase"
                letterSpacing={0.6}
              >
                {youLabel}
              </Text>
            </Stack>
          )}
        </XStack>
        <Text fontSize={12} color="$colorMore" marginTop={2}>
          {caregiver.relation}
          {caregiver.presence === 'online' ? (
            <>
              {' · '}
              <Text color="$ok" fontWeight="500">
                {onlineLabel}
              </Text>
            </>
          ) : caregiver.lastSeenLabel !== undefined && caregiver.lastSeenLabel !== '' ? (
            <> · {caregiver.lastSeenLabel}</>
          ) : null}
        </Text>
        {mode === 'web' && caregiver.email !== undefined && caregiver.email !== '' && (
          <Text fontFamily="$mono" fontSize={11.5} color="$colorFaint" marginTop={2}>
            {caregiver.email}
          </Text>
        )}
      </YStack>
      <RolePill role={caregiver.role} label={roleLabel} compact={mode === 'mobile'} />
      <Stack
        tag="button"
        cursor="pointer"
        padding={6}
        borderWidth={0}
        backgroundColor="transparent"
        borderRadius={8}
        accessibilityRole="button"
        accessibilityLabel={`${caregiver.name} — actions`}
      >
        <Text color="$colorMore" display="flex" alignItems="center" justifyContent="center">
          <MoreIcon size={16} color="currentColor" />
        </Text>
      </Stack>
    </XStack>
  );
}
