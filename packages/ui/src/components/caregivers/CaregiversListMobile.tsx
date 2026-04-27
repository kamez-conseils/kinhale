import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { CaregiverRow } from './CaregiverRow';
import { PendingRow } from './PendingRow';
import { PermsTable } from './PermsTable';
import { PlusIcon } from './icons';
import type {
  CaregiverProfileView,
  CaregiversListHandlers,
  CaregiversListMessages,
  PendingInvitationView,
} from './types';

export interface CaregiversListMobileProps {
  messages: CaregiversListMessages;
  caregivers: ReadonlyArray<CaregiverProfileView>;
  pending: ReadonlyArray<PendingInvitationView>;
  /**
   * Mappage stade → libellé localisé (ex. « Envoyée le 24 avril · en
   * attente de l'invité·e »). L'app appelante construit ce libellé pour
   * éviter de dupliquer le formatage de date dans le composant.
   */
  pendingStageLabels: Record<string, string>;
  /** Mappage stade → CTA principal contextualisé (peut renvoyer null). */
  pendingPrimaryCta?: ((view: PendingInvitationView) => string | null) | undefined;
  handlers?: CaregiversListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function CaregiversListMobile({
  messages,
  caregivers,
  pending,
  pendingStageLabels,
  pendingPrimaryCta,
  handlers,
  theme = 'kinhale_light',
}: CaregiversListMobileProps): React.JSX.Element {
  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
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
            backgroundColor="$maint"
            paddingHorizontal={14}
            paddingVertical={8}
            borderRadius={99}
            borderWidth={0}
            alignItems="center"
            gap={6}
            accessibilityRole="button"
            accessibilityLabel={messages.inviteCta}
            testID="caregivers-invite-cta"
            {...(handlers?.onPressInvite ? { onPress: handlers.onPressInvite } : {})}
            style={{
              boxShadow: '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)',
            }}
          >
            <Text color="white" display="flex" alignItems="center" justifyContent="center">
              <PlusIcon size={13} color="white" />
            </Text>
            <Text fontSize={12.5} fontWeight="600" color="white">
              {messages.inviteShort}
            </Text>
          </XStack>
        </XStack>

        <Stack flex={1} style={{ overflow: 'auto' }}>
          {/* Active section */}
          <Text
            tag="h2"
            margin={0}
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.88}
            fontWeight="600"
            paddingHorizontal={20}
            paddingTop={14}
            paddingBottom={8}
          >
            {messages.sectionActive}
          </Text>
          <YStack
            backgroundColor="$surface"
            borderTopWidth={0.5}
            borderTopColor="$borderColor"
            borderBottomWidth={0.5}
            borderBottomColor="$borderColor"
          >
            {caregivers.map((c) => (
              <CaregiverRow
                key={c.id}
                caregiver={c}
                youLabel={messages.youTag}
                onlineLabel={messages.onlineNow}
                roleLabel={messages.roleLabel[c.role]}
                mode="mobile"
                {...(handlers?.onPressCaregiver ? { onPress: handlers.onPressCaregiver } : {})}
              />
            ))}
          </YStack>

          {/* Pending section */}
          {pending.length > 0 && (
            <>
              <Text
                tag="h2"
                margin={0}
                fontSize={11}
                color="$colorMore"
                textTransform="uppercase"
                letterSpacing={0.88}
                fontWeight="600"
                paddingHorizontal={20}
                paddingTop={14}
                paddingBottom={8}
                testID={
                  pending.some((p) => p.stage === 'awaitingSeal')
                    ? 'pending-seal-section'
                    : undefined
                }
              >
                {messages.sectionPending}
              </Text>
              <YStack
                borderTopWidth={0.5}
                borderTopColor="$borderColor"
                borderBottomWidth={0.5}
                borderBottomColor="$borderColor"
              >
                {pending.map((p) => {
                  const primaryCta = pendingPrimaryCta?.(p) ?? null;
                  const isAwaitingSeal = p.stage === 'awaitingSeal';
                  return (
                    <PendingRow
                      key={p.token}
                      invitation={p}
                      roleLabel={messages.roleLabel[p.role]}
                      stageLabel={pendingStageLabels[p.stage] ?? ''}
                      resendCta={messages.resendCta}
                      withdrawCta={messages.withdrawCta}
                      {...(primaryCta !== null ? { primaryCta } : {})}
                      mode="mobile"
                      {...(isAwaitingSeal
                        ? {
                            rowTestID: `pending-seal-card-${p.token}`,
                            primaryTestID: `seal-button-${p.token}`,
                          }
                        : {})}
                      {...(handlers?.onPressResend ? { onResend: handlers.onPressResend } : {})}
                      {...(handlers?.onPressWithdraw
                        ? { onWithdraw: handlers.onPressWithdraw }
                        : {})}
                      {...(handlers?.onPressSeal ? { onPrimary: handlers.onPressSeal } : {})}
                    />
                  );
                })}
              </YStack>
            </>
          )}

          <Stack paddingHorizontal={16} paddingVertical={20}>
            <PermsTable messages={messages} />
          </Stack>

          <Text
            fontSize={11}
            color="$colorFaint"
            textAlign="center"
            paddingBottom={32}
            fontStyle="italic"
          >
            {messages.notMedical}
          </Text>
        </Stack>
      </YStack>
    </Theme>
  );
}
