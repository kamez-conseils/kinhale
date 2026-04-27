import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { CalendarGrid } from './CalendarGrid';
import { CalendarLegend } from './CalendarLegend';
import { FeedDayCard } from './FeedDay';
import { FilterPills } from './FilterPills';
import { HistorySidebar } from './HistorySidebar';
import { DownloadIcon, FilterIcon } from './icons';
import { MonthHeader } from './MonthHeader';
import { StatTile } from './StatTile';
import type {
  CalendarCell,
  FeedDay,
  HistoryFilter,
  HistoryListHandlers,
  HistoryListMessages,
  HistoryNavItem,
  HistoryStats,
} from './types';

export interface HistoryListWebProps {
  messages: HistoryListMessages;
  cells: ReadonlyArray<CalendarCell>;
  stats: HistoryStats;
  feed: ReadonlyArray<FeedDay>;
  activeFilter: HistoryFilter;
  navItems: ReadonlyArray<HistoryNavItem>;
  handlers?: HistoryListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function HistoryListWeb({
  messages,
  cells,
  stats,
  feed,
  activeFilter,
  navItems,
  handlers,
  theme = 'kinhale_light',
}: HistoryListWebProps): React.JSX.Element {
  const hasEntries = feed.some((d) => d.entries.length > 0);

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
        <HistorySidebar navItems={navItems} />

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
            </YStack>

            <XStack gap={10}>
              <XStack
                tag="button"
                cursor="pointer"
                backgroundColor="$surface"
                borderWidth={0.5}
                borderColor="$borderColorStrong"
                paddingHorizontal={14}
                paddingVertical={8}
                borderRadius={10}
                alignItems="center"
                gap={6}
                accessibilityRole="button"
                accessibilityLabel={messages.filtersLabel}
              >
                <Text color="$colorMuted" display="flex">
                  <FilterIcon size={13} color="currentColor" />
                </Text>
                <Text fontSize={13} fontWeight="500" color="$colorMuted">
                  {messages.filtersLabel}
                </Text>
              </XStack>
              <XStack
                tag="button"
                cursor="pointer"
                backgroundColor="$maint"
                borderWidth={0}
                paddingHorizontal={14}
                paddingVertical={8}
                borderRadius={10}
                alignItems="center"
                gap={6}
                accessibilityRole="button"
                accessibilityLabel={messages.exportLabel}
                {...(handlers?.onPressExport ? { onPress: handlers.onPressExport } : {})}
                style={{
                  boxShadow: '0 2px 8px color-mix(in oklch, var(--maint) 28%, transparent)',
                }}
              >
                <Text color="white" display="flex">
                  <DownloadIcon size={13} color="white" />
                </Text>
                <Text fontSize={13} fontWeight="600" color="white">
                  {messages.exportLabel}
                </Text>
              </XStack>
            </XStack>
          </XStack>

          {/* Content grid : calendrier + stats à gauche / fil à droite */}
          <Stack
            paddingHorizontal={32}
            paddingTop={24}
            paddingBottom={48}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 24,
            }}
          >
            {/* Left col */}
            <YStack gap={16} minWidth={0}>
              <YStack
                backgroundColor="$surface"
                borderRadius={18}
                padding={22}
                borderWidth={0.5}
                borderColor="$borderColor"
              >
                <MonthHeader
                  monthLabel={messages.monthLabel}
                  labelMinWidth={130}
                  {...(handlers?.onPressPrevMonth
                    ? { onPressPrev: handlers.onPressPrevMonth }
                    : {})}
                  {...(handlers?.onPressNextMonth
                    ? { onPressNext: handlers.onPressNextMonth }
                    : {})}
                  trailing={<CalendarLegend messages={messages} inline />}
                />
                <CalendarGrid
                  weekdays={messages.weekdays}
                  cells={cells}
                  {...(handlers?.onPressDay ? { onPressDay: handlers.onPressDay } : {})}
                />
              </YStack>

              <XStack gap={10}>
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
            </YStack>

            {/* Right col : fil */}
            <YStack minWidth={0}>
              <Stack marginBottom={14}>
                <FilterPills
                  active={activeFilter}
                  labelAll={messages.filterAll}
                  labelMaint={messages.filterMaint}
                  labelRescue={messages.filterRescue}
                  {...(handlers?.onChangeFilter ? { onChange: handlers.onChangeFilter } : {})}
                />
              </Stack>
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
            </YStack>
          </Stack>
        </YStack>
      </Stack>
    </Theme>
  );
}
