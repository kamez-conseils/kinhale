import * as React from 'react';
import { Input, Stack, Text, YStack } from 'tamagui';

import { BrandIcon } from '../auth/icons';

interface WelcomeStepProps {
  copy: {
    title: string;
    sub: string;
    nameLabel: string;
    namePlaceholder: string;
    foot: string;
  };
  value: string;
  onChange: (next: string) => void;
  errorMessage?: string | null;
}

// Premier écran de l'onboarding (étape 0 de la maquette).
// Logo gradient + titre + sous-titre + champ prénom + note "vous pourrez
// ajouter d'autres enfants plus tard".
export function WelcomeStep({
  copy,
  value,
  onChange,
  errorMessage = null,
}: WelcomeStepProps): React.JSX.Element {
  return (
    <YStack alignItems="center" gap={24} paddingTop={24}>
      {/* Logo gradient diagonal — accent → accent shifted vers violet */}
      <Stack
        width={72}
        height={72}
        borderRadius={20}
        alignItems="center"
        justifyContent="center"
        // Gradient et halo via style natif (Tamagui props ne supportent pas
        // gradient en valeur directe et color-mix imbriqué).
        style={{
          background:
            'linear-gradient(135deg, var(--maint) 0%, color-mix(in oklch, var(--maint) 60%, oklch(50% 0.12 280)) 100%)',
          boxShadow: '0 8px 24px color-mix(in oklch, var(--maint) 35%, transparent)',
        }}
      >
        <BrandIcon size={32} color="#ffffff" />
      </Stack>

      <YStack alignItems="center" maxWidth={320} gap={10}>
        <Text
          tag="h1"
          margin={0}
          fontFamily="$heading"
          fontSize={28}
          fontWeight="500"
          letterSpacing={-0.56}
          color="$color"
          textAlign="center"
          lineHeight={32}
        >
          {copy.title}
        </Text>
        <Text fontSize={14} color="$colorMore" textAlign="center" lineHeight={21}>
          {copy.sub}
        </Text>
      </YStack>

      <YStack width="100%" gap={8} marginTop={8}>
        <Text
          tag="label"
          htmlFor="kinhale-onb-child-name"
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
        >
          {copy.nameLabel}
        </Text>
        <Input
          id="kinhale-onb-child-name"
          unstyled
          width="100%"
          paddingHorizontal={16}
          paddingVertical={14}
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor={errorMessage !== null ? '$amber' : '$borderColor'}
          borderRadius={12}
          fontSize={16}
          color="$color"
          placeholderTextColor="$colorFaint"
          value={value}
          onChangeText={onChange}
          placeholder={copy.namePlaceholder}
          autoComplete="given-name"
          autoCapitalize="words"
          aria-label={copy.nameLabel}
          aria-invalid={errorMessage !== null}
          // Halo subtil tinté quand non-erreur — `color-mix` accent 8%.
          style={
            errorMessage !== null
              ? undefined
              : { boxShadow: '0 0 0 3px color-mix(in oklch, var(--maint) 8%, transparent)' }
          }
        />
        {errorMessage !== null ? (
          <Text fontSize={12} color="$amberInk" role="alert" marginTop={2}>
            {errorMessage}
          </Text>
        ) : (
          <Text fontSize={11.5} color="$colorMore" fontStyle="italic" marginTop={2}>
            {copy.foot}
          </Text>
        )}
      </YStack>
    </YStack>
  );
}
