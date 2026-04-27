import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import type { FeedDay as FeedDayData, FeedEntry, FeedEntryState } from './types';

interface MarkerLabels {
  voided: string;
  pendingReview: string;
  backfill: string;
  missed: string;
}

interface BadgeTone {
  bg: string;
  fg: string;
}

const MARKER_TONE: Record<FeedEntryState, BadgeTone | null> = {
  done: null,
  missed: { bg: '$missSoft', fg: '$colorMore' },
  voided: { bg: '$missSoft', fg: '$colorMore' },
  pendingReview: { bg: '$amberSoft', fg: '$amberInk' },
  backfill: { bg: '$maintSoft', fg: '$maintInk' },
};

function markerLabel(state: FeedEntryState, labels: MarkerLabels): string | null {
  switch (state) {
    case 'done':
      return null;
    case 'missed':
      return labels.missed;
    case 'voided':
      return labels.voided;
    case 'pendingReview':
      return labels.pendingReview;
    case 'backfill':
      return labels.backfill;
  }
}

export interface FeedDayCardProps {
  data: FeedDayData;
  pillFond: string;
  pillSecours: string;
  formatBy: (who: string) => string;
  markers: MarkerLabels;
  onPressEntry?: ((id: string) => void) | undefined;
}

export function FeedDayCard({
  data,
  pillFond,
  pillSecours,
  formatBy,
  markers,
  onPressEntry,
}: FeedDayCardProps): React.JSX.Element {
  return (
    <YStack marginBottom={18}>
      <Text
        tag="h3"
        margin={0}
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
        marginBottom={6}
      >
        {data.label}
      </Text>
      <YStack
        backgroundColor="$surface"
        borderRadius={14}
        borderWidth={0.5}
        borderColor="$borderColor"
        overflow="hidden"
      >
        {data.entries.map((entry, i) => (
          <FeedEntryRow
            key={entry.id}
            entry={entry}
            isFirst={i === 0}
            pillFond={pillFond}
            pillSecours={pillSecours}
            formatBy={formatBy}
            markers={markers}
            {...(onPressEntry ? { onPress: () => onPressEntry(entry.id) } : {})}
          />
        ))}
      </YStack>
    </YStack>
  );
}

interface FeedEntryRowProps {
  entry: FeedEntry;
  isFirst: boolean;
  pillFond: string;
  pillSecours: string;
  formatBy: (who: string) => string;
  markers: MarkerLabels;
  onPress?: (() => void) | undefined;
}

function FeedEntryRow({
  entry,
  isFirst,
  pillFond,
  pillSecours,
  formatBy,
  markers,
  onPress,
}: FeedEntryRowProps): React.JSX.Element {
  const isRescue = entry.kind === 'rescue';
  const isStruck = entry.state === 'voided' || entry.state === 'missed';
  const opacity = isStruck ? 0.6 : 1;
  const tone = MARKER_TONE[entry.state];
  const marker = markerLabel(entry.state, markers);

  return (
    <XStack
      tag={onPress ? 'button' : 'div'}
      cursor={onPress ? 'pointer' : 'default'}
      borderWidth={0}
      backgroundColor="transparent"
      alignItems="center"
      gap={12}
      paddingHorizontal={14}
      paddingVertical={12}
      borderTopWidth={isFirst ? 0 : 0.5}
      borderTopColor="$borderColor"
      opacity={opacity}
      {...(onPress ? { onPress } : {})}
      {...(onPress ? { hoverStyle: { backgroundColor: '$surface2' } } : {})}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text
        width={32}
        height={32}
        borderRadius={9}
        backgroundColor={isRescue ? '$rescueSoft' : '$maintSoft'}
        color={isRescue ? '$rescue' : '$maint'}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        display="flex"
      >
        {isRescue ? (
          <InhalerRescueIcon size={17} color="currentColor" />
        ) : (
          <InhalerMaintIcon size={17} color="currentColor" />
        )}
      </Text>
      <YStack flex={1} minWidth={0}>
        <XStack alignItems="baseline" gap={8} flexWrap="wrap">
          <Text
            fontSize={13.5}
            fontWeight="500"
            color="$color"
            style={{
              textDecoration: isStruck ? 'line-through' : 'none',
            }}
          >
            {isRescue ? pillSecours : pillFond} · {entry.slot}
          </Text>
          {entry.cause !== undefined && entry.cause !== '' && (
            <Stack
              paddingHorizontal={7}
              paddingVertical={2}
              backgroundColor="$rescueSoft"
              borderRadius={99}
            >
              <Text
                fontSize={10}
                fontWeight="600"
                color="$rescueInk"
                textTransform="uppercase"
                letterSpacing={0.4}
              >
                {entry.cause}
              </Text>
            </Stack>
          )}
          {marker !== null && tone !== null && (
            <Stack
              paddingHorizontal={7}
              paddingVertical={2}
              backgroundColor={tone.bg as never}
              borderRadius={99}
            >
              <Text
                fontSize={10}
                fontWeight="600"
                color={tone.fg as never}
                textTransform="uppercase"
                letterSpacing={0.4}
              >
                {marker}
              </Text>
            </Stack>
          )}
        </XStack>
        <Text fontSize={11.5} color="$colorMore" marginTop={2}>
          {formatBy(entry.who)}
          {entry.note !== undefined && entry.note !== '' && (
            <Text fontStyle="italic" color="$colorMore">
              {' · '}
              {entry.note}
            </Text>
          )}
        </Text>
      </YStack>
      <Text
        fontFamily="$mono"
        fontSize={12}
        color="$colorMore"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {entry.time}
      </Text>
    </XStack>
  );
}
