import * as React from 'react';
import { Stack, Text } from 'tamagui';

import type { CalendarCell, CalendarCellState } from './types';

interface ToneTokens {
  bg: string;
  fg: string;
  dot: string | null;
  ring?: boolean;
  strike?: boolean;
}

function toneFor(state: CalendarCellState): ToneTokens {
  switch (state) {
    case 'done':
      return { bg: '$okSoft', fg: '$ok', dot: '$ok' };
    case 'partial':
      return { bg: '$amberSoft', fg: '$amberInk', dot: '$amber' };
    case 'missed':
      return { bg: '$missSoft', fg: '$colorMore', dot: '$miss', strike: true };
    case 'rescue':
      return { bg: '$rescueSoft', fg: '$rescue', dot: '$rescue' };
    case 'todayPending':
      return { bg: 'transparent', fg: '$color', dot: '$maint', ring: true };
    case 'future':
    default:
      return { bg: 'transparent', fg: '$colorFaint', dot: null };
  }
}

export interface CalendarGridProps {
  /** Tableau des libellés courts des 7 jours (déjà localisés). */
  weekdays: ReadonlyArray<string>;
  /** Cases du mois (avec padding début de semaine). */
  cells: ReadonlyArray<CalendarCell>;
  /** `true` => format dense pour mobile. */
  compact?: boolean;
  onPressDay?: ((iso: string) => void) | undefined;
}

export function CalendarGrid({
  weekdays,
  cells,
  compact = false,
  onPressDay,
}: CalendarGridProps): React.JSX.Element {
  return (
    <Stack>
      {/* Weekday headers */}
      <Stack
        marginBottom={8}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {weekdays.map((w, i) => (
          <Text
            key={i}
            textAlign="center"
            fontSize={10}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.6}
            fontWeight="600"
          >
            {w}
          </Text>
        ))}
      </Stack>

      {/* Cells */}
      <Stack
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {cells.map((c, i) => {
          if (c.day === null) return <Stack key={i} />;
          const tone = toneFor(c.state);
          const cellMin = compact ? 36 : 48;
          const isPressable = onPressDay !== undefined && c.iso !== undefined;
          return (
            <Stack
              key={i}
              tag={isPressable ? 'button' : 'div'}
              borderRadius={10}
              backgroundColor={tone.bg as never}
              borderWidth={tone.ring ? 1.5 : 0.5}
              borderColor={tone.ring ? '$maint' : '$borderColor'}
              alignItems="center"
              justifyContent="center"
              gap={3}
              position="relative"
              cursor={isPressable ? 'pointer' : 'default'}
              {...(isPressable && c.iso ? { onPress: () => onPressDay(c.iso ?? '') } : {})}
              accessibilityRole={isPressable ? 'button' : undefined}
              accessibilityLabel={c.iso ?? `day-${c.day}`}
              style={{ aspectRatio: '1', minHeight: cellMin }}
            >
              <Text
                fontSize={compact ? 11 : 12}
                color={tone.fg as never}
                fontWeight={c.state === 'todayPending' ? '700' : '500'}
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  textDecoration: tone.strike ? 'line-through' : 'none',
                }}
              >
                {c.day}
              </Text>
              {tone.dot !== null && (
                <Stack width={4} height={4} borderRadius={2} backgroundColor={tone.dot as never} />
              )}
              {c.state === 'rescue' && (
                <Stack
                  position="absolute"
                  top={4}
                  right={4}
                  width={6}
                  height={6}
                  borderRadius={3}
                  backgroundColor="$rescue"
                  style={{ boxShadow: '0 0 0 2px var(--background)' }}
                />
              )}
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}
