import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { BellIcon, CounterIcon, EmptyInhalerGlyph, PlusIcon, ScanIcon, ShareIcon } from './icons';
import type { PumpsEmptyMessages } from './types';

/**
 * Composition : disque pointillé + halo doux + glyph inhalateur + petit
 * badge `+` en bas-droite. Reproduit `EmptyInhalerArt` du HTML d'origine.
 */
export function EmptyInhalerArt({ size = 132 }: { size?: number }): React.JSX.Element {
  return (
    <Stack
      width={size}
      height={size}
      position="relative"
      alignItems="center"
      justifyContent="center"
    >
      {/* Halo radial doux teinté maint */}
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        borderRadius={size / 2}
        style={{
          background:
            'radial-gradient(circle at 50% 55%, color-mix(in oklch, var(--maint) 22%, transparent) 0%, transparent 65%)',
        }}
      />
      {/* Disque intérieur pointillé */}
      <Stack
        position="absolute"
        width={size * 0.74}
        height={size * 0.74}
        borderRadius={(size * 0.74) / 2}
        borderWidth={0.5}
        borderStyle="dashed"
        style={{
          background: 'color-mix(in oklch, var(--maint) 10%, var(--surface))',
          borderColor: 'color-mix(in oklch, var(--maint) 32%, transparent)',
        }}
      />
      {/* Glyph inhalateur central */}
      <Stack zIndex={1} display="flex">
        <EmptyInhalerGlyph
          size={size * 0.5}
          color="var(--maint)"
          fillBody="color-mix(in oklch, var(--maint) 8%, var(--surface))"
          fillSpacer="color-mix(in oklch, var(--maint) 4%, var(--surface))"
          hashStroke="color-mix(in oklch, var(--maint) 50%, var(--colorMore))"
        />
      </Stack>
      {/* Badge plus en bas-droite */}
      <Stack
        position="absolute"
        right={size * 0.12}
        bottom={size * 0.12}
        width={30}
        height={30}
        borderRadius={15}
        backgroundColor="$maint"
        alignItems="center"
        justifyContent="center"
        zIndex={2}
        style={{
          boxShadow: '0 6px 14px color-mix(in oklch, var(--maint) 32%, transparent)',
        }}
      >
        <Text color="white" display="flex">
          <PlusIcon size={13} color="white" />
        </Text>
      </Stack>
    </Stack>
  );
}

interface EmptyBenefitProps {
  icon: React.ReactNode;
  title: string;
  sub: string;
}

function EmptyBenefit({ icon, title, sub }: EmptyBenefitProps): React.JSX.Element {
  return (
    <XStack gap={12} alignItems="flex-start">
      <Stack
        width={32}
        height={32}
        borderRadius={9}
        backgroundColor="$surface2"
        alignItems="center"
        justifyContent="center"
        borderWidth={0.5}
        borderColor="$borderColor"
        flexShrink={0}
      >
        <Text color="$colorMuted" display="flex">
          {icon}
        </Text>
      </Stack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={13} fontWeight="600" color="$color" lineHeight={17}>
          {title}
        </Text>
        <Text fontSize={12} color="$colorMore" marginTop={2} lineHeight={17}>
          {sub}
        </Text>
      </YStack>
    </XStack>
  );
}

export interface PumpsEmptyBenefitsProps {
  messages: PumpsEmptyMessages;
}

export function PumpsEmptyBenefits({ messages }: PumpsEmptyBenefitsProps): React.JSX.Element {
  return (
    <YStack gap={14}>
      <EmptyBenefit
        icon={<CounterIcon size={15} color="currentColor" />}
        title={messages.benefit1Title}
        sub={messages.benefit1Sub}
      />
      <EmptyBenefit
        icon={<BellIcon size={15} color="currentColor" />}
        title={messages.benefit2Title}
        sub={messages.benefit2Sub}
      />
      <EmptyBenefit
        icon={<ShareIcon size={15} color="currentColor" />}
        title={messages.benefit3Title}
        sub={messages.benefit3Sub}
      />
    </YStack>
  );
}

export interface EmptyCtasProps {
  messages: PumpsEmptyMessages;
  onPressScan?: (() => void) | undefined;
  onPressManual?: (() => void) | undefined;
  layout?: 'stack' | 'inline';
}

export function EmptyCtas({
  messages,
  onPressScan,
  onPressManual,
  layout = 'stack',
}: EmptyCtasProps): React.JSX.Element {
  const Container = layout === 'stack' ? YStack : XStack;
  return (
    <Container gap={10} alignItems={layout === 'stack' ? 'stretch' : 'center'} flexWrap="wrap">
      <XStack
        tag="button"
        cursor="pointer"
        backgroundColor="$maint"
        paddingHorizontal={18}
        paddingVertical={layout === 'stack' ? 14 : 11}
        borderRadius={layout === 'stack' ? 14 : 12}
        alignItems="center"
        justifyContent="center"
        gap={8}
        borderWidth={0}
        accessibilityRole="button"
        accessibilityLabel={messages.scanCta}
        {...(onPressScan ? { onPress: onPressScan } : {})}
        style={{
          boxShadow:
            'var(--scan-shadow, 0 6px 18px color-mix(in oklch, var(--maint) 32%, transparent))',
        }}
      >
        <Text color="white" display="flex">
          <ScanIcon size={layout === 'stack' ? 17 : 16} color="white" />
        </Text>
        <Text fontSize={layout === 'stack' ? 14 : 13.5} fontWeight="600" color="white">
          {messages.scanCta}
        </Text>
      </XStack>
      <Stack
        tag="button"
        cursor="pointer"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$borderColorStrong"
        paddingHorizontal={18}
        paddingVertical={layout === 'stack' ? 13 : 10}
        borderRadius={layout === 'stack' ? 14 : 12}
        alignItems="center"
        justifyContent="center"
        accessibilityRole="button"
        accessibilityLabel={messages.manualCta}
        {...(onPressManual ? { onPress: onPressManual } : {})}
      >
        <Text fontSize={layout === 'stack' ? 14 : 13.5} fontWeight="600" color="$color">
          {messages.manualCta}
        </Text>
      </Stack>
    </Container>
  );
}
