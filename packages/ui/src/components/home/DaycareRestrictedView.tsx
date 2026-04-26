import * as React from 'react';
import { Stack, Text, YStack } from 'tamagui';

import { CheckIcon, ClockIcon, InhalerMaintIcon } from '../../icons';

interface DaycareRestrictedViewProps {
  childName: string;
  sectionLabel: string;
  promptLabel: string;
  doneLabel: string;
  buttonLabel: string;
  sessionLabel: string;
  disclaimer: string;
  onPressGiven?: (() => void) | undefined;
}

export function DaycareRestrictedView({
  childName,
  sectionLabel,
  promptLabel,
  doneLabel,
  buttonLabel,
  sessionLabel,
  disclaimer,
  onPressGiven,
}: DaycareRestrictedViewProps): React.JSX.Element {
  const [given, setGiven] = React.useState(false);

  const handlePress = (): void => {
    setGiven(true);
    onPressGiven?.();
  };

  return (
    <YStack flex={1} padding="$4" gap="$3.5">
      <YStack
        padding="$4"
        backgroundColor="$surface"
        borderRadius={20}
        borderWidth={0.5}
        borderColor="$borderColor"
      >
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing="0.08em"
          fontWeight="600"
        >
          {sectionLabel}
        </Text>
        <Text
          fontSize={24}
          lineHeight={28}
          marginTop={8}
          fontWeight="500"
          color="$color"
          letterSpacing="-0.02em"
        >
          {childName}
        </Text>
        <Text fontSize={13} color="$colorMuted" marginTop={4}>
          {given ? doneLabel : promptLabel}
        </Text>
      </YStack>

      <Stack
        backgroundColor={given ? '$okSoft' : '$maint'}
        borderRadius={20}
        paddingVertical="$6"
        paddingHorizontal="$4"
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        gap="$3"
        minHeight={96}
        cursor={given ? 'default' : 'pointer'}
        {...(given ? {} : { pressStyle: { opacity: 0.9 }, onPress: handlePress })}
        accessibilityRole="button"
        accessibilityLabel={given ? doneLabel : buttonLabel}
        accessibilityState={{ disabled: given }}
      >
        <Stack
          width={44}
          height={44}
          borderRadius={12}
          backgroundColor={given ? '$ok' : 'rgba(255,255,255,0.18)'}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {given ? (
            <CheckIcon size={22} color="white" />
          ) : (
            <InhalerMaintIcon size={24} color="white" />
          )}
        </Stack>
        <Text
          fontSize={20}
          fontWeight="500"
          color={given ? '$okInk' : 'white'}
          letterSpacing="-0.02em"
        >
          {given ? doneLabel : buttonLabel}
        </Text>
      </Stack>

      <Text
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        gap="$2"
        color="$colorMore"
        display="flex"
      >
        <ClockIcon size={12} color="currentColor" />
        <Text fontSize={12} color="$colorMore">
          {sessionLabel}
        </Text>
      </Text>

      <YStack flex={1} />

      <Text fontSize={11} color="$colorFaint" textAlign="center" fontStyle="italic">
        {disclaimer}
      </Text>
    </YStack>
  );
}
