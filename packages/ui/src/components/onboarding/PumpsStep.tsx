import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { CheckSmallIcon } from '../auth/icons';
import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';

export interface PumpsStepValue {
  maint: boolean;
  rescue: boolean;
}

interface PumpsStepProps {
  copy: {
    title: string;
    sub: string;
    maintLabel: string;
    maintSub: string;
    rescueLabel: string;
    rescueSub: string;
  };
  value: PumpsStepValue;
  onChange: (next: PumpsStepValue) => void;
}

// Step 1 de l'onboarding (maquette `Kinhale Onboarding.html` ligne 3373).
// Liste verticale de 2 `CheckTile` : fond (controller) + secours (rescue).
// L'utilisateur peut activer un, l'autre, ou les deux.
export function PumpsStep({ copy, value, onChange }: PumpsStepProps): React.JSX.Element {
  return (
    <YStack paddingTop={8} gap={6}>
      <Text
        tag="h1"
        margin={0}
        fontFamily="$heading"
        fontSize={22}
        fontWeight="500"
        letterSpacing={-0.44}
        color="$color"
      >
        {copy.title}
      </Text>
      <Text fontSize={13.5} color="$colorMore" lineHeight={20} marginTop={6}>
        {copy.sub}
      </Text>
      <YStack marginTop={22} gap={10}>
        <CheckTile
          checked={value.maint}
          onChange={(next): void => onChange({ ...value, maint: next })}
          kind="maint"
          title={copy.maintLabel}
          sub={copy.maintSub}
        />
        <CheckTile
          checked={value.rescue}
          onChange={(next): void => onChange({ ...value, rescue: next })}
          kind="rescue"
          title={copy.rescueLabel}
          sub={copy.rescueSub}
        />
      </YStack>
    </YStack>
  );
}

interface CheckTileProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  kind: 'maint' | 'rescue';
  title: string;
  sub: string;
}

// CheckTile interne au step Pumps — on le garde local plutôt que de
// l'exposer publiquement tant qu'aucun autre écran n'en a l'usage.
function CheckTile({ checked, onChange, kind, title, sub }: CheckTileProps): React.JSX.Element {
  return (
    <XStack
      tag="button"
      cursor="pointer"
      onPress={() => onChange(!checked)}
      width="100%"
      paddingHorizontal={16}
      paddingVertical={14}
      alignItems="center"
      gap={14}
      backgroundColor={checked ? '$maintSoft' : '$surface'}
      borderWidth={1.5}
      borderColor={checked ? '$maint' : '$borderColor'}
      borderRadius={14}
      animation="quick"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      // Backgroundcolor utilise color-mix pour matcher exactement la maquette
      // quand checked (8% de l'accent vs surface).
      style={{
        background: checked ? 'color-mix(in oklch, var(--maint) 8%, var(--surface))' : undefined,
      }}
    >
      <Stack
        width={48}
        height={48}
        borderRadius={12}
        backgroundColor={kind === 'maint' ? '$maint' : '$rescue'}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {kind === 'maint' ? (
          <InhalerMaintIcon size={24} color="#ffffff" />
        ) : (
          <InhalerRescueIcon size={24} color="#ffffff" />
        )}
      </Stack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color="$color">
          {title}
        </Text>
        <Text fontSize={12} color="$colorMore" marginTop={2}>
          {sub}
        </Text>
      </YStack>
      <Stack
        width={22}
        height={22}
        borderRadius={11}
        flexShrink={0}
        backgroundColor={checked ? '$maint' : 'transparent'}
        borderWidth={checked ? 0 : 1.5}
        borderColor="$borderColorStrong"
        alignItems="center"
        justifyContent="center"
      >
        {checked && <CheckSmallIcon size={12} color="#ffffff" />}
      </Stack>
    </XStack>
  );
}
