import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { EmptyCtas, EmptyInhalerArt, PumpsEmptyBenefits } from './EmptyState';
import type { PumpsEmptyHandlers, PumpsEmptyMessages } from './types';

export interface PumpsEmptyMobileProps {
  messages: PumpsEmptyMessages;
  handlers?: PumpsEmptyHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function PumpsEmptyMobile({
  messages,
  handlers,
  theme = 'kinhale_light',
}: PumpsEmptyMobileProps): React.JSX.Element {
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
              {messages.headerTitle}
            </Text>
            <Text fontSize={12} color="$colorMore" marginTop={2}>
              {messages.headerCount}
            </Text>
          </YStack>
        </XStack>

        <Stack
          flex={1}
          paddingHorizontal={24}
          paddingTop={32}
          paddingBottom={24}
          style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}
        >
          <Stack alignItems="center" marginBottom={20}>
            <EmptyInhalerArt size={120} />
          </Stack>
          <Text
            tag="h2"
            margin={0}
            fontFamily="$heading"
            fontSize={22}
            fontWeight="500"
            letterSpacing={-0.44}
            color="$color"
            textAlign="center"
            lineHeight={26}
            style={{ textWrap: 'balance' as React.CSSProperties['textWrap'] }}
          >
            {messages.emptyHeading}
          </Text>
          <Text
            fontSize={13.5}
            color="$colorMuted"
            textAlign="center"
            marginTop={10}
            marginHorizontal={4}
            lineHeight={20}
            style={{ textWrap: 'pretty' as React.CSSProperties['textWrap'] }}
          >
            {messages.subtitle}
          </Text>

          <Stack marginTop={28}>
            <PumpsEmptyBenefits messages={messages} />
          </Stack>

          <Stack flex={1} minHeight={24} />

          <Text
            fontSize={11.5}
            color="$colorMore"
            textAlign="center"
            paddingHorizontal={8}
            lineHeight={17}
            marginBottom={14}
          >
            <Text fontWeight="600" color="$colorMuted">
              {messages.tipLabel} ·{' '}
            </Text>
            {messages.helpText}
          </Text>

          <EmptyCtas
            messages={messages}
            {...(handlers?.onPressScan ? { onPressScan: handlers.onPressScan } : {})}
            {...(handlers?.onPressManual ? { onPressManual: handlers.onPressManual } : {})}
            layout="stack"
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
