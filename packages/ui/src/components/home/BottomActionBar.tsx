import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';

interface BottomActionBarProps {
  /** Section subtitle ("Log a dose"). */
  caption: string;
  maintLabel: string;
  rescueLabel: string;
  onPressMaint?: (() => void) | undefined;
  onPressRescue?: (() => void) | undefined;
}

export function BottomActionBar({
  caption,
  maintLabel,
  rescueLabel,
  onPressMaint,
  onPressRescue,
}: BottomActionBarProps): React.JSX.Element {
  return (
    <YStack
      // `position: sticky` n'existe pas en RN ; on passe par style natif côté
      // web. Sur mobile, le bar reste juste en bas du flux normal — le scroll
      // du parent ScrollView gère l'effet attendu.
      style={{ position: 'sticky' }}
      bottom={0}
      left={0}
      right={0}
      zIndex={30}
      paddingHorizontal="$4"
      paddingTop="$2.5"
      paddingBottom="$5"
      backgroundColor="$background"
      borderTopWidth={0.5}
      borderTopColor="$borderColor"
    >
      <Text
        fontSize={10}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing="0.08em"
        fontWeight="600"
        textAlign="center"
        marginBottom="$2"
      >
        {caption}
      </Text>
      <XStack gap="$2.5">
        {/* Maintenance button (filled accent) */}
        <Stack
          flex={1}
          backgroundColor="$maint"
          borderRadius={20}
          paddingVertical="$3.5"
          paddingHorizontal="$2.5"
          alignItems="center"
          justifyContent="center"
          minHeight={76}
          cursor="pointer"
          pressStyle={{ opacity: 0.85 }}
          onPress={onPressMaint}
          accessibilityRole="button"
          accessibilityLabel={maintLabel}
        >
          <Stack
            width={38}
            height={38}
            borderRadius={12}
            backgroundColor="rgba(255,255,255,0.18)"
            alignItems="center"
            justifyContent="center"
            marginBottom="$1.5"
          >
            <InhalerMaintIcon size={26} color="white" />
          </Stack>
          <Text fontSize={13} fontWeight="600" color="white" letterSpacing="0.01em">
            {maintLabel}
          </Text>
        </Stack>

        {/* Rescue button (outline) */}
        <Stack
          flex={1}
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$rescue"
          borderRadius={20}
          paddingVertical="$3.5"
          paddingHorizontal="$2.5"
          alignItems="center"
          justifyContent="center"
          minHeight={76}
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={onPressRescue}
          accessibilityRole="button"
          accessibilityLabel={rescueLabel}
        >
          <Text
            width={38}
            height={38}
            borderRadius={12}
            backgroundColor="$rescueSoft"
            alignItems="center"
            justifyContent="center"
            marginBottom="$1.5"
            color="$rescue"
            display="flex"
          >
            <InhalerRescueIcon size={26} color="currentColor" />
          </Text>
          <Text fontSize={13} fontWeight="600" color="$rescue" letterSpacing="0.01em">
            {rescueLabel}
          </Text>
        </Stack>
      </XStack>
    </YStack>
  );
}
