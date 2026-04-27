import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import { BookmarkIcon, MapPinIcon, MoreIcon, SmallClockIcon } from './icons';
import type { PumpExpiryStatus, PumpView } from './types';

export interface PumpCardProps {
  pump: PumpView;
  expiry: PumpExpiryStatus;
  /** Libellé localisé pour la barre stock (ex. « Stock »). */
  stockLabel: string;
  /** Libellé pastille « Principale ». */
  primaryLabel: string;
  /** Libellé du bouton « Renouveler ». */
  refillLabel: string;
  /** `'mobile'` => padding 16, `'web'` => padding 20. */
  mode?: 'mobile' | 'web';
  onPress?: ((id: string) => void) | undefined;
  onPressRefill?: ((id: string) => void) | undefined;
}

export function PumpCard({
  pump,
  expiry,
  stockLabel,
  primaryLabel,
  refillLabel,
  mode = 'mobile',
  onPress,
  onPressRefill,
}: PumpCardProps): React.JSX.Element {
  const isMaint = pump.kind === 'maint';
  const stockPct = Math.max(0, Math.min(100, (pump.doses / Math.max(1, pump.total)) * 100));
  const lowStock = !!pump.isLow;
  const expiringSoon = expiry.kind === 'soon';
  const expired = expiry.kind === 'expired';
  const showRefill = lowStock || expiringSoon;

  const expiryColor = expired ? '$rescueInk' : expiringSoon ? '$amberInk' : '$colorMore';

  const refillBg = lowStock ? '$amberSoft' : '$rescueSoft';
  const refillFg = lowStock ? '$amberInk' : '$rescueInk';

  return (
    <YStack
      tag="article"
      backgroundColor="$surface"
      borderRadius={16}
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={mode === 'web' ? 20 : 16}
      gap={14}
      cursor={onPress ? 'pointer' : 'default'}
      {...(onPress ? { onPress: () => onPress(pump.id) } : {})}
      {...(onPress ? { hoverStyle: { borderColor: '$borderColorStrong' } } : {})}
    >
      <XStack gap={14} alignItems="flex-start">
        <Text
          width={48}
          height={48}
          borderRadius={12}
          backgroundColor={isMaint ? '$maintSoft' : '$rescueSoft'}
          color={isMaint ? '$maint' : '$rescue'}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          display="flex"
        >
          {isMaint ? (
            <InhalerMaintIcon size={24} color="currentColor" />
          ) : (
            <InhalerRescueIcon size={24} color="currentColor" />
          )}
        </Text>
        <YStack flex={1} minWidth={0}>
          <XStack alignItems="center" gap={8} flexWrap="wrap">
            <Text fontSize={15} fontWeight="600" color="$color">
              {pump.name}
            </Text>
            {pump.isPrimary && (
              <XStack
                paddingHorizontal={7}
                paddingVertical={2}
                backgroundColor="$surface2"
                borderRadius={99}
                alignItems="center"
                gap={4}
              >
                <Text color="$colorMuted" display="flex" alignItems="center">
                  <BookmarkIcon size={9} color="currentColor" />
                </Text>
                <Text
                  fontSize={10}
                  color="$colorMuted"
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing={0.6}
                >
                  {primaryLabel}
                </Text>
              </XStack>
            )}
          </XStack>
          <Text fontSize={12.5} color="$colorMore" marginTop={2}>
            {pump.contextLabel}
          </Text>
          <XStack alignItems="center" gap={4} marginTop={6}>
            <Text color="$colorMore" display="flex" alignItems="center">
              <MapPinIcon size={11} color="currentColor" />
            </Text>
            <Text fontSize={11.5} color="$colorMore">
              {pump.location}
            </Text>
          </XStack>
        </YStack>
        <Stack
          tag="button"
          padding={6}
          borderRadius={8}
          backgroundColor="transparent"
          borderWidth={0}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel={`${pump.name} — actions`}
          hoverStyle={{ backgroundColor: '$surface2' }}
        >
          <Text color="$colorMore" display="flex">
            <MoreIcon size={16} color="currentColor" />
          </Text>
        </Stack>
      </XStack>

      <YStack>
        <XStack justifyContent="space-between" alignItems="baseline">
          <Text
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.66}
            fontWeight="600"
          >
            {stockLabel}
          </Text>
          <Text
            fontFamily="$mono"
            fontSize={13.5}
            fontWeight="600"
            color={lowStock ? '$amberInk' : '$color'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {pump.doses}
            <Text color="$colorMore" fontWeight="400">
              {' '}
              / {pump.total}
            </Text>
          </Text>
        </XStack>
        <Stack
          marginTop={6}
          height={8}
          backgroundColor="$borderColor"
          borderRadius={99}
          overflow="hidden"
        >
          <Stack
            width={`${stockPct}%`}
            height="100%"
            borderRadius={99}
            backgroundColor={lowStock ? '$amber' : isMaint ? '$maint' : '$rescue'}
          />
        </Stack>
      </YStack>

      <XStack justifyContent="space-between" alignItems="center" paddingTop={4}>
        <XStack alignItems="center" gap={5}>
          <Text color={expiryColor} display="flex" alignItems="center">
            <SmallClockIcon size={12} color="currentColor" />
          </Text>
          <Text
            fontSize={12}
            color={expiryColor}
            fontWeight={expired || expiringSoon ? '500' : '400'}
          >
            {expiry.label}
          </Text>
        </XStack>
        {showRefill && (
          <Stack
            tag="button"
            cursor="pointer"
            backgroundColor={refillBg}
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={99}
            borderWidth={0}
            accessibilityRole="button"
            accessibilityLabel={refillLabel}
            {...(onPressRefill ? { onPress: () => onPressRefill(pump.id) } : {})}
          >
            <Text fontSize={12} fontWeight="600" color={refillFg}>
              {refillLabel}
            </Text>
          </Stack>
        )}
      </XStack>
    </YStack>
  );
}
