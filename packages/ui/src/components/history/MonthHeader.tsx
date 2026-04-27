import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface MonthHeaderProps {
  /** Libellé du mois courant (ex. « Avril 2026 »). */
  monthLabel: string;
  /** Largeur min du label en px (utile pour éviter les jumps). */
  labelMinWidth?: number;
  /** Taille du label : `sm` (16 px) pour mobile, `md` (18 px) pour web. */
  size?: 'sm' | 'md';
  /** Libellés a11y des boutons précédent / suivant (déjà localisés). */
  prevLabel?: string;
  nextLabel?: string;
  onPressPrev?: (() => void) | undefined;
  onPressNext?: (() => void) | undefined;
  /** Optionnel : enfants affichés à droite (ex. Légende sur web). */
  trailing?: React.ReactNode;
}

export function MonthHeader({
  monthLabel,
  labelMinWidth = 0,
  size = 'md',
  prevLabel = 'prev-month',
  nextLabel = 'next-month',
  onPressPrev,
  onPressNext,
  trailing,
}: MonthHeaderProps): React.JSX.Element {
  const fontSize = size === 'sm' ? 16 : 18;
  return (
    <XStack justifyContent="space-between" alignItems="center" marginBottom={14}>
      <XStack alignItems="center" gap={8}>
        <NavButton onPress={onPressPrev} ariaLabel={prevLabel}>
          <ChevronLeftIcon size={14} color="currentColor" />
        </NavButton>
        <Text
          fontFamily="$heading"
          fontSize={fontSize}
          fontWeight="500"
          letterSpacing={-0.18}
          color="$color"
          textAlign="center"
          {...(labelMinWidth > 0 ? { minWidth: labelMinWidth } : {})}
        >
          {monthLabel}
        </Text>
        <NavButton onPress={onPressNext} ariaLabel={nextLabel}>
          <ChevronRightIcon size={14} color="currentColor" />
        </NavButton>
      </XStack>
      {trailing !== undefined && trailing !== null ? <>{trailing}</> : null}
    </XStack>
  );
}

interface NavButtonProps {
  ariaLabel: string;
  children: React.ReactNode;
  onPress?: (() => void) | undefined;
}

function NavButton({ ariaLabel, children, onPress }: NavButtonProps): React.JSX.Element {
  return (
    <Stack
      tag="button"
      cursor={onPress ? 'pointer' : 'default'}
      width={30}
      height={30}
      borderRadius={15}
      borderWidth={0}
      backgroundColor="$surface2"
      alignItems="center"
      justifyContent="center"
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      {...(onPress ? { onPress } : {})}
      hoverStyle={{ backgroundColor: '$borderColor' }}
    >
      <Text color="$colorMuted" display="flex">
        {children}
      </Text>
    </Stack>
  );
}
