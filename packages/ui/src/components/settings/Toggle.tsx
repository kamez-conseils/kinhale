import * as React from 'react';
import { Stack } from 'tamagui';

export interface ToggleProps {
  checked: boolean;
  onChange?: ((next: boolean) => void) | undefined;
  /** Libellé `aria-label` (déjà localisé). */
  ariaLabel: string;
}

/**
 * Toggle 44×26 px (touch target accessible) avec pastille blanche
 * 22×22 et fond `$maint` quand activé.
 */
export function Toggle({ checked, onChange, ariaLabel }: ToggleProps): React.JSX.Element {
  return (
    <Stack
      tag="button"
      cursor="pointer"
      width={44}
      height={26}
      borderRadius={13}
      borderWidth={0}
      backgroundColor={checked ? '$maint' : '$borderColorStrong'}
      flexDirection="row"
      alignItems="center"
      justifyContent={checked ? 'flex-end' : 'flex-start'}
      padding={2}
      flexShrink={0}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={ariaLabel}
      onPress={() => onChange?.(!checked)}
      style={{ transition: 'background 150ms ease' }}
    >
      <Stack
        width={22}
        height={22}
        borderRadius={11}
        backgroundColor="$white"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
      />
    </Stack>
  );
}
