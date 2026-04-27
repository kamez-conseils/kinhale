import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { CheckIcon } from '../../icons';
import type { AddPumpFormState, AddPumpStep2Messages, AddPumpStep4Messages } from './types';

export interface AddPumpStep4Props {
  messages: AddPumpStep4Messages;
  /** Réutilisé pour résoudre le libellé du type / dispositif. */
  step2Messages: AddPumpStep2Messages;
  state: AddPumpFormState;
}

export function AddPumpStep4({
  messages,
  step2Messages,
  state,
}: AddPumpStep4Props): React.JSX.Element {
  const summary = buildSummary(state, messages, step2Messages);
  return (
    <YStack gap={18} alignItems="center" paddingTop={12}>
      <Stack
        width={64}
        height={64}
        borderRadius={32}
        alignItems="center"
        justifyContent="center"
        style={{
          background: 'color-mix(in oklch, var(--maint) 14%, var(--surface))',
        }}
      >
        <Text color="$maint" display="flex">
          <CheckIcon size={30} color="currentColor" />
        </Text>
      </Stack>
      <YStack alignItems="center">
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={24}
          fontWeight="500"
          letterSpacing={-0.24}
          color="$color"
          textAlign="center"
        >
          {messages.heading}
        </Text>
        <Text fontSize={13} color="$colorMore" marginTop={4} textAlign="center">
          {messages.subtitle}
        </Text>
      </YStack>

      <YStack
        width="100%"
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColor"
        borderRadius={14}
        paddingHorizontal={18}
        paddingVertical={16}
      >
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
          marginBottom={10}
        >
          {messages.summaryLabel}
        </Text>
        {summary.map((row, i) => (
          <XStack
            key={row.label}
            justifyContent="space-between"
            paddingVertical={8}
            borderTopWidth={i === 0 ? 0 : 0.5}
            borderTopColor="$borderColor"
          >
            <Text fontSize={12.5} color="$colorMore">
              {row.label}
            </Text>
            <Text fontSize={13} color="$color" fontWeight="500" textAlign="right">
              {row.value}
            </Text>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function buildSummary(
  state: AddPumpFormState,
  m: AddPumpStep4Messages,
  s2: AddPumpStep2Messages,
): ReadonlyArray<{ label: string; value: string }> {
  const substanceParts = [state.substance, state.dose, state.unit].filter(Boolean);
  const substance = substanceParts.length > 0 ? substanceParts.join(' ') : m.notSet;
  const typeLabel =
    state.kind === 'maint'
      ? s2.typeMaintName
      : state.kind === 'rescue'
        ? s2.typeRescueName
        : m.notSet;
  const deviceLabel = state.deviceKey
    ? (s2.devices.find((d) => d.key === state.deviceKey)?.label ?? m.notSet)
    : m.notSet;
  const puffsLabel = state.puffsPerDose > 1 ? s2.puffsPlural : s2.puffsSingular;
  const dose = `${state.puffsPerDose} ${puffsLabel} · ${deviceLabel}`;
  const activeSlots = state.schedule.filter((s) => s.on);
  const schedule =
    activeSlots.length > 0
      ? activeSlots.map((s) => `${s.label}${s.time ? ` ${s.time}` : ''}`).join(' · ')
      : m.notSet;

  return [
    { label: m.fieldPump, value: state.name || m.notSet },
    { label: m.fieldSubstance, value: substance },
    { label: m.fieldType, value: typeLabel },
    { label: m.fieldDose, value: dose },
    { label: m.fieldSchedule, value: schedule },
  ];
}
