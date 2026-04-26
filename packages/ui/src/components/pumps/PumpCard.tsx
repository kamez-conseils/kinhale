import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { AlertIcon, ClockIcon, InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import type { PumpExpiryKind, PumpView } from './types';

interface PumpCardProps {
  pump: PumpView;
  copy: {
    primaryBadge: string;
    stockLabel: string;
    refillSoonLabel: string;
    locationLabel: string;
  };
  /** Computé localement par l'app pour formater "Expire le X" / "Expirée". */
  expiryLabel: string;
  expiryKind: PumpExpiryKind;
  onPress?: (() => void) | undefined;
  onPressRefill?: (() => void) | undefined;
}

// Card d'une pompe — réplique fidèle de `InhalerCard` de la maquette
// `Kinhale Mes pompes.html` (~ligne 2979). Layout en 3 zones :
//   1. en-tête (icône + nom + badge primary + sub + location)
//   2. barre de stock avec compteur dosesLeft / total en mono
//   3. footer (date d'expiration + bouton "Renouveler" si bas/expirant)
export function PumpCard({
  pump,
  copy,
  expiryLabel,
  expiryKind,
  onPress,
  onPressRefill,
}: PumpCardProps): React.JSX.Element {
  const stockPct = Math.max(0, Math.min(100, (pump.doses / Math.max(1, pump.total)) * 100));
  const isMaint = pump.kind === 'maint';
  const expired = expiryKind === 'expired';
  const expiringSoon = expiryKind === 'soon';
  const showRefill = pump.isLow || expiringSoon || expired;
  const expiryColor = expired ? '$rescueInk' : expiringSoon ? '$amberInk' : '$colorMore';

  return (
    <YStack
      backgroundColor="$surface"
      borderRadius={16}
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={16}
      gap={14}
      cursor={onPress ? 'pointer' : 'default'}
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            hoverStyle: { borderColor: '$borderColorStrong' as const },
          }
        : {})}
    >
      {/* En-tête */}
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
              <Stack
                paddingHorizontal={7}
                paddingVertical={2}
                backgroundColor="$surface2"
                borderRadius={99}
              >
                <Text
                  fontSize={10}
                  color="$colorMuted"
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing={0.6}
                >
                  {copy.primaryBadge}
                </Text>
              </Stack>
            )}
          </XStack>
          <Text fontSize={12.5} color="$colorMore" marginTop={2}>
            {pump.contextLabel}
          </Text>
          {pump.location && (
            <Text fontSize={11.5} color="$colorMore" marginTop={6}>
              {copy.locationLabel} · {pump.location}
            </Text>
          )}
        </YStack>
      </XStack>

      {/* Barre de stock */}
      <YStack>
        <XStack justifyContent="space-between" alignItems="baseline">
          <Text
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.66}
            fontWeight="600"
          >
            {copy.stockLabel}
          </Text>
          <Text
            fontFamily="$mono"
            fontSize={13.5}
            fontWeight="600"
            color={pump.isLow ? '$amberInk' : '$color'}
            style={{ fontVariantNumeric: 'tabular-nums' } as object}
          >
            {pump.doses}
            <Text color="$colorMore" fontFamily="$mono" fontWeight="400">
              {' / '}
              {pump.total}
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
            backgroundColor={pump.isLow ? '$amber' : isMaint ? '$maint' : '$rescue'}
          />
        </Stack>
      </YStack>

      {/* Footer expiration + refill */}
      <XStack justifyContent="space-between" alignItems="center" paddingTop={4}>
        <XStack alignItems="center" gap={5}>
          <Text color={expiryColor} display="flex" alignItems="center">
            <ClockIcon size={12} color="currentColor" />
          </Text>
          <Text
            fontSize={12}
            color={expiryColor}
            fontWeight={expired || expiringSoon ? '500' : '400'}
          >
            {expiryLabel}
          </Text>
        </XStack>
        {showRefill && (
          <XStack
            tag="button"
            cursor="pointer"
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={99}
            borderWidth={0}
            backgroundColor={pump.isLow ? '$amberSoft' : '$rescueSoft'}
            alignItems="center"
            gap={5}
            {...(onPressRefill ? { onPress: onPressRefill } : {})}
            accessibilityRole="button"
            accessibilityLabel={copy.refillSoonLabel}
          >
            <Text color={pump.isLow ? '$amberInk' : '$rescueInk'} display="flex">
              <AlertIcon size={11} color="currentColor" />
            </Text>
            <Text fontSize={12} fontWeight="600" color={pump.isLow ? '$amberInk' : '$rescueInk'}>
              {copy.refillSoonLabel}
            </Text>
          </XStack>
        )}
      </XStack>
    </YStack>
  );
}
