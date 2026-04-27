import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { Avatar } from './Avatar';
import { EnvelopeIcon } from './icons';
import { RolePill } from './RolePill';
import type { PendingInvitationView } from './types';

export interface PendingRowProps {
  invitation: PendingInvitationView;
  /** Libellé localisé du rôle. */
  roleLabel: string;
  /** Phrase localisée décrivant le stade (« Envoyée le X · en attente de … »). */
  stageLabel: string;
  resendCta: string;
  withdrawCta: string;
  /** CTA principal contextuel : sceller, accepter, etc. (optionnel). */
  primaryCta?: string | undefined;
  mode?: 'mobile' | 'web';
  /** testID optionnel posé sur la ligne (utile pour les tests Jest). */
  rowTestID?: string | undefined;
  /** testID optionnel posé sur le bouton primaire (ex. « Finaliser »). */
  primaryTestID?: string | undefined;
  onResend?: ((token: string) => void) | undefined;
  onWithdraw?: ((token: string) => void) | undefined;
  onPrimary?: ((token: string) => void) | undefined;
}

export function PendingRow({
  invitation,
  roleLabel,
  stageLabel,
  resendCta,
  withdrawCta,
  primaryCta,
  mode = 'mobile',
  rowTestID,
  primaryTestID,
  onResend,
  onWithdraw,
  onPrimary,
}: PendingRowProps): React.JSX.Element {
  return (
    <XStack
      alignItems="center"
      gap={14}
      paddingHorizontal={mode === 'web' ? 16 : 14}
      paddingVertical={mode === 'web' ? 14 : 12}
      borderBottomWidth={0.5}
      borderBottomColor="$borderColor"
      {...(rowTestID !== undefined ? { testID: rowTestID } : {})}
      style={{
        background: 'color-mix(in oklch, var(--amber) 4%, var(--surface))',
      }}
    >
      <Avatar initials={invitation.initials} hue={invitation.hue} size={40} pending />
      <YStack flex={1} minWidth={0}>
        <XStack alignItems="center" gap={8} flexWrap="wrap">
          <Text fontSize={14.5} fontWeight="500" color="$colorMuted">
            {invitation.name}
          </Text>
          <RolePill role={invitation.role} label={roleLabel} compact />
        </XStack>
        <XStack alignItems="center" gap={5} marginTop={2}>
          <Text color="$amberInk" display="flex" alignItems="center" justifyContent="center">
            <EnvelopeIcon size={11} color="currentColor" />
          </Text>
          <Text fontSize={11.5} color="$amberInk">
            {invitation.email !== undefined && invitation.email !== ''
              ? `${invitation.email} · ${stageLabel}`
              : stageLabel}
          </Text>
        </XStack>
      </YStack>
      {primaryCta !== undefined && primaryCta !== '' && onPrimary && (
        <Stack
          tag="button"
          cursor="pointer"
          backgroundColor="$maint"
          paddingHorizontal={12}
          paddingVertical={6}
          borderRadius={99}
          borderWidth={0}
          accessibilityRole="button"
          accessibilityLabel={primaryCta}
          {...(primaryTestID !== undefined ? { testID: primaryTestID } : {})}
          onPress={() => onPrimary(invitation.token)}
        >
          <Text fontSize={12} fontWeight="600" color="white">
            {primaryCta}
          </Text>
        </Stack>
      )}
      <Stack
        tag="button"
        cursor="pointer"
        backgroundColor="$surface"
        borderWidth={0.5}
        borderColor="$borderColorStrong"
        paddingHorizontal={12}
        paddingVertical={6}
        borderRadius={99}
        accessibilityRole="button"
        accessibilityLabel={resendCta}
        {...(onResend ? { onPress: () => onResend(invitation.token) } : {})}
      >
        <Text fontSize={12} fontWeight="500" color="$colorMuted">
          {resendCta}
        </Text>
      </Stack>
      <Stack
        tag="button"
        cursor="pointer"
        backgroundColor="transparent"
        borderWidth={0}
        paddingHorizontal={8}
        paddingVertical={6}
        accessibilityRole="button"
        accessibilityLabel={withdrawCta}
        {...(onWithdraw ? { onPress: () => onWithdraw(invitation.token) } : {})}
      >
        <Text fontSize={12} fontWeight="500" color="$colorMore">
          {withdrawCta}
        </Text>
      </Stack>
    </XStack>
  );
}
