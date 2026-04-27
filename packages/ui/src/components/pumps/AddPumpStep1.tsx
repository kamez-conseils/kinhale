import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { CheckIcon } from '../../icons';
import { Field, inputBaseStyle } from './Field';
import { ChevronRightIcon, ScanIcon } from './icons';
import type { AddPumpFormState, AddPumpStep1Messages, AddPumpUnit, PumpColorOption } from './types';

export interface AddPumpStep1Props {
  messages: AddPumpStep1Messages;
  state: AddPumpFormState;
  onChange: (patch: Partial<AddPumpFormState>) => void;
  onPressScan?: (() => void) | undefined;
}

export function AddPumpStep1({
  messages,
  state,
  onChange,
  onPressScan,
}: AddPumpStep1Props): React.JSX.Element {
  return (
    <YStack gap={18}>
      <YStack>
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={22}
          fontWeight="500"
          letterSpacing={-0.22}
          color="$color"
        >
          {messages.heading}
        </Text>
        <Text fontSize={13} color="$colorMore" marginTop={4}>
          {messages.subtitle}
        </Text>
      </YStack>

      {/* Scan en raccourci */}
      <XStack
        tag="button"
        cursor="pointer"
        paddingHorizontal={16}
        paddingVertical={14}
        borderRadius={12}
        borderWidth={1}
        borderStyle="dashed"
        borderColor="$maint"
        alignItems="center"
        gap={12}
        backgroundColor="transparent"
        accessibilityRole="button"
        accessibilityLabel={messages.scanCta}
        {...(onPressScan ? { onPress: onPressScan } : {})}
        style={{
          background: 'color-mix(in oklch, var(--maint) 7%, var(--surface))',
        }}
      >
        <Text color="$maint" display="flex">
          <ScanIcon size={22} color="currentColor" />
        </Text>
        <YStack flex={1} alignItems="flex-start">
          <Text fontSize={13.5} fontWeight="600" color="$maint">
            {messages.scanCta}
          </Text>
          <Text fontSize={11.5} color="$maint" opacity={0.75} marginTop={2}>
            {messages.scanSub}
          </Text>
        </YStack>
        <Text color="$maint" opacity={0.6} display="flex">
          <ChevronRightIcon size={16} color="currentColor" />
        </Text>
      </XStack>

      <XStack alignItems="center" gap={10}>
        <Stack flex={1} height={1} backgroundColor="$borderColor" />
        <Text fontSize={11} color="$colorMore" textTransform="uppercase" letterSpacing={0.88}>
          {messages.orSeparator}
        </Text>
        <Stack flex={1} height={1} backgroundColor="$borderColor" />
      </XStack>

      <YStack gap={14}>
        <Field label={messages.nameLabel} helper={messages.nameHelp} htmlFor="pump-name">
          <input
            id="pump-name"
            type="text"
            value={state.name}
            placeholder={messages.namePlaceholder}
            onChange={(e) => onChange({ name: e.target.value })}
            style={inputBaseStyle}
          />
        </Field>

        <Field label={messages.substanceLabel} htmlFor="pump-substance">
          <input
            id="pump-substance"
            type="text"
            value={state.substance}
            placeholder={messages.substancePlaceholder}
            onChange={(e) => onChange({ substance: e.target.value })}
            style={inputBaseStyle}
          />
        </Field>

        <Stack
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 96px',
            gap: 10,
          }}
        >
          <Field label={messages.doseLabel} htmlFor="pump-dose">
            <input
              id="pump-dose"
              type="text"
              inputMode="numeric"
              value={state.dose}
              placeholder={messages.dosePlaceholder}
              onChange={(e) => onChange({ dose: e.target.value })}
              style={inputBaseStyle}
            />
          </Field>
          <Field label={messages.unitLabel} htmlFor="pump-unit">
            <select
              id="pump-unit"
              value={state.unit}
              onChange={(e) => onChange({ unit: e.target.value as AddPumpUnit })}
              style={{ ...inputBaseStyle, padding: '11px 10px' }}
            >
              {messages.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </Stack>
      </YStack>

      <YStack>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.66}
          fontWeight="600"
        >
          {messages.colorLabel}
        </Text>
        <Text fontSize={11.5} color="$colorMore" marginTop={4} marginBottom={10}>
          {messages.colorSub}
        </Text>
        <Stack
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 8,
          }}
        >
          {messages.colors.map((c) => (
            <ColorDot
              key={c.key}
              option={c}
              selected={state.colorKey === c.key}
              onPress={() => onChange({ colorKey: c.key })}
            />
          ))}
        </Stack>
      </YStack>
    </YStack>
  );
}

function ColorDot({
  option,
  selected,
  onPress,
}: {
  option: PumpColorOption;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Stack
      tag="button"
      cursor="pointer"
      borderRadius={999}
      borderWidth={selected ? 2 : 0.5}
      borderColor={selected ? '$color' : 'transparent'}
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      // `title` n'est pas typé sur Stack/Tamagui mais existe en HTML — on le
      // passe via les props natives DOM (le tooltip native est utile pour
      // les utilisateurs souris au-dessus de la pastille).
      {...({ title: option.label } as { title: string })}
      style={{
        aspectRatio: '1',
        background: option.value,
        position: 'relative',
        padding: 0,
        outline: selected ? '2px solid var(--surface)' : 'none',
        outlineOffset: -4,
        boxShadow: selected ? '0 0 0 1px var(--color)' : 'none',
      }}
    >
      {selected && (
        <Text color="white" display="flex">
          <CheckIcon size={14} color="white" />
        </Text>
      )}
    </Stack>
  );
}
