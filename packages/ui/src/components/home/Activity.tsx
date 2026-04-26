import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { ArrowRightIcon, InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import { Section } from './Section';
import { SectionHeader } from './SectionHeader';
import type { ActivityItem } from './types';

interface ActivityProps {
  title: string;
  items: ActivityItem[];
  /** Localised "by {name}" template used on each row. */
  formatBy: (name: string) => string;
  historyLabel: string;
  onPressHistory?: (() => void) | undefined;
  emptyState?: React.ReactNode;
}

export function Activity({
  title,
  items,
  formatBy,
  historyLabel,
  onPressHistory,
  emptyState,
}: ActivityProps): React.JSX.Element {
  return (
    <Section>
      <SectionHeader
        label={title}
        action={
          <XStack
            gap="$1"
            alignItems="center"
            cursor="pointer"
            {...(onPressHistory ? { onPress: onPressHistory } : {})}
          >
            <Text fontSize={12} color="$maint" fontWeight="500">
              {historyLabel}
            </Text>
            <Text color="$maint" display="flex" alignItems="center">
              <ArrowRightIcon size={11} color="currentColor" />
            </Text>
          </XStack>
        }
      />

      {items.length === 0 && emptyState}

      <YStack>
        {items.map((it, i) => {
          const isRescue = it.kind === 'rescue';
          return (
            <XStack
              key={it.id}
              gap="$3"
              alignItems="center"
              paddingVertical="$2.5"
              borderTopWidth={i === 0 ? 0 : 0.5}
              borderTopColor="$borderColor"
            >
              <Text
                width={28}
                height={28}
                borderRadius={8}
                backgroundColor={isRescue ? '$rescueSoft' : '$maintSoft'}
                color={isRescue ? '$rescue' : '$maint'}
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
                display="flex"
              >
                {isRescue ? (
                  <InhalerRescueIcon size={15} color="currentColor" />
                ) : (
                  <InhalerMaintIcon size={15} color="currentColor" />
                )}
              </Text>

              <YStack flex={1} minWidth={0}>
                <XStack alignItems="baseline" gap="$1.5" flexWrap="wrap">
                  <Text fontSize={13.5} color="$color" fontWeight="500">
                    {it.label}
                  </Text>
                  {it.cause && (
                    <Stack
                      paddingHorizontal="$1.5"
                      paddingVertical={1}
                      backgroundColor="$rescueSoft"
                      borderRadius={9999}
                    >
                      <Text fontSize={11} color="$rescueInk" fontWeight="500">
                        {it.cause}
                      </Text>
                    </Stack>
                  )}
                </XStack>
                <Text fontSize={12} color="$colorMore" marginTop={2}>
                  {formatBy(it.who)} · {it.ago}
                  {it.syncNote ? ` · ${it.syncNote}` : ''}
                </Text>
              </YStack>

              <Text fontSize={12} color="$colorMore" fontFamily="$mono">
                {it.time}
              </Text>
            </XStack>
          );
        })}
      </YStack>
    </Section>
  );
}
