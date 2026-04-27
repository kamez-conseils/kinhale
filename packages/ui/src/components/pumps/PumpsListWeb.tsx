import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { AddPumpCard } from './AddPumpCard';
import { PlusIcon } from './icons';
import { PumpCard } from './PumpCard';
import { PumpsSidebar } from './PumpsSidebar';
import { SectionTitle } from './SectionTitle';
import type {
  PumpExpiryStatus,
  PumpsListHandlers,
  PumpsListMessages,
  PumpsNavItem,
  PumpView,
} from './types';

export interface PumpsListWebProps {
  messages: PumpsListMessages;
  pumps: ReadonlyArray<PumpView>;
  formatExpiry: (pump: PumpView) => PumpExpiryStatus;
  navItems: ReadonlyArray<PumpsNavItem>;
  /** Hint affiché sous le label de la card « Ajouter une pompe ». */
  addCardHint: string;
  handlers?: PumpsListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function PumpsListWeb({
  messages,
  pumps,
  formatExpiry,
  navItems,
  addCardHint,
  handlers,
  theme = 'kinhale_light',
}: PumpsListWebProps): React.JSX.Element {
  const maint = pumps.filter((p) => p.kind === 'maint');
  const rescue = pumps.filter((p) => p.kind === 'rescue');

  return (
    <Theme name={theme}>
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        backgroundColor="$background"
        overflow="hidden"
        style={{ display: 'grid', gridTemplateColumns: '224px 1fr' }}
      >
        <PumpsSidebar navItems={navItems} />
        <YStack tag="main" minHeight={0} style={{ overflow: 'auto' }}>
          {/* Header sticky */}
          <XStack
            paddingHorizontal={32}
            paddingVertical={20}
            alignItems="flex-end"
            justifyContent="space-between"
            borderBottomWidth={0.5}
            borderBottomColor="$borderColor"
            zIndex={5}
            style={{
              position: 'sticky',
              top: 0,
              background: 'color-mix(in oklch, var(--background) 90%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <YStack>
              <Text
                fontSize={11}
                color="$colorMore"
                textTransform="uppercase"
                letterSpacing={1.1}
                fontWeight="600"
              >
                {messages.childName}
              </Text>
              <Text
                tag="h1"
                margin={0}
                fontFamily="$heading"
                fontSize={28}
                fontWeight="500"
                letterSpacing={-0.56}
                color="$color"
                marginTop={2}
              >
                {messages.title}
              </Text>
              <Text fontSize={13} color="$colorMore" marginTop={4}>
                {messages.subtitle}
              </Text>
            </YStack>
            <XStack
              tag="button"
              cursor="pointer"
              backgroundColor="$maint"
              paddingHorizontal={18}
              paddingVertical={10}
              borderRadius={12}
              borderWidth={0}
              alignItems="center"
              gap={8}
              accessibilityRole="button"
              accessibilityLabel={messages.add}
              testID="pumps-add-cta"
              {...(handlers?.onPressAdd ? { onPress: handlers.onPressAdd } : {})}
              style={{
                boxShadow: '0 4px 14px color-mix(in oklch, var(--maint) 28%, transparent)',
              }}
            >
              <Text color="white" display="flex">
                <PlusIcon size={14} color="white" />
              </Text>
              <Text fontSize={13.5} fontWeight="600" color="white">
                {messages.add}
              </Text>
            </XStack>
          </XStack>

          <YStack paddingHorizontal={32} paddingTop={28} paddingBottom={48}>
            {maint.length > 0 && (
              <>
                <SectionTitle count={maint.length}>{messages.sectionMaint}</SectionTitle>
                <Stack
                  marginBottom={24}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 14,
                  }}
                >
                  {maint.map((p) => (
                    <PumpCard
                      key={p.id}
                      pump={p}
                      expiry={formatExpiry(p)}
                      stockLabel={messages.stockLabel}
                      primaryLabel={messages.primary}
                      refillLabel={messages.refill}
                      mode="web"
                      onPress={handlers?.onPressPump}
                      onPressRefill={handlers?.onPressRefill}
                    />
                  ))}
                </Stack>
              </>
            )}

            <SectionTitle count={rescue.length}>{messages.sectionRescue}</SectionTitle>
            <Stack
              marginBottom={18}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
              }}
            >
              {rescue.map((p) => (
                <PumpCard
                  key={p.id}
                  pump={p}
                  expiry={formatExpiry(p)}
                  stockLabel={messages.stockLabel}
                  primaryLabel={messages.primary}
                  refillLabel={messages.refill}
                  mode="web"
                  onPress={handlers?.onPressPump}
                  onPressRefill={handlers?.onPressRefill}
                />
              ))}
              <AddPumpCard
                label={messages.add}
                hint={addCardHint}
                mode="web"
                onPress={handlers?.onPressAdd}
              />
            </Stack>

            <Text
              fontSize={11}
              color="$colorFaint"
              textAlign="center"
              marginTop={24}
              fontStyle="italic"
            >
              {messages.notMedical}
            </Text>
          </YStack>
        </YStack>
      </Stack>
    </Theme>
  );
}
