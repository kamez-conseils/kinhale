import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { ReportsSidebar } from './ReportsSidebar';
import { ChartsCard } from './Sparklines';
import { DownloadIcon, ShareIcon } from './icons';
import { RangePicker } from './RangePicker';
import { RescueEventsList } from './RescueEventsList';
import { StatBlock } from './StatBlock';
import type {
  RangePreset,
  RescueEventView,
  ReportsHandlers,
  ReportsMessages,
  ReportsNavItem,
} from './types';

export interface ReportsListWebProps {
  messages: ReportsMessages;
  activeRange: RangePreset;
  rescueEvents: ReadonlyArray<RescueEventView>;
  adherenceSeries: ReadonlyArray<number>;
  rescueSeries: ReadonlyArray<number>;
  navItems: ReadonlyArray<ReportsNavItem>;
  handlers?: ReportsHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function ReportsListWeb({
  messages,
  activeRange,
  rescueEvents,
  adherenceSeries,
  rescueSeries,
  navItems,
  handlers,
  theme = 'kinhale_light',
}: ReportsListWebProps): React.JSX.Element {
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
        <ReportsSidebar navItems={navItems} />

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

            <XStack gap={10}>
              <Stack
                tag="button"
                cursor="pointer"
                backgroundColor="$surface"
                borderWidth={0.5}
                borderColor="$borderColorStrong"
                paddingHorizontal={14}
                paddingVertical={8}
                borderRadius={10}
                flexDirection="row"
                alignItems="center"
                gap={6}
                accessibilityRole="button"
                accessibilityLabel={messages.shareLabel}
                {...(handlers?.onPressShare ? { onPress: handlers.onPressShare } : {})}
              >
                <Text
                  color="$colorMuted"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <ShareIcon size={13} color="currentColor" />
                </Text>
                <Text fontSize={13} fontWeight="500" color="$colorMuted">
                  {messages.shareLabel}
                </Text>
              </Stack>
              <Stack
                tag="button"
                cursor="pointer"
                backgroundColor="$maint"
                borderWidth={0}
                paddingHorizontal={14}
                paddingVertical={8}
                borderRadius={10}
                flexDirection="row"
                alignItems="center"
                gap={6}
                accessibilityRole="button"
                accessibilityLabel={messages.exportLabel}
                testID="reports-export-cta"
                {...(handlers?.onPressExport ? { onPress: handlers.onPressExport } : {})}
                style={{
                  boxShadow: '0 2px 8px color-mix(in oklch, var(--maint) 28%, transparent)',
                }}
              >
                <Text color="white" display="flex" alignItems="center" justifyContent="center">
                  <DownloadIcon size={13} color="white" />
                </Text>
                <Text fontSize={13} fontWeight="600" color="white">
                  {messages.exportLabel}
                </Text>
              </Stack>
            </XStack>
          </XStack>

          {/* Body */}
          <Stack
            paddingHorizontal={32}
            paddingTop={20}
            paddingBottom={48}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
              gap: 20,
            }}
          >
            {/* Left col */}
            <YStack gap={16} minWidth={0}>
              <RangePicker
                label={messages.rangeLabel}
                options={messages.presets}
                active={activeRange}
                selectedRangeLabel={messages.selectedRangeLabel}
                mode="web"
                {...(handlers?.onChangeRange ? { onChange: handlers.onChangeRange } : {})}
              />

              <Stack
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 10,
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

              <ChartsCard
                adherence={adherenceSeries}
                rescue={rescueSeries}
                adherenceLabel={messages.adherenceChartLabel}
                rescueLabel={messages.rescueChartLabel}
                mode="web"
              />

              <Text fontSize={11} color="$colorFaint" textAlign="center" fontStyle="italic">
                {messages.notMedical}
              </Text>
            </YStack>

            {/* Right col : rescue log */}
            <YStack minWidth={0}>
              <Text
                tag="h2"
                margin={0}
                fontSize={11}
                color="$colorMore"
                textTransform="uppercase"
                letterSpacing={0.88}
                fontWeight="600"
                marginBottom={10}
              >
                {messages.rescueLogTitle}
              </Text>
              <RescueEventsList
                events={rescueEvents}
                reliefSuffix={messages.reliefSuffix}
                emptyTitle={messages.emptyRescueTitle}
                emptySub={messages.emptyRescueSub}
                mode="web"
                {...(handlers?.onPressEvent ? { onPressEvent: handlers.onPressEvent } : {})}
              />
            </YStack>
          </Stack>
        </YStack>
      </Stack>
    </Theme>
  );
}
