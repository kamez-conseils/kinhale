import * as React from 'react';
import { Text, XStack, YStack } from 'tamagui';

import { ChevronIcon, ExternalIcon } from './icons';
import { Segmented } from './Segmented';
import { Toggle } from './Toggle';
import type { SettingsRow } from './types';

export interface SettingsRowProps {
  row: SettingsRow;
  /** Section/row keys propagés aux handlers. */
  sectionKey: string;
  /** Si vrai, ne dessine pas la border-top (première rangée d'une card). */
  isFirst?: boolean;
  mode?: 'mobile' | 'web';
  onPress?: ((sectionKey: string, rowKey: string) => void) | undefined;
  onChangeToggle?: ((sectionKey: string, rowKey: string, checked: boolean) => void) | undefined;
  onChangeSegment?: ((sectionKey: string, rowKey: string, value: string) => void) | undefined;
}

export function SettingsRow({
  row,
  sectionKey,
  isFirst = false,
  mode = 'mobile',
  onPress,
  onChangeToggle,
  onChangeSegment,
}: SettingsRowProps): React.JSX.Element {
  const isPressable =
    onPress !== undefined && (row.kind === 'link' || row.kind === 'danger' || row.kind === 'value');
  const isDanger = row.kind === 'danger';

  const labelColor = isDanger ? '$rescueInk' : '$color';
  const subColor = '$colorMore';

  return (
    <XStack
      tag={isPressable ? 'button' : 'div'}
      cursor={isPressable ? 'pointer' : 'default'}
      backgroundColor="transparent"
      borderWidth={0}
      alignItems="center"
      gap={14}
      paddingHorizontal={mode === 'web' ? 18 : 16}
      paddingVertical={13}
      borderTopWidth={isFirst ? 0 : 0.5}
      borderTopColor="$borderColor"
      {...(isPressable ? { onPress: () => onPress?.(sectionKey, row.key) } : {})}
      {...(isPressable ? { hoverStyle: { backgroundColor: '$surface2' } } : {})}
      accessibilityRole={isPressable ? 'button' : undefined}
    >
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="500" color={labelColor}>
          {row.label}
        </Text>
        {(row.kind === 'toggle' || row.kind === 'link' || row.kind === 'danger') &&
          row.sub !== undefined &&
          row.sub !== '' && (
            <Text fontSize={12} color={subColor} marginTop={2}>
              {row.sub}
            </Text>
          )}
      </YStack>

      {row.kind === 'toggle' && (
        <Toggle
          checked={row.checked}
          ariaLabel={row.label}
          {...(onChangeToggle
            ? {
                onChange: (next) => onChangeToggle(sectionKey, row.key, next),
              }
            : {})}
        />
      )}

      {row.kind === 'segment' && (
        <Segmented
          options={row.options}
          value={row.value}
          ariaLabel={row.label}
          {...(onChangeSegment
            ? {
                onChange: (next) => onChangeSegment(sectionKey, row.key, next),
              }
            : {})}
        />
      )}

      {row.kind === 'value' && (
        <Text
          fontFamily={row.mono === true ? '$mono' : '$body'}
          fontSize={13}
          color="$colorMuted"
          style={row.mono === true ? { fontVariantNumeric: 'tabular-nums' } : undefined}
        >
          {row.value}
        </Text>
      )}

      {(row.kind === 'link' || row.kind === 'value' || row.kind === 'danger') && (
        <Text
          color={isDanger ? '$rescueInk' : '$colorMore'}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {row.kind === 'link' && row.external === true ? (
            <ExternalIcon size={12} color="currentColor" />
          ) : (
            <ChevronIcon size={13} color="currentColor" />
          )}
        </Text>
      )}
    </XStack>
  );
}
