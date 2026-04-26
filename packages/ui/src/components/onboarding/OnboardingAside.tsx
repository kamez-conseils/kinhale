import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { BrandIcon } from '../auth/icons';
import type { OnboardingStep } from './types';

interface OnboardingAsideProps {
  step: OnboardingStep;
  totalSteps?: number;
  copy: {
    /** "Étape 1 · 6". Vide pour l'étape Done. */
    eyebrow: string;
    /** Titre principal du panneau gauche (ex: "Bienvenue chez Kinhale"). */
    title: string;
    /** Body explicatif (≈ 1-2 phrases). */
    body: string;
  };
  /** Visual SVG / illustratif spécifique à l'étape. Optionnel. */
  visual?: React.ReactNode;
}

const STEP_INDEX: Record<OnboardingStep, number> = {
  welcome: 0,
  pumps: 1,
  plan: 2,
  'first-dose': 3,
  done: 4,
};

// Panneau gauche du layout desktop onboarding (maquette `Kinhale
// Onboarding.html`, helper `OnbAside`, ~ligne 3811). Affiche le wordmark
// Kinhale, un visual SVG illustratif au centre, le titre/sub de l'étape
// en bas, et une barre de progression horizontale en 6 segments.
//
// Reste mobile-friendly : si la viewport est trop étroite, l'app
// appelante doit le cacher via media query côté `OnboardingShell`.
export function OnboardingAside({
  step,
  totalSteps = 6,
  copy,
  visual,
}: OnboardingAsideProps): React.JSX.Element {
  const stepIndex = STEP_INDEX[step];

  return (
    <YStack
      flex={1}
      padding={48}
      backgroundColor="$surface"
      borderRightWidth={0.5}
      borderRightColor="$borderColor"
      style={{ overflow: 'auto' }}
    >
      {/* Wordmark */}
      <XStack alignItems="center" gap={10}>
        <Stack
          width={28}
          height={28}
          borderRadius={8}
          backgroundColor="$maint"
          alignItems="center"
          justifyContent="center"
        >
          <BrandIcon size={16} color="#ffffff" />
        </Stack>
        <Text
          fontFamily="$heading"
          fontSize={17}
          fontWeight="600"
          letterSpacing={-0.17}
          color="$color"
        >
          Kinhale
        </Text>
      </XStack>

      {/* Visual centré */}
      <Stack flex={1} alignItems="center" justifyContent="center" marginVertical={20}>
        <Stack width="100%" maxWidth={380}>
          {visual ?? <DefaultBreathVisual />}
        </Stack>
      </Stack>

      {/* Caption : eyebrow + titre + body */}
      <YStack>
        {copy.eyebrow !== '' && (
          <Text
            fontSize={11}
            color="$maint"
            textTransform="uppercase"
            letterSpacing={1.1}
            fontWeight="600"
            marginBottom={8}
          >
            {copy.eyebrow}
          </Text>
        )}
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={28}
          fontWeight="500"
          letterSpacing={-0.56}
          color="$color"
          lineHeight={34}
        >
          {copy.title}
        </Text>
        <Text fontSize={14} color="$colorMuted" marginTop={10} lineHeight={22} maxWidth={420}>
          {copy.body}
        </Text>
      </YStack>

      {/* Barre de progression — 6 segments horizontaux */}
      <XStack marginTop={28} gap={6}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <Stack
            key={i}
            flex={1}
            height={3}
            borderRadius={2}
            backgroundColor={
              i === stepIndex ? '$maint' : i < stepIndex ? '$maintSoft' : '$borderColor'
            }
          />
        ))}
      </XStack>
    </YStack>
  );
}

// Visual par défaut pour l'étape Welcome — orb respiratoire concentrique
// avec inhalateur central (reproduit le SVG step 0 de la maquette).
function DefaultBreathVisual(): React.JSX.Element {
  return (
    <svg viewBox="0 0 360 280" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <radialGradient id="kinhale-onb-orb" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--maint)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--maint)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="180" cy="140" r="120" fill="url(#kinhale-onb-orb)" />
      <circle
        cx="180"
        cy="140"
        r="56"
        fill="none"
        stroke="var(--maint)"
        strokeWidth="1"
        opacity="0.4"
      />
      <circle
        cx="180"
        cy="140"
        r="86"
        fill="none"
        stroke="var(--maint)"
        strokeWidth="1"
        opacity="0.25"
      />
      <g transform="translate(180,140)">
        <rect x="-22" y="-32" width="44" height="58" rx="14" fill="var(--maint)" />
        <rect x="-22" y="-32" width="44" height="14" rx="7" fill="rgba(255,255,255,0.25)" />
        <circle cx="0" cy="-3" r="3" fill="#fff" />
      </g>
    </svg>
  );
}
