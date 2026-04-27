import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import type { RescueEventView } from './types';

export interface RescueEventsListProps {
  events: ReadonlyArray<RescueEventView>;
  /** Préfixe « min » pour la durée de soulagement. */
  reliefSuffix: string;
  /** Empty state. */
  emptyTitle: string;
  emptySub: string;
  mode?: 'mobile' | 'web';
  onPressEvent?: ((id: string) => void) | undefined;
}

export function RescueEventsList({
  events,
  reliefSuffix,
  emptyTitle,
  emptySub,
  mode = 'web',
  onPressEvent,
}: RescueEventsListProps): React.JSX.Element {
  if (events.length === 0) {
    return (
      <YStack
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColor"
        borderRadius={14}
        padding={24}
        alignItems="center"
        gap={6}
      >
        <Text fontFamily="$heading" fontSize={16} fontWeight="500" color="$color">
          {emptyTitle}
        </Text>
        <Text fontSize={12.5} color="$colorMore" textAlign="center">
          {emptySub}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={0.5}
      borderColor="$borderColor"
      borderRadius={14}
      overflow="hidden"
    >
      {events.map((ev, i) => (
        <RescueRow
          key={ev.id}
          event={ev}
          isFirst={i === 0}
          reliefSuffix={reliefSuffix}
          mode={mode}
          {...(onPressEvent ? { onPress: () => onPressEvent(ev.id) } : {})}
        />
      ))}
    </YStack>
  );
}

interface RescueRowProps {
  event: RescueEventView;
  isFirst: boolean;
  reliefSuffix: string;
  mode: 'mobile' | 'web';
  onPress?: (() => void) | undefined;
}

function RescueRow({
  event,
  isFirst,
  reliefSuffix,
  mode,
  onPress,
}: RescueRowProps): React.JSX.Element {
  const showRelief = mode === 'web' && event.reliefMinutes !== undefined;
  return (
    <Stack
      tag={onPress ? 'button' : 'div'}
      cursor={onPress ? 'pointer' : 'default'}
      backgroundColor="transparent"
      borderWidth={0}
      borderTopWidth={isFirst ? 0 : 0.5}
      borderTopColor="$borderColor"
      paddingHorizontal={mode === 'web' ? 18 : 14}
      paddingVertical={mode === 'web' ? 14 : 12}
      {...(onPress ? { onPress } : {})}
      {...(onPress ? { hoverStyle: { backgroundColor: '$surface2' } } : {})}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: mode === 'web' ? '78px 1fr 100px' : '60px 1fr',
        gap: mode === 'web' ? 16 : 8,
        alignItems: 'center',
      }}
    >
      <YStack>
        <Text fontSize={13} fontWeight="600" color="$color">
          {event.date}
        </Text>
        <Text
          fontFamily="$mono"
          fontSize={11}
          color="$colorMore"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {event.time}
        </Text>
      </YStack>
      <YStack minWidth={0}>
        <XStack alignItems="center" gap={8} flexWrap="wrap">
          <Stack
            paddingHorizontal={8}
            paddingVertical={2}
            borderRadius={99}
            backgroundColor="$rescueSoft"
          >
            <Text
              fontSize={10}
              fontWeight="600"
              color="$rescueInk"
              textTransform="uppercase"
              letterSpacing={0.4}
            >
              {event.cause}
            </Text>
          </Stack>
          <Text fontSize={11.5} color="$colorMore">
            · {event.who}
          </Text>
        </XStack>
        {event.note !== undefined && event.note !== '' && (
          <Text
            fontSize={12.5}
            color="$colorMuted"
            marginTop={4}
            fontStyle="italic"
            lineHeight={18}
          >
            « {event.note} »
          </Text>
        )}
      </YStack>
      {showRelief && event.reliefMinutes !== undefined && (
        <YStack alignSelf="center" alignItems="flex-end">
          <Text
            fontFamily="$mono"
            fontSize={13}
            fontWeight="600"
            color="$color"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {event.reliefMinutes}
            <Text fontWeight="400" color="$colorMore">
              {' '}
              {reliefSuffix}
            </Text>
          </Text>
        </YStack>
      )}
    </Stack>
  );
}
