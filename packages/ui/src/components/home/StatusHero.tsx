import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import type { StatusTime } from './types';

type Tone = 'maint' | 'amber' | 'ok';

interface StatusHeroProps {
  time: StatusTime;
  /** Pre-formatted localised strings. */
  messages: {
    onTrackTitle: string;
    onTrackSub: string;
    dueTitle: string;
    dueSub: string;
    overdueTitle: string;
    overdueSub: string;
  };
}

function toneFor(time: StatusTime): {
  tone: Tone;
  titleKey: 'onTrackTitle' | 'dueTitle' | 'overdueTitle';
  subKey: 'onTrackSub' | 'dueSub' | 'overdueSub';
} {
  if (time === 'overdue') return { tone: 'amber', titleKey: 'overdueTitle', subKey: 'overdueSub' };
  if (time === 'evening') return { tone: 'maint', titleKey: 'dueTitle', subKey: 'dueSub' };
  return { tone: 'ok', titleKey: 'onTrackTitle', subKey: 'onTrackSub' };
}

export function StatusHero({ time, messages }: StatusHeroProps): React.JSX.Element {
  const { tone, titleKey, subKey } = toneFor(time);

  const bgToken = tone === 'amber' ? '$amberSoft' : tone === 'maint' ? '$maintSoft' : '$okSoft';
  const dotToken = tone === 'amber' ? '$amber' : tone === 'maint' ? '$maint' : '$ok';
  const inkToken = tone === 'amber' ? '$amberInk' : tone === 'maint' ? '$maintInk' : '$okInk';

  return (
    <XStack
      padding="$4"
      backgroundColor={bgToken}
      borderRadius={20}
      borderWidth={0.5}
      borderColor="$borderColor"
      gap="$3"
      alignItems="flex-start"
    >
      {/* Dot with soft ring */}
      <Stack
        width={16}
        height={16}
        borderRadius={9999}
        backgroundColor={bgToken}
        alignItems="center"
        justifyContent="center"
        marginTop={6}
        flexShrink={0}
      >
        <Stack width={8} height={8} borderRadius={9999} backgroundColor={dotToken} />
      </Stack>

      <YStack flex={1} minWidth={0}>
        <Text
          fontSize={22}
          lineHeight={26}
          fontWeight="500"
          color={inkToken}
          letterSpacing="-0.02em"
        >
          {messages[titleKey]}
        </Text>
        <Text fontSize={13} color="$colorMuted" marginTop={4}>
          {messages[subKey]}
        </Text>
      </YStack>
    </XStack>
  );
}
