import * as React from 'react';
import { Button } from 'tamagui';

interface OnboardingCTAProps {
  label: string;
  onPress?: (() => void) | undefined;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary';
  testID?: string;
}

// Bouton CTA standardisé pour le footer du shell onboarding. La maquette
// (`Kinhale Onboarding.html`, helper `CTA`) impose :
//   - primary : full width, accent fond, fontWeight 600, halo color-mix 30%
//   - secondary : transparent, ink-3, fontWeight 500
export function OnboardingCTA({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  variant = 'primary',
  testID,
}: OnboardingCTAProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  const visibleLabel = loading && loadingLabel ? loadingLabel : label;

  if (variant === 'secondary') {
    return (
      <Button
        unstyled
        width="100%"
        onPress={onPress}
        disabled={isDisabled}
        backgroundColor="transparent"
        color="$colorMore"
        fontSize={13}
        fontWeight="500"
        paddingVertical={10}
        accessibilityRole="button"
        testID={testID}
      >
        {visibleLabel}
      </Button>
    );
  }

  return (
    <Button
      width="100%"
      onPress={onPress}
      disabled={isDisabled}
      backgroundColor={isDisabled ? '$borderColorStrong' : '$maint'}
      color="white"
      fontSize={15}
      fontWeight="600"
      paddingVertical={14}
      borderRadius={14}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      // Halo doux teinté de l'accent ; disparaît à l'état désactivé.
      style={
        isDisabled
          ? undefined
          : { boxShadow: '0 4px 14px color-mix(in oklch, var(--maint) 30%, transparent)' }
      }
    >
      {visibleLabel}
    </Button>
  );
}
