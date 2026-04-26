import * as React from 'react';
import { ScrollView, Stack, Text, XStack, YStack } from 'tamagui';

import { Section } from './Section';
import { SectionHeader } from './SectionHeader';
import type { CaregiverView } from './types';

interface CaregiversProps {
  title: string;
  caregivers: CaregiverView[];
  syncPendingLabel: string;
}

export function Caregivers({
  title,
  caregivers,
  syncPendingLabel,
}: CaregiversProps): React.JSX.Element {
  return (
    <Section>
      <SectionHeader label={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$4">
          {caregivers.map((p) => (
            <YStack key={p.id} alignItems="center" gap="$1.5" minWidth={56}>
              <Stack position="relative">
                <Stack
                  width={44}
                  height={44}
                  borderRadius={9999}
                  backgroundColor="$surface2"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={0.5}
                  borderColor="$borderColor"
                >
                  <Text fontSize={16} fontWeight="600" color={p.accentColor}>
                    {p.initial}
                  </Text>
                </Stack>
                <Stack
                  position="absolute"
                  bottom={-1}
                  right={-1}
                  width={12}
                  height={12}
                  borderRadius={9999}
                  backgroundColor={p.online ? '$ok' : '$colorFaint'}
                  borderWidth={2}
                  borderColor="$surface"
                />
              </Stack>
              <Text fontSize={11} color="$colorMuted" fontWeight="500" textAlign="center">
                {p.name}
              </Text>
              <Text
                fontSize={10}
                color="$colorFaint"
                textTransform="uppercase"
                letterSpacing="0.06em"
              >
                {p.syncPending ? syncPendingLabel : p.roleLabel}
              </Text>
            </YStack>
          ))}
        </XStack>
      </ScrollView>
    </Section>
  );
}
