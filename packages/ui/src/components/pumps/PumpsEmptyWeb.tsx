import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { EmptyCtas, EmptyInhalerArt, PumpsEmptyBenefits } from './EmptyState';
import { PumpsSidebar } from './PumpsSidebar';
import type { PumpsEmptyHandlers, PumpsEmptyMessages, PumpsNavItem } from './types';

export interface PumpsEmptyWebProps {
  messages: PumpsEmptyMessages;
  /** Eyebrow au-dessus du titre header (ex. prénom enfant en uppercase). */
  eyebrow: string;
  navItems: ReadonlyArray<PumpsNavItem>;
  handlers?: PumpsEmptyHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function PumpsEmptyWeb({
  messages,
  eyebrow,
  navItems,
  handlers,
  theme = 'kinhale_light',
}: PumpsEmptyWebProps): React.JSX.Element {
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
                {eyebrow}
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
                {messages.headerTitle}
              </Text>
              <Text fontSize={13} color="$colorMore" marginTop={4}>
                {messages.headerCount}
              </Text>
            </YStack>
          </XStack>

          <Stack
            flex={1}
            paddingHorizontal={32}
            paddingVertical={40}
            alignItems="center"
            justifyContent="center"
          >
            <Stack
              width="100%"
              maxWidth={720}
              backgroundColor="$surface"
              borderWidth={0.5}
              borderColor="$borderColor"
              borderRadius={24}
              padding="$6"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                gap: 36,
                alignItems: 'center',
              }}
            >
              <Stack alignItems="center" justifyContent="center">
                <EmptyInhalerArt size={156} />
              </Stack>
              <YStack>
                <Text
                  tag="h2"
                  margin={0}
                  fontFamily="$heading"
                  fontSize={26}
                  fontWeight="500"
                  letterSpacing={-0.52}
                  color="$color"
                  lineHeight={31}
                  style={{ textWrap: 'balance' as React.CSSProperties['textWrap'] }}
                >
                  {messages.emptyHeading}
                </Text>
                <Text
                  fontSize={14}
                  color="$colorMuted"
                  marginTop={12}
                  marginBottom={22}
                  lineHeight={22}
                  style={{ textWrap: 'pretty' as React.CSSProperties['textWrap'] }}
                >
                  {messages.subtitle}
                </Text>

                <Stack marginBottom={24}>
                  <PumpsEmptyBenefits messages={messages} />
                </Stack>

                <EmptyCtas
                  messages={messages}
                  {...(handlers?.onPressScan ? { onPressScan: handlers.onPressScan } : {})}
                  {...(handlers?.onPressManual ? { onPressManual: handlers.onPressManual } : {})}
                  layout="inline"
                />

                <Text fontSize={12} color="$colorMore" marginTop={18} lineHeight={18}>
                  <Text fontWeight="600" color="$colorMuted">
                    {messages.tipLabel} ·{' '}
                  </Text>
                  {messages.helpText}
                </Text>
              </YStack>
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
          </Stack>
        </YStack>
      </Stack>
    </Theme>
  );
}
