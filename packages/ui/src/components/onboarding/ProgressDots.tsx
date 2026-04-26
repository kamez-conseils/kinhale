import * as React from 'react';
import { Stack, XStack } from 'tamagui';

interface ProgressDotsProps {
  current: number;
  total: number;
  /** Label ARIA du conteneur (ex : "Étape 2 sur 5"). */
  ariaLabel: string;
}

// Dots de progression en haut du shell — un trait court allongé pour
// l'étape active, des dots ronds pour les autres. Aligné sur la maquette
// (`Kinhale Onboarding.html`, helper `ProgressDots`).
export function ProgressDots({ current, total, ariaLabel }: ProgressDotsProps): React.JSX.Element {
  return (
    <XStack
      alignItems="center"
      gap={6}
      accessibilityRole="progressbar"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ now: current + 1, min: 1, max: total }}
    >
      {Array.from({ length: total }, (_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <Stack
            key={i}
            width={active ? 18 : 6}
            height={6}
            borderRadius={3}
            backgroundColor={active ? '$maint' : done ? '$maintSoft' : '$borderColorStrong'}
            animation="quick"
          />
        );
      })}
    </XStack>
  );
}
