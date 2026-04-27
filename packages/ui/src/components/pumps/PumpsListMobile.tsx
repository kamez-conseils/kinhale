import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { AddPumpCard } from './AddPumpCard';
import { PlusIcon } from './icons';
import { PumpCard } from './PumpCard';
import { SectionTitle } from './SectionTitle';
import type { PumpExpiryStatus, PumpsListHandlers, PumpsListMessages, PumpView } from './types';

export interface PumpsListMobileProps {
  messages: PumpsListMessages;
  pumps: ReadonlyArray<PumpView>;
  /** Calcul du libellé d'expiration (déjà localisé) — l'app le construit. */
  formatExpiry: (pump: PumpView) => PumpExpiryStatus;
  /** Hint affiché sous le label de la card « Ajouter une pompe ». */
  addCardHint: string;
  handlers?: PumpsListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function PumpsListMobile({
  messages,
  pumps,
  formatExpiry,
  addCardHint,
  handlers,
  theme = 'kinhale_light',
}: PumpsListMobileProps): React.JSX.Element {
  const maint = pumps.filter((p) => p.kind === 'maint');
  const rescue = pumps.filter((p) => p.kind === 'rescue');

  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
        <XStack
          tag="header"
          paddingHorizontal={20}
          paddingTop={8}
          paddingBottom={16}
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
        >
          <YStack>
            <Text
              tag="h1"
              margin={0}
              fontFamily="$heading"
              fontSize={24}
              fontWeight="500"
              letterSpacing={-0.48}
              color="$color"
            >
              {messages.title}
            </Text>
            <Text fontSize={12} color="$colorMore" marginTop={2}>
              {messages.subtitle}
            </Text>
          </YStack>
          <XStack
            tag="button"
            cursor="pointer"
            backgroundColor="$maint"
            paddingHorizontal={14}
            paddingVertical={8}
            borderRadius={99}
            borderWidth={0}
            alignItems="center"
            gap={6}
            accessibilityRole="button"
            accessibilityLabel={messages.add}
            testID="pumps-add-cta"
            {...(handlers?.onPressAdd ? { onPress: handlers.onPressAdd } : {})}
            style={{
              boxShadow: '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)',
            }}
          >
            <Text color="white" display="flex">
              <PlusIcon size={13} color="white" />
            </Text>
            <Text fontSize={12.5} fontWeight="600" color="white">
              {messages.addShort}
            </Text>
          </XStack>
        </XStack>

        <Stack
          flex={1}
          paddingHorizontal={16}
          paddingTop={16}
          paddingBottom={32}
          style={{ overflow: 'auto' }}
        >
          {maint.length > 0 && (
            <>
              <SectionTitle count={maint.length}>{messages.sectionMaint}</SectionTitle>
              <YStack gap={12}>
                {maint.map((p) => (
                  <PumpCard
                    key={p.id}
                    pump={p}
                    expiry={formatExpiry(p)}
                    stockLabel={messages.stockLabel}
                    primaryLabel={messages.primary}
                    refillLabel={messages.refill}
                    mode="mobile"
                    onPress={handlers?.onPressPump}
                    onPressRefill={handlers?.onPressRefill}
                  />
                ))}
              </YStack>
            </>
          )}

          {rescue.length > 0 && (
            <>
              <SectionTitle count={rescue.length}>{messages.sectionRescue}</SectionTitle>
              <YStack gap={12} marginBottom={16}>
                {rescue.map((p) => (
                  <PumpCard
                    key={p.id}
                    pump={p}
                    expiry={formatExpiry(p)}
                    stockLabel={messages.stockLabel}
                    primaryLabel={messages.primary}
                    refillLabel={messages.refill}
                    mode="mobile"
                    onPress={handlers?.onPressPump}
                    onPressRefill={handlers?.onPressRefill}
                  />
                ))}
              </YStack>
            </>
          )}

          <AddPumpCard
            label={messages.add}
            hint={addCardHint}
            mode="mobile"
            onPress={handlers?.onPressAdd}
          />

          <Text
            fontSize={11}
            color="$colorFaint"
            textAlign="center"
            marginTop={20}
            fontStyle="italic"
          >
            {messages.notMedical}
          </Text>
        </Stack>
      </YStack>
    </Theme>
  );
}
