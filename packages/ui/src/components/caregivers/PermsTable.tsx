import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { ShieldIcon } from './icons';
import type { CaregiverRole, CaregiversListMessages } from './types';

const ROLE_HUE: Record<CaregiverRole, number> = {
  admin: 235,
  contributor: 200,
  restricted: 145,
};

export interface PermsTableProps {
  messages: Pick<
    CaregiversListMessages,
    | 'permissionsTitle'
    | 'permission1'
    | 'permission2'
    | 'permission3'
    | 'permission4'
    | 'permission5'
    | 'permYes'
    | 'permNo'
    | 'roleLabel'
  >;
}

const MATRIX: ReadonlyArray<{
  key: keyof Pick<
    CaregiversListMessages,
    'permission1' | 'permission2' | 'permission3' | 'permission4' | 'permission5'
  >;
  admin: boolean;
  contributor: boolean;
  restricted: boolean;
}> = [
  { key: 'permission1', admin: true, contributor: true, restricted: true },
  { key: 'permission2', admin: true, contributor: true, restricted: true },
  { key: 'permission3', admin: true, contributor: true, restricted: false },
  { key: 'permission4', admin: true, contributor: false, restricted: false },
  { key: 'permission5', admin: true, contributor: true, restricted: false },
];

const ROLES: ReadonlyArray<CaregiverRole> = ['admin', 'contributor', 'restricted'];

export function PermsTable({ messages }: PermsTableProps): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius={16}
      borderWidth={0.5}
      borderColor="$borderColor"
      overflow="hidden"
    >
      <XStack
        alignItems="center"
        gap={8}
        paddingHorizontal={16}
        paddingVertical={14}
        borderBottomWidth={0.5}
        borderBottomColor="$borderColor"
      >
        <Text color="$colorMuted" display="flex" alignItems="center" justifyContent="center">
          <ShieldIcon size={13} color="currentColor" />
        </Text>
        <Text fontSize={13} fontWeight="600" color="$color">
          {messages.permissionsTitle}
        </Text>
      </XStack>
      <Stack
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 70px 70px',
        }}
      >
        <Stack paddingHorizontal={16} paddingVertical={10} />
        {ROLES.map((r) => (
          <Stack
            key={r}
            paddingHorizontal={6}
            paddingVertical={10}
            alignItems="center"
            justifyContent="center"
          >
            <Text
              fontSize={10}
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.6}
              style={{ color: `oklch(40% 0.12 ${ROLE_HUE[r]})` }}
            >
              {messages.roleLabel[r].split(' ')[0]}
            </Text>
          </Stack>
        ))}
        {MATRIX.map((row) => (
          <React.Fragment key={row.key}>
            <Stack
              paddingHorizontal={16}
              paddingVertical={10}
              borderTopWidth={0.5}
              borderTopColor="$borderColor"
            >
              <Text fontSize={12} color="$colorMuted">
                {messages[row.key]}
              </Text>
            </Stack>
            {ROLES.map((r) => {
              const ok = row[r];
              return (
                <Stack
                  key={r}
                  paddingHorizontal={6}
                  paddingVertical={10}
                  alignItems="center"
                  justifyContent="center"
                  borderTopWidth={0.5}
                  borderTopColor="$borderColor"
                >
                  <Text
                    fontSize={12}
                    fontWeight={ok ? '700' : '400'}
                    color={ok ? '$ok' : '$colorFaint'}
                  >
                    {ok ? messages.permYes : messages.permNo}
                  </Text>
                </Stack>
              );
            })}
          </React.Fragment>
        ))}
      </Stack>
    </YStack>
  );
}
