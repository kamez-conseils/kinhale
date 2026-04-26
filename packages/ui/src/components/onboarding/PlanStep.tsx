import * as React from 'react';
import { Input, Stack, Text, XStack, YStack } from 'tamagui';

export interface PlanStepValue {
  morningTime: string;
  eveningTime: string;
}

interface PlanStepProps {
  copy: {
    title: string;
    sub: string;
    morningLabel: string;
    eveningLabel: string;
    plansTitle: string;
    plansSub: string;
    greenLabel: string;
    greenSub: string;
    yellowLabel: string;
    yellowSub: string;
    redLabel: string;
    redSub: string;
  };
  value: PlanStepValue;
  onChange: (next: PlanStepValue) => void;
}

// Step 2+3 fusionnés (maquette `Kinhale Onboarding.html` lignes 3429+3479).
// Deux blocs :
//   1. Horaires : 2 TimeRow matin (08:00) + soir (20:00) en JetBrains Mono
//   2. Plan d'action : 3 ZoneCard vert (zone OK) / jaune (alerte) / rouge
//      (urgence). Affichage informatif, pas d'édition à ce stade.
export function PlanStep({ copy, value, onChange }: PlanStepProps): React.JSX.Element {
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
        <TimeRow
          icon="☀"
          iconColor="oklch(60% 0.10 75)"
          label={copy.morningLabel}
          value={value.morningTime}
          onChange={(time): void => onChange({ ...value, morningTime: time })}
        />
        <TimeRow
          icon="☾"
          iconColor="oklch(50% 0.08 250)"
          label={copy.eveningLabel}
          value={value.eveningTime}
          onChange={(time): void => onChange({ ...value, eveningTime: time })}
        />
      </YStack>

      <YStack marginTop={28} gap={6}>
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={18}
          fontWeight="500"
          letterSpacing={-0.36}
          color="$color"
        >
          {copy.plansTitle}
        </Text>
        <Text fontSize={13.5} color="$colorMore" lineHeight={20} marginTop={4}>
          {copy.plansSub}
        </Text>
      </YStack>

      <YStack marginTop={14} gap={10}>
        <ZoneCard color="oklch(65% 0.14 145)" label={copy.greenLabel} sub={copy.greenSub} />
        <ZoneCard color="oklch(78% 0.14 80)" label={copy.yellowLabel} sub={copy.yellowSub} />
        <ZoneCard color="oklch(60% 0.18 25)" label={copy.redLabel} sub={copy.redSub} />
      </YStack>
    </YStack>
  );
}

interface TimeRowProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}

function TimeRow({ icon, iconColor, label, value, onChange }: TimeRowProps): React.JSX.Element {
  return (
    <XStack
      paddingHorizontal={16}
      paddingVertical={14}
      gap={14}
      alignItems="center"
      backgroundColor="$surface"
      borderWidth={0.5}
      borderColor="$borderColor"
      borderRadius={14}
    >
      <Stack
        width={36}
        height={36}
        borderRadius={10}
        backgroundColor="$surface2"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Text fontSize={18} style={{ color: iconColor }}>
          {icon}
        </Text>
      </Stack>
      <Text fontSize={13} fontWeight="500" color="$colorMore" flex={1}>
        {label}
      </Text>
      <Input
        unstyled
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        // type="time" en HTML pur — Tamagui Input est mappé à un input web.
        // Côté mobile, fallback texte (acceptable pour cette PR).
        {...({ type: 'time' } as object)}
        backgroundColor="transparent"
        borderWidth={0}
        fontFamily="$mono"
        fontSize={18}
        fontWeight="600"
        color="$color"
        textAlign="right"
        style={{ fontVariantNumeric: 'tabular-nums' } as object}
        aria-label={label}
      />
    </XStack>
  );
}

interface ZoneCardProps {
  color: string;
  label: string;
  sub: string;
}

function ZoneCard({ color, label, sub }: ZoneCardProps): React.JSX.Element {
  return (
    <XStack
      gap={14}
      paddingHorizontal={16}
      paddingVertical={14}
      backgroundColor="$surface"
      borderRadius={14}
      borderWidth={0.5}
      borderColor="$borderColor"
    >
      <Stack
        width={36}
        height={36}
        borderRadius={18}
        flexShrink={0}
        // Halo doux 4 px teinté de la couleur de la zone — calque exact maquette.
        style={{
          background: color,
          boxShadow: `0 0 0 4px color-mix(in oklch, ${color} 18%, transparent)`,
        }}
      />
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color="$color">
          {label}
        </Text>
        <Text fontSize={12.5} color="$colorMore" marginTop={3} lineHeight={20}>
          {sub}
        </Text>
      </YStack>
    </XStack>
  );
}
