import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { Field, inputBaseStyle } from './Field';
import { MinusIcon, PlusIcon } from './icons';
import type { AddPumpFormState, AddPumpStep2Messages, PumpKind } from './types';

export interface AddPumpStep2Props {
  messages: AddPumpStep2Messages;
  state: AddPumpFormState;
  onChange: (patch: Partial<AddPumpFormState>) => void;
}

const MAX_PUFFS = 8;
const MIN_PUFFS = 1;

export function AddPumpStep2({ messages, state, onChange }: AddPumpStep2Props): React.JSX.Element {
  const types: ReadonlyArray<{ k: PumpKind; name: string; sub: string; tone: 'maint' | 'rescue' }> =
    [
      { k: 'maint', name: messages.typeMaintName, sub: messages.typeMaintSub, tone: 'maint' },
      { k: 'rescue', name: messages.typeRescueName, sub: messages.typeRescueSub, tone: 'rescue' },
    ];
  const puffs = state.puffsPerDose;
  const puffsLabel = puffs > 1 ? messages.puffsPlural : messages.puffsSingular;

  return (
    <YStack gap={16}>
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

      <YStack>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.66}
          fontWeight="600"
          marginBottom={8}
        >
          {messages.typeLabel}
        </Text>
        <Stack style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {types.map((T) => {
            const sel = state.kind === T.k;
            const dotColor = T.tone === 'maint' ? '$maint' : '$rescue';
            return (
              <Stack
                key={T.k}
                tag="button"
                cursor="pointer"
                padding={14}
                borderRadius={12}
                borderWidth={0.5}
                borderColor={sel ? dotColor : '$borderColorStrong'}
                alignItems="flex-start"
                onPress={() => onChange({ kind: T.k })}
                accessibilityRole="button"
                accessibilityLabel={T.name}
                style={{
                  background: sel
                    ? T.tone === 'maint'
                      ? 'color-mix(in oklch, var(--maint) 8%, var(--surface))'
                      : 'color-mix(in oklch, var(--rescue) 8%, var(--surface))'
                    : 'var(--surface)',
                }}
              >
                <XStack alignItems="center" gap={8}>
                  <Stack width={10} height={10} borderRadius={5} backgroundColor={dotColor} />
                  <Text fontSize={13.5} fontWeight="600" color="$color">
                    {T.name}
                  </Text>
                </XStack>
                <Text fontSize={11.5} color="$colorMore" marginTop={4} textAlign="left">
                  {T.sub}
                </Text>
              </Stack>
            );
          })}
        </Stack>
      </YStack>

      <YStack>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.66}
          fontWeight="600"
          marginBottom={8}
        >
          {messages.puffsLabel}
        </Text>
        <XStack
          alignItems="center"
          gap={12}
          paddingHorizontal={16}
          paddingVertical={12}
          backgroundColor="$surface"
          borderWidth={0.5}
          borderColor="$borderColorStrong"
          borderRadius={12}
        >
          <Stack
            tag="button"
            cursor="pointer"
            width={32}
            height={32}
            borderRadius={8}
            borderWidth={0.5}
            borderColor="$borderColorStrong"
            backgroundColor="$surface"
            alignItems="center"
            justifyContent="center"
            onPress={() => onChange({ puffsPerDose: Math.max(MIN_PUFFS, puffs - 1) })}
            disabled={puffs <= MIN_PUFFS}
            accessibilityRole="button"
            accessibilityLabel={`${messages.puffsLabel} −`}
          >
            <Text color="$colorMuted" display="flex">
              <MinusIcon size={14} color="currentColor" />
            </Text>
          </Stack>
          <XStack flex={1} alignItems="baseline" justifyContent="center" gap={6}>
            <Text
              fontFamily="$mono"
              fontSize={26}
              fontWeight="500"
              color="$color"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {puffs}
            </Text>
            <Text fontSize={12} color="$colorMore">
              {puffsLabel}
            </Text>
          </XStack>
          <Stack
            tag="button"
            cursor="pointer"
            width={32}
            height={32}
            borderRadius={8}
            borderWidth={0.5}
            borderColor="$borderColorStrong"
            backgroundColor="$surface"
            alignItems="center"
            justifyContent="center"
            onPress={() => onChange({ puffsPerDose: Math.min(MAX_PUFFS, puffs + 1) })}
            disabled={puffs >= MAX_PUFFS}
            accessibilityRole="button"
            accessibilityLabel={`${messages.puffsLabel} +`}
          >
            <Text color="$colorMuted" display="flex">
              <PlusIcon size={14} color="currentColor" />
            </Text>
          </Stack>
        </XStack>
      </YStack>

      <YStack>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.66}
          fontWeight="600"
          marginBottom={8}
        >
          {messages.deviceLabel}
        </Text>
        <XStack flexWrap="wrap" gap={6}>
          {messages.devices.map((d) => {
            const sel = state.deviceKey === d.key;
            return (
              <Stack
                key={d.key}
                tag="button"
                cursor="pointer"
                paddingHorizontal={13}
                paddingVertical={7}
                borderRadius={99}
                borderWidth={0.5}
                borderColor={sel ? '$maint' : '$borderColor'}
                onPress={() => onChange({ deviceKey: d.key })}
                accessibilityRole="button"
                accessibilityLabel={d.label}
                style={{
                  background: sel
                    ? 'color-mix(in oklch, var(--maint) 12%, var(--surface))'
                    : 'var(--surface)',
                }}
              >
                <Text fontSize={12} fontWeight="500" color={sel ? '$maint' : '$colorMuted'}>
                  {d.label}
                </Text>
              </Stack>
            );
          })}
        </XStack>
      </YStack>

      <Field label={messages.prescriberLabel} htmlFor="pump-prescriber">
        <input
          id="pump-prescriber"
          type="text"
          value={state.prescriber}
          placeholder={messages.prescriberPlaceholder}
          onChange={(e) => onChange({ prescriber: e.target.value })}
          style={inputBaseStyle}
        />
      </Field>

      <Field label={messages.pharmacyLabel} htmlFor="pump-pharmacy">
        <input
          id="pump-pharmacy"
          type="text"
          value={state.pharmacy}
          placeholder={messages.pharmacyPlaceholder}
          onChange={(e) => onChange({ pharmacy: e.target.value })}
          style={inputBaseStyle}
        />
      </Field>
    </YStack>
  );
}
