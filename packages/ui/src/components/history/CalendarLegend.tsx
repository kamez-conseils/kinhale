import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import type { HistoryListMessages } from './types';

export interface CalendarLegendProps {
  messages: Pick<
    HistoryListMessages,
    'legendDone' | 'legendPartial' | 'legendMissed' | 'legendRescue'
  >;
  /**
   * Si vrai, supprime le `marginTop:12` (utile quand la légende est
   * placée à côté du `MonthHeader` côté web — le parent gère
   * l'alignement vertical lui-même).
   */
  inline?: boolean;
}

export function CalendarLegend({
  messages,
  inline = false,
}: CalendarLegendProps): React.JSX.Element {
  const items: ReadonlyArray<{ label: string; tone: string }> = [
    { label: messages.legendDone, tone: '$ok' },
    { label: messages.legendPartial, tone: '$amber' },
    { label: messages.legendMissed, tone: '$miss' },
    { label: messages.legendRescue, tone: '$rescue' },
  ];
  return (
    <XStack gap={14} flexWrap="wrap" {...(inline ? {} : { marginTop: 12 })}>
      {items.map((it) => (
        <XStack key={it.label} alignItems="center" gap={6}>
          <Stack width={8} height={8} borderRadius={4} backgroundColor={it.tone as never} />
          <Text fontSize={11} color="$colorMore">
            {it.label}
          </Text>
        </XStack>
      ))}
    </XStack>
  );
}
