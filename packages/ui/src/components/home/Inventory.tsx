import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { AlertIcon, ClockIcon, InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import { Section } from './Section';
import { SectionHeader } from './SectionHeader';
import type { InhalerView } from './types';

interface InventoryProps {
  title: string;
  inhalers: InhalerView[];
  /** Pre-formatted strings (callers compute days-until + locale-formatted date). */
  formatDosesLeft: (n: number) => string;
  formatExpiryStatus: (inh: InhalerView) => { kind: 'normal' | 'soon' | 'expired'; label: string };
  refillSoonLabel: string;
  /** Empty state when no inhaler is registered yet. */
  emptyState?: React.ReactNode;
}

export function Inventory({
  title,
  inhalers,
  formatDosesLeft,
  formatExpiryStatus,
  refillSoonLabel,
  emptyState,
}: InventoryProps): React.JSX.Element {
  if (inhalers.length === 0 && emptyState) {
    return (
      <Section>
        <SectionHeader label={title} />
        {emptyState}
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeader label={title} />
      <YStack gap="$3.5">
        {inhalers.map((inh, i) => {
          const stockPct = Math.max(0, Math.min(100, (inh.doses / Math.max(1, inh.total)) * 100));
          const isMaint = inh.kind === 'maint';
          const expiry = formatExpiryStatus(inh);
          const expiryColorToken =
            expiry.kind === 'expired'
              ? '$rescueInk'
              : expiry.kind === 'soon'
                ? '$amberInk'
                : '$colorMore';

          return (
            <XStack
              key={inh.id}
              gap="$3"
              alignItems="flex-start"
              paddingTop={i === 0 ? 0 : '$3.5'}
              borderTopWidth={i === 0 ? 0 : 0.5}
              borderTopColor="$borderColor"
            >
              <Text
                width={40}
                height={40}
                borderRadius={10}
                backgroundColor={isMaint ? '$maintSoft' : '$rescueSoft'}
                color={isMaint ? '$maint' : '$rescue'}
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
                display="flex"
              >
                {isMaint ? (
                  <InhalerMaintIcon size={20} color="currentColor" />
                ) : (
                  <InhalerRescueIcon size={20} color="currentColor" />
                )}
              </Text>

              <YStack flex={1} minWidth={0} gap="$1.5">
                <XStack justifyContent="space-between" alignItems="baseline" gap="$2">
                  <Text fontSize={14} fontWeight="500" color="$color" flex={1} numberOfLines={1}>
                    {inh.name}
                  </Text>
                  <Text
                    fontSize={12}
                    fontWeight="500"
                    color={inh.isLow ? '$amberInk' : '$colorMuted'}
                    fontFamily="$mono"
                  >
                    {formatDosesLeft(inh.doses)}
                  </Text>
                </XStack>
                <Text fontSize={11.5} color="$colorMore">
                  {inh.contextLabel}
                </Text>

                {/* Stock bar */}
                <Stack
                  height={5}
                  backgroundColor="$borderColor"
                  borderRadius={9999}
                  overflow="hidden"
                  marginTop="$1"
                >
                  <Stack
                    width={`${stockPct}%`}
                    height="100%"
                    backgroundColor={inh.isLow ? '$amber' : isMaint ? '$maint' : '$rescue'}
                  />
                </Stack>

                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  gap="$2"
                  marginTop="$1.5"
                  flexWrap="wrap"
                >
                  <XStack alignItems="center" gap="$1.5">
                    <Text color={expiryColorToken} display="flex" alignItems="center">
                      <ClockIcon size={11} color="currentColor" />
                    </Text>
                    <Text fontSize={11} color={expiryColorToken}>
                      {expiry.label}
                    </Text>
                  </XStack>
                  {inh.isLow && (
                    <XStack alignItems="center" gap="$1">
                      <Text color="$amberInk" display="flex" alignItems="center">
                        <AlertIcon size={11} color="currentColor" />
                      </Text>
                      <Text fontSize={11} color="$amberInk" fontWeight="500">
                        {refillSoonLabel}
                      </Text>
                    </XStack>
                  )}
                </XStack>
              </YStack>
            </XStack>
          );
        })}
      </YStack>
    </Section>
  );
}
