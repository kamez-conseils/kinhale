import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { InhalerMaintIcon, InhalerRescueIcon } from '../../icons';
import type { AddPumpFormState, AddPumpMessages } from './types';

export interface AddPumpPreviewProps {
  messages: AddPumpMessages;
  state: AddPumpFormState;
}

/**
 * Panneau d'aperçu temps réel à droite du wizard côté desktop. Affiche
 * un mini-résumé qui se met à jour à mesure que l'utilisateur complète
 * les étapes — donne un sens d'accomplissement immédiat.
 */
export function AddPumpPreview({ messages, state }: AddPumpPreviewProps): React.JSX.Element {
  const isRescue = state.kind === 'rescue';
  const isMaint = state.kind === 'maint';
  const kindLabel = isRescue
    ? messages.previewKindRescue
    : isMaint
      ? messages.previewKindMaint
      : messages.step4.notSet;
  const substanceParts = [state.substance, state.dose, state.unit].filter(Boolean);
  const substanceLabel =
    substanceParts.length > 0 ? substanceParts.join(' ') : messages.step4.notSet;
  const puffsLabel =
    state.puffsPerDose > 1 ? messages.previewPuffPlural : messages.previewPuffSingular;
  const activeSlots = state.schedule.filter((s) => s.on);
  const iconColor = isRescue ? '$rescueInk' : '$maintInk';
  const iconBg = isRescue ? '$rescueSoft' : '$maintSoft';

  return (
    <YStack
      width={280}
      paddingHorizontal={22}
      paddingVertical={24}
      backgroundColor="$surface2"
      borderLeftWidth={0.5}
      borderLeftColor="$borderColor"
      style={{ overflow: 'auto' }}
    >
      <Text
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
        marginBottom={14}
      >
        {messages.previewLabel}
      </Text>

      <YStack
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColor"
        borderRadius={14}
        padding={18}
      >
        <XStack alignItems="center" gap={10} marginBottom={12}>
          <Stack
            width={36}
            height={36}
            borderRadius={9}
            backgroundColor={iconBg}
            alignItems="center"
            justifyContent="center"
          >
            <Text color={iconColor} display="flex">
              {isRescue ? (
                <InhalerRescueIcon size={20} color="currentColor" />
              ) : (
                <InhalerMaintIcon size={20} color="currentColor" />
              )}
            </Text>
          </Stack>
          <YStack flex={1} minWidth={0}>
            <Text fontSize={13.5} fontWeight="600" color="$color" numberOfLines={1}>
              {state.name || messages.step1.namePlaceholder}
            </Text>
            <Text fontSize={11} color="$colorMore" marginTop={1}>
              {kindLabel}
            </Text>
          </YStack>
        </XStack>
        <YStack gap={6}>
          <PreviewRow
            label={messages.step2.puffsLabel}
            value={`${state.puffsPerDose} ${puffsLabel}`}
          />
          <PreviewRow
            label={messages.step1.substanceLabel}
            value={substanceLabel}
            mono={substanceLabel !== messages.step4.notSet}
          />
          {activeSlots.length > 0 ? (
            activeSlots.map((s) => (
              <PreviewRow
                key={s.key}
                label={s.label}
                value={s.time || messages.step4.notSet}
                mono
              />
            ))
          ) : (
            <PreviewRow label={messages.step3.short} value={messages.step4.notSet} />
          )}
        </YStack>
      </YStack>
      <Text fontSize={11} color="$colorMore" marginTop={14} lineHeight={17}>
        {messages.previewHint}
      </Text>
    </YStack>
  );
}

function PreviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <XStack justifyContent="space-between" alignItems="baseline" gap={12}>
      <Text fontSize={12.5} color="$colorMore">
        {label}
      </Text>
      <Text
        fontSize={12.5}
        color="$color"
        fontWeight="500"
        textAlign="right"
        {...(mono ? { fontFamily: '$mono' } : {})}
        style={mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}
      >
        {value}
      </Text>
    </XStack>
  );
}
