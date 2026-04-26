import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { Section } from './Section';
import { SectionHeader } from './SectionHeader';
import type { ScheduleSlot, ScheduleSlotState } from './types';

interface ScheduleStripProps {
  title: string;
  slots: ScheduleSlot[];
  /** Localised state labels. */
  stateLabels: Record<ScheduleSlotState, string>;
}

interface SlotPalette {
  dot: string;
  ring: string;
  ink: string;
}

const palettes: Record<ScheduleSlotState, SlotPalette> = {
  done: { dot: '$ok', ring: '$okSoft', ink: '$okInk' },
  pending: { dot: '$maint', ring: '$maintSoft', ink: '$maintInk' },
  overdue: { dot: '$amber', ring: '$amberSoft', ink: '$amberInk' },
  missed: { dot: '$miss', ring: '$missSoft', ink: '$colorMore' },
};

export function ScheduleStrip({
  title,
  slots,
  stateLabels,
}: ScheduleStripProps): React.JSX.Element {
  return (
    <Section>
      <SectionHeader label={title} />
      <XStack gap="$2">
        {slots.map((slot, i) => {
          const palette = palettes[slot.state];
          return (
            <YStack
              key={`${slot.label}-${i}`}
              flex={1}
              gap="$1.5"
              padding="$2.5"
              backgroundColor="$surface2"
              borderRadius={10}
              borderWidth={0.5}
              borderColor="$borderColor"
              minHeight={78}
            >
              <Text
                fontSize={11}
                color="$colorMore"
                textTransform="uppercase"
                letterSpacing="0.08em"
                fontWeight="500"
              >
                {slot.label}
              </Text>
              <Text fontSize={16} fontWeight="500" color="$color" fontFamily="$mono">
                {slot.time}
              </Text>
              <XStack alignItems="center" gap="$1.5" marginTop="auto">
                <Stack
                  width={12}
                  height={12}
                  borderRadius={9999}
                  backgroundColor={palette.ring}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Stack width={6} height={6} borderRadius={9999} backgroundColor={palette.dot} />
                </Stack>
                <Text fontSize={11} color={palette.ink} fontWeight="500">
                  {stateLabels[slot.state]}
                </Text>
              </XStack>
            </YStack>
          );
        })}
      </XStack>
    </Section>
  );
}
