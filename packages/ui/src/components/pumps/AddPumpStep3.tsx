import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { SmallClockIcon } from './icons';
import type { AddPumpFormState, AddPumpScheduleSlot, AddPumpStep3Messages } from './types';

export interface AddPumpStep3Props {
  messages: AddPumpStep3Messages;
  state: AddPumpFormState;
  onChange: (patch: Partial<AddPumpFormState>) => void;
}

export function AddPumpStep3({ messages, state, onChange }: AddPumpStep3Props): React.JSX.Element {
  const toggleSlot = (key: string): void => {
    const next = state.schedule.map((s) => (s.key === key ? { ...s, on: !s.on } : s));
    onChange({ schedule: next });
  };

  const updateTime = (key: string, time: string): void => {
    const next = state.schedule.map((s) => (s.key === key ? { ...s, time } : s));
    onChange({ schedule: next });
  };

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

      <YStack
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColor"
        borderRadius={14}
        overflow="hidden"
      >
        {state.schedule.map((row, i) => (
          <ScheduleRow
            key={row.key}
            row={row}
            isFirst={i === 0}
            onToggle={() => toggleSlot(row.key)}
            onTimeChange={(t) => updateTime(row.key, t)}
          />
        ))}
      </YStack>

      <XStack
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColor"
        borderRadius={12}
        padding="$4"
        alignItems="center"
        gap={12}
      >
        <YStack flex={1}>
          <Text fontSize={13.5} fontWeight="500" color="$color">
            {messages.escalationLabel}
          </Text>
          <Text fontSize={11.5} color="$colorMore" marginTop={2}>
            {messages.escalationSub}
          </Text>
        </YStack>
        <ToggleSwitch
          on={state.escalation}
          onPress={() => onChange({ escalation: !state.escalation })}
          ariaLabel={messages.escalationLabel}
        />
      </XStack>
    </YStack>
  );
}

function ScheduleRow({
  row,
  isFirst,
  onToggle,
  onTimeChange,
}: {
  row: AddPumpScheduleSlot;
  isFirst: boolean;
  onToggle: () => void;
  onTimeChange: (t: string) => void;
}): React.JSX.Element {
  return (
    <XStack
      alignItems="center"
      gap={12}
      paddingHorizontal={16}
      paddingVertical={14}
      borderTopWidth={isFirst ? 0 : 0.5}
      borderTopColor="$borderColor"
    >
      <Stack
        width={28}
        height={28}
        borderRadius={8}
        alignItems="center"
        justifyContent="center"
        backgroundColor={row.on ? '$maintSoft' : '$surface2'}
      >
        <Text color={row.on ? '$maint' : '$colorMore'} display="flex">
          <SmallClockIcon size={14} color="currentColor" />
        </Text>
      </Stack>
      <YStack flex={1}>
        <Text fontSize={13.5} fontWeight="500" color={row.on ? '$color' : '$colorMore'}>
          {row.label}
        </Text>
        <input
          type="time"
          value={row.time}
          onChange={(e) => onTimeChange(e.target.value)}
          aria-label={row.label}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 11.5,
            color: 'var(--colorMore)',
            padding: 0,
            marginTop: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        />
      </YStack>
      <ToggleSwitch on={row.on} onPress={onToggle} ariaLabel={row.label} />
    </XStack>
  );
}

function ToggleSwitch({
  on,
  onPress,
  ariaLabel,
}: {
  on: boolean;
  onPress: () => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <Stack
      tag="button"
      cursor="pointer"
      width={40}
      height={24}
      borderRadius={12}
      borderWidth={0}
      backgroundColor={on ? '$maint' : '$borderColorStrong'}
      position="relative"
      flexShrink={0}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={ariaLabel}
      accessibilityState={{ checked: on }}
      style={{ transition: 'background .15s' }}
    >
      <Stack
        position="absolute"
        top={2}
        width={20}
        height={20}
        borderRadius={10}
        backgroundColor="$white"
        style={{
          left: on ? 18 : 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left .15s',
        }}
      />
    </Stack>
  );
}
