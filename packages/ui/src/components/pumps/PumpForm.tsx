import * as React from 'react';
import { Input, Stack, Text, XStack, YStack } from 'tamagui';

import { CheckSmallIcon } from '../auth/icons';
import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import type { PumpKind } from './types';

export interface PumpFormValue {
  name: string;
  kind: PumpKind;
  totalDosesStr: string;
  expiresAtStr: string;
  location: string;
}

export interface PumpFormCopy {
  drugLabel: string;
  drugPlaceholder: string;
  typeLabel: string;
  kindMaintLabel: string;
  kindMaintSub: string;
  kindRescueLabel: string;
  kindRescueSub: string;
  dosesTotalLabel: string;
  dosesPlaceholder: string;
  expiryLabel: string;
  expiryPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
}

interface PumpFormProps {
  copy: PumpFormCopy;
  value: PumpFormValue;
  onChange: (next: PumpFormValue) => void;
  errorMessage?: string | null;
}

// Formulaire de création / édition d'une pompe — calé sur la maquette
// `Kinhale Ajouter pompe.html`. Champs :
//   - Médicament (nom)
//   - Type (toggle 2 tiles fond / secours)
//   - Nombre total de doses (numérique)
//   - Date d'expiration (texte YYYY-MM-DD pour rester portable)
//   - Emplacement (texte libre)
export function PumpForm({
  copy,
  value,
  onChange,
  errorMessage = null,
}: PumpFormProps): React.JSX.Element {
  const updateField = <K extends keyof PumpFormValue>(key: K, next: PumpFormValue[K]): void => {
    onChange({ ...value, [key]: next });
  };

  return (
    <YStack gap={20}>
      <Field label={copy.drugLabel}>
        <Input
          unstyled
          value={value.name}
          onChangeText={(next): void => updateField('name', next)}
          placeholder={copy.drugPlaceholder}
          placeholderTextColor="$colorFaint"
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$borderColor"
          borderRadius={12}
          paddingHorizontal={14}
          paddingVertical={12}
          fontSize={15}
          color="$color"
          aria-label={copy.drugLabel}
          autoCapitalize="words"
          testID="pump-form-name"
        />
      </Field>

      <YStack gap={10}>
        <Text
          tag="label"
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
        >
          {copy.typeLabel}
        </Text>
        <XStack gap={10}>
          <KindTile
            checked={value.kind === 'maint'}
            kind="maint"
            label={copy.kindMaintLabel}
            sub={copy.kindMaintSub}
            onPress={(): void => updateField('kind', 'maint')}
          />
          <KindTile
            checked={value.kind === 'rescue'}
            kind="rescue"
            label={copy.kindRescueLabel}
            sub={copy.kindRescueSub}
            onPress={(): void => updateField('kind', 'rescue')}
          />
        </XStack>
      </YStack>

      <Field label={copy.dosesTotalLabel}>
        <Input
          unstyled
          value={value.totalDosesStr}
          onChangeText={(next): void => updateField('totalDosesStr', next.replace(/[^0-9]/g, ''))}
          placeholder={copy.dosesPlaceholder}
          placeholderTextColor="$colorFaint"
          keyboardType="number-pad"
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$borderColor"
          borderRadius={12}
          paddingHorizontal={14}
          paddingVertical={12}
          fontSize={15}
          color="$color"
          fontFamily="$mono"
          aria-label={copy.dosesTotalLabel}
          testID="pump-form-doses"
        />
      </Field>

      <Field label={copy.expiryLabel}>
        <Input
          unstyled
          value={value.expiresAtStr}
          onChangeText={(next): void => updateField('expiresAtStr', next)}
          placeholder={copy.expiryPlaceholder}
          placeholderTextColor="$colorFaint"
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$borderColor"
          borderRadius={12}
          paddingHorizontal={14}
          paddingVertical={12}
          fontSize={15}
          color="$color"
          fontFamily="$mono"
          aria-label={copy.expiryLabel}
          // type="date" côté web pour ouvrir le date picker natif.
          {...({ type: 'date' } as object)}
          testID="pump-form-expiry"
        />
      </Field>

      <Field label={copy.locationLabel}>
        <Input
          unstyled
          value={value.location}
          onChangeText={(next): void => updateField('location', next)}
          placeholder={copy.locationPlaceholder}
          placeholderTextColor="$colorFaint"
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$borderColor"
          borderRadius={12}
          paddingHorizontal={14}
          paddingVertical={12}
          fontSize={15}
          color="$color"
          aria-label={copy.locationLabel}
          testID="pump-form-location"
        />
      </Field>

      {errorMessage !== null && (
        <Text color="$amberInk" fontSize={12} role="alert">
          {errorMessage}
        </Text>
      )}
    </YStack>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps): React.JSX.Element {
  return (
    <YStack gap={8}>
      <Text
        tag="label"
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
      >
        {label}
      </Text>
      {children}
    </YStack>
  );
}

interface KindTileProps {
  checked: boolean;
  kind: PumpKind;
  label: string;
  sub: string;
  onPress: () => void;
}

function KindTile({ checked, kind, label, sub, onPress }: KindTileProps): React.JSX.Element {
  return (
    <YStack
      tag="button"
      flex={1}
      cursor="pointer"
      paddingHorizontal={14}
      paddingVertical={14}
      gap={8}
      backgroundColor={checked ? (kind === 'maint' ? '$maintSoft' : '$rescueSoft') : '$surface'}
      borderWidth={1.5}
      borderColor={checked ? (kind === 'maint' ? '$maint' : '$rescue') : '$borderColor'}
      borderRadius={14}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Text
          width={36}
          height={36}
          borderRadius={10}
          backgroundColor={kind === 'maint' ? '$maint' : '$rescue'}
          color="white"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          display="flex"
        >
          {kind === 'maint' ? (
            <InhalerMaintIcon size={18} color="currentColor" />
          ) : (
            <InhalerRescueIcon size={18} color="currentColor" />
          )}
        </Text>
        {checked && (
          <Stack
            width={20}
            height={20}
            borderRadius={10}
            backgroundColor={kind === 'maint' ? '$maint' : '$rescue'}
            alignItems="center"
            justifyContent="center"
          >
            <CheckSmallIcon size={11} color="#ffffff" />
          </Stack>
        )}
      </XStack>
      <YStack>
        <Text fontSize={13} fontWeight="600" color="$color">
          {label}
        </Text>
        <Text fontSize={11.5} color="$colorMore" marginTop={2}>
          {sub}
        </Text>
      </YStack>
    </YStack>
  );
}
