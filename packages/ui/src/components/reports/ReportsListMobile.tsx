import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { ChartsCard } from './Sparklines';
import { DownloadIcon, ShareIcon } from './icons';
import { RangePicker } from './RangePicker';
import { RescueEventsList } from './RescueEventsList';
import { StatBlock } from './StatBlock';
import type { RangePreset, RescueEventView, ReportsHandlers, ReportsMessages } from './types';

export interface ReportsListMobileProps {
  messages: ReportsMessages;
  activeRange: RangePreset;
  rescueEvents: ReadonlyArray<RescueEventView>;
  /** Pourcentages d'adhérence quotidienne (30 derniers jours). */
  adherenceSeries: ReadonlyArray<number>;
  /** Nombre de prises de secours par jour (30 derniers jours). */
  rescueSeries: ReadonlyArray<number>;
  handlers?: ReportsHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function ReportsListMobile({
  messages,
  activeRange,
  rescueEvents,
  adherenceSeries,
  rescueSeries,
  handlers,
  theme = 'kinhale_light',
}: ReportsListMobileProps): React.JSX.Element {
  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
        <YStack
          tag="header"
          paddingHorizontal={20}
          paddingTop={8}
          paddingBottom={14}
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
        >
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

        <Stack
          flex={1}
          paddingHorizontal={16}
          paddingTop={14}
          paddingBottom={24}
          style={{ overflow: 'auto' }}
        >
          <Stack marginBottom={14}>
            <RangePicker
              label={messages.rangeLabel}
              options={messages.presets}
              active={activeRange}
              selectedRangeLabel={messages.selectedRangeLabel}
              mode="mobile"
              {...(handlers?.onChangeRange ? { onChange: handlers.onChangeRange } : {})}
            />
          </Stack>

          <Stack
            marginBottom={14}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {messages.stats.map((s) => (
              <StatBlock
                key={s.key}
                label={s.label}
                value={s.value}
                {...(s.suffix !== undefined ? { suffix: s.suffix } : {})}
                sub={s.sub}
                tone={s.tone}
              />
            ))}
          </Stack>

          <Stack marginBottom={14}>
            <ChartsCard
              adherence={adherenceSeries}
              rescue={rescueSeries}
              adherenceLabel={messages.adherenceChartLabel}
              rescueLabel={messages.rescueChartLabel}
              mode="mobile"
            />
          </Stack>

          <Text
            tag="h2"
            margin={0}
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.88}
            fontWeight="600"
            marginTop={4}
            marginBottom={10}
          >
            {messages.rescueLogTitle}
          </Text>
          <RescueEventsList
            events={rescueEvents}
            reliefSuffix={messages.reliefSuffix}
            emptyTitle={messages.emptyRescueTitle}
            emptySub={messages.emptyRescueSub}
            mode="mobile"
            {...(handlers?.onPressEvent ? { onPressEvent: handlers.onPressEvent } : {})}
          />

          <Stack
            marginTop={18}
            padding={14}
            backgroundColor="$amberSoft"
            borderRadius={12}
            borderWidth={0.5}
            borderColor="$amber"
            alignItems="center"
          >
            <Text fontSize={11.5} color="$amberInk" textAlign="center" fontStyle="italic">
              {messages.notMedical}
            </Text>
          </Stack>
        </Stack>

        {/* Sticky action bar */}
        <XStack
          paddingHorizontal={16}
          paddingVertical={12}
          borderTopWidth={0.5}
          borderTopColor="$borderColor"
          gap={8}
          style={{
            background: 'color-mix(in oklch, var(--background) 92%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Stack
            tag="button"
            cursor="pointer"
            flex={1}
            backgroundColor="$surface"
            borderWidth={0.5}
            borderColor="$borderColorStrong"
            paddingVertical={12}
            borderRadius={12}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            gap={8}
            accessibilityRole="button"
            accessibilityLabel={messages.shareLabel}
            {...(handlers?.onPressShare ? { onPress: handlers.onPressShare } : {})}
          >
            <Text color="$colorMuted" display="flex" alignItems="center" justifyContent="center">
              <ShareIcon size={14} color="currentColor" />
            </Text>
            <Text fontSize={13} fontWeight="600" color="$colorMuted">
              {messages.shareLabel}
            </Text>
          </Stack>
          <Stack
            tag="button"
            cursor="pointer"
            flex={1}
            backgroundColor="$maint"
            borderWidth={0}
            paddingVertical={12}
            borderRadius={12}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            gap={8}
            accessibilityRole="button"
            accessibilityLabel={messages.exportLabel}
            testID="reports-export-cta"
            {...(handlers?.onPressExport ? { onPress: handlers.onPressExport } : {})}
            style={{ boxShadow: '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)' }}
          >
            <Text color="white" display="flex" alignItems="center" justifyContent="center">
              <DownloadIcon size={14} color="white" />
            </Text>
            <Text fontSize={13} fontWeight="600" color="white">
              {messages.exportLabel}
            </Text>
          </Stack>
        </XStack>
      </YStack>
    </Theme>
  );
}
