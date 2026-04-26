import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import { BrandIcon } from './icons';

interface BrandMarkProps {
  size?: 'md' | 'lg';
  accent?: string;
}

// Logo Kinhale officiel : carré arrondi accentué portant le pictogramme
// œil-pompe en blanc, suivi du mot-marque « Kinhale » (capitale).
// Aligné sur la maquette `docs/design/handoffs/2026-04-26-clinical-calm/
// project/Kinhale Auth.html` (composant `BrandMark`, ~ligne 1882).
export function BrandMark({ size = 'md', accent = '$maint' }: BrandMarkProps): React.JSX.Element {
  const dim = size === 'lg' ? 44 : 36;
  const inner = size === 'lg' ? 22 : 18;
  const fontSize = size === 'lg' ? 22 : 18;

  return (
    <XStack alignItems="center" gap={12} accessibilityRole="header" accessibilityLabel="Kinhale">
      <Stack
        width={dim}
        height={dim}
        borderRadius={Math.round(dim * 0.28)}
        backgroundColor={accent}
        alignItems="center"
        justifyContent="center"
        // Halo doux teinté de l'accent — `boxShadow` est consommé par
        // Tamagui côté web, ignoré côté RN (les ombres mobiles passent
        // par `shadowColor`/`shadowRadius` mais ce composant est
        // décoratif, on accepte la dégradation gracieuse).
        style={{
          boxShadow: '0 4px 14px color-mix(in oklch, var(--maint) 24%, transparent)',
        }}
      >
        <BrandIcon size={inner} color="#ffffff" />
      </Stack>
      <Text
        fontFamily="$heading"
        fontSize={fontSize}
        fontWeight="600"
        letterSpacing={-fontSize * 0.01}
        color="$color"
      >
        Kinhale
      </Text>
    </XStack>
  );
}
