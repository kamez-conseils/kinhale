import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { CalendarGrid } from './CalendarGrid';
import { CalendarLegend } from './CalendarLegend';
import { FeedDayCard } from './FeedDay';
import { FilterPills } from './FilterPills';
import { DownloadIcon, PlusIconSm } from './icons';
import { MonthHeader } from './MonthHeader';
import { StatTile } from './StatTile';
import type {
  CalendarCell,
  FeedDay,
  HistoryFilter,
  HistoryListHandlers,
  HistoryListMessages,
  HistoryStats,
} from './types';

export interface HistoryListMobileProps {
  messages: HistoryListMessages;
  cells: ReadonlyArray<CalendarCell>;
  stats: HistoryStats;
  feed: ReadonlyArray<FeedDay>;
  activeFilter: HistoryFilter;
  handlers?: HistoryListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function HistoryListMobile({
  messages,
  cells,
  stats,
  feed,
  activeFilter,
  handlers,
  theme = 'kinhale_light',
}: HistoryListMobileProps): React.JSX.Element {
  const hasEntries = feed.some((d) => d.entries.length > 0);

  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
        {/* Header */}
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
            backgroundColor="$surface"
            borderWidth={0.5}
            borderColor="$borderColorStrong"
            paddingHorizontal={12}
            paddingVertical={8}
            borderRadius={99}
            alignItems="center"
            gap={6}
            accessibilityRole="button"
            accessibilityLabel={messages.exportLabel}
            {...(handlers?.onPressExport ? { onPress: handlers.onPressExport } : {})}
          >
            <Text color="$colorMuted" display="flex">
              <DownloadIcon size={13} color="currentColor" />
            </Text>
            <Text fontSize={12} fontWeight="500" color="$colorMuted">
              {messages.exportLabel}
            </Text>
          </XStack>
        </XStack>

        <Stack
          flex={1}
          paddingHorizontal={16}
          paddingTop={16}
          paddingBottom={80}
          style={{ overflow: 'auto' }}
        >
          {/* Calendrier mensuel */}
          <YStack
            backgroundColor="$surface"
            borderRadius={18}
            padding={18}
            borderWidth={0.5}
            borderColor="$borderColor"
            marginBottom={14}
          >
            <MonthHeader
              monthLabel={messages.monthLabel}
              size="sm"
              {...(handlers?.onPressPrevMonth ? { onPressPrev: handlers.onPressPrevMonth } : {})}
              {...(handlers?.onPressNextMonth ? { onPressNext: handlers.onPressNextMonth } : {})}
            />
            <CalendarGrid
              weekdays={messages.weekdays}
              cells={cells}
              compact
              {...(handlers?.onPressDay ? { onPressDay: handlers.onPressDay } : {})}
            />
            <CalendarLegend messages={messages} />
          </YStack>

          {/* Statistiques mensuelles */}
          <XStack gap={8} marginBottom={18}>
            <StatTile
              label={messages.statAdherenceLabel}
              value={String(stats.adherencePct)}
              suffix="%"
              tone="ok"
            />
            <StatTile
              label={messages.statRescueLabel}
              value={String(stats.rescueCount)}
              tone="rescue"
            />
            <StatTile
              label={messages.statStreakLabel}
              value={String(stats.longestStreakDays)}
              suffix={messages.daysSuffix}
              tone="maint"
            />
          </XStack>

          {/* Filtres */}
          <Stack marginBottom={16}>
            <FilterPills
              active={activeFilter}
              labelAll={messages.filterAll}
              labelMaint={messages.filterMaint}
              labelRescue={messages.filterRescue}
              fullWidth
              {...(handlers?.onChangeFilter ? { onChange: handlers.onChangeFilter } : {})}
            />
          </Stack>

          {/* Fil d'activité */}
          {hasEntries ? (
            feed
              .filter((d) => d.entries.length > 0)
              .map((day, i) => (
                <FeedDayCard
                  key={`${day.label}-${i}`}
                  data={day}
                  pillFond={messages.pillFond}
                  pillSecours={messages.pillSecours}
                  formatBy={messages.formatBy}
                  markers={{
                    voided: messages.markerVoided,
                    pendingReview: messages.markerPendingReview,
                    backfill: messages.markerBackfill,
                    missed: messages.markerMissed,
                  }}
                  {...(handlers?.onPressEntry ? { onPressEntry: handlers.onPressEntry } : {})}
                />
              ))
          ) : (
            <YStack
              padding={24}
              backgroundColor="$surface"
              borderRadius={14}
              borderWidth={0.5}
              borderColor="$borderColor"
              alignItems="center"
              gap={6}
            >
              <Text fontFamily="$heading" fontSize={16} fontWeight="500" color="$color">
                {messages.emptyTitle}
              </Text>
              <Text fontSize={12.5} color="$colorMore" textAlign="center">
                {messages.emptySub}
              </Text>
            </YStack>
          )}

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

        {/* FAB add */}
        {handlers?.onPressAdd && (
          <Stack
            tag="button"
            cursor="pointer"
            position="absolute"
            bottom={20}
            right={20}
            width={56}
            height={56}
            borderRadius={28}
            backgroundColor="$maint"
            borderWidth={0}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={messages.addCta}
            onPress={handlers.onPressAdd}
            style={{
              boxShadow: '0 6px 18px color-mix(in oklch, var(--maint) 32%, transparent)',
            }}
          >
            <Text color="white" display="flex">
              <PlusIconSm size={20} color="white" />
            </Text>
          </Stack>
        )}
      </YStack>
    </Theme>
  );
}
