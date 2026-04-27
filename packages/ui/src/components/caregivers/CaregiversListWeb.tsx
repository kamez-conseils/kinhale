import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { CaregiverRow } from './CaregiverRow';
import { CaregiversSidebar } from './CaregiversSidebar';
import { InviteForm } from './InviteForm';
import { PendingRow } from './PendingRow';
import { PermsTable } from './PermsTable';
import { PlusIcon } from './icons';
import type {
  CaregiverProfileView,
  CaregiversListHandlers,
  CaregiversListMessages,
  CaregiversNavItem,
  InviteFormHandlers,
  InviteFormMessages,
  InviteFormState,
  PendingInvitationView,
} from './types';

export interface CaregiversListWebProps {
  messages: CaregiversListMessages;
  inviteMessages: InviteFormMessages;
  caregivers: ReadonlyArray<CaregiverProfileView>;
  pending: ReadonlyArray<PendingInvitationView>;
  pendingStageLabels: Record<string, string>;
  pendingPrimaryCta?: ((view: PendingInvitationView) => string | null) | undefined;
  navItems: ReadonlyArray<CaregiversNavItem>;
  /** État formulaire d'invitation contrôlé par l'app appelante. */
  inviteState: InviteFormState;
  onInviteChange: (patch: Partial<InviteFormState>) => void;
  inviteSubmitDisabled?: boolean;
  inviteHandlers?: InviteFormHandlers | undefined;
  handlers?: CaregiversListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function CaregiversListWeb({
  messages,
  inviteMessages,
  caregivers,
  pending,
  pendingStageLabels,
  pendingPrimaryCta,
  navItems,
  inviteState,
  onInviteChange,
  inviteSubmitDisabled = false,
  inviteHandlers,
  handlers,
  theme = 'kinhale_light',
}: CaregiversListWebProps): React.JSX.Element {
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
        <CaregiversSidebar navItems={navItems} />

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

            {handlers?.onPressInvite && (
              <XStack
                tag="button"
                cursor="pointer"
                backgroundColor="$maint"
                borderWidth={0}
                paddingHorizontal={16}
                paddingVertical={9}
                borderRadius={10}
                alignItems="center"
                gap={8}
                accessibilityRole="button"
                accessibilityLabel={messages.inviteCta}
                testID="caregivers-invite-cta"
                onPress={handlers.onPressInvite}
                style={{
                  boxShadow: '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)',
                }}
              >
                <Text color="white" display="flex" alignItems="center" justifyContent="center">
                  <PlusIcon size={13} color="white" />
                </Text>
                <Text fontSize={13} fontWeight="600" color="white">
                  {messages.inviteCta}
                </Text>
              </XStack>
            )}
          </XStack>

          {/* Content : grid 1.3fr / 1fr */}
          <Stack
            paddingHorizontal={32}
            paddingTop={24}
            paddingBottom={48}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
              gap: 24,
            }}
          >
            {/* Left col : list + pending + perms */}
            <YStack gap={18} minWidth={0}>
              <YStack>
                <Text
                  tag="h2"
                  margin={0}
                  fontSize={11}
                  color="$colorMore"
                  textTransform="uppercase"
                  letterSpacing={0.88}
                  fontWeight="600"
                  marginBottom={8}
                >
                  {messages.sectionActive}
                </Text>
                <YStack
                  backgroundColor="$surface"
                  borderRadius={16}
                  borderWidth={0.5}
                  borderColor="$borderColor"
                  overflow="hidden"
                >
                  {caregivers.map((c) => (
                    <CaregiverRow
                      key={c.id}
                      caregiver={c}
                      youLabel={messages.youTag}
                      onlineLabel={messages.onlineNow}
                      roleLabel={messages.roleLabel[c.role]}
                      mode="web"
                      {...(handlers?.onPressCaregiver
                        ? { onPress: handlers.onPressCaregiver }
                        : {})}
                    />
                  ))}
                </YStack>
              </YStack>

              {pending.length > 0 && (
                <YStack>
                  <Text
                    tag="h2"
                    margin={0}
                    fontSize={11}
                    color="$colorMore"
                    textTransform="uppercase"
                    letterSpacing={0.88}
                    fontWeight="600"
                    marginBottom={8}
                    testID={
                      pending.some((p) => p.stage === 'awaitingSeal')
                        ? 'pending-seal-section'
                        : undefined
                    }
                  >
                    {messages.sectionPending}
                  </Text>
                  <YStack
                    borderRadius={16}
                    borderWidth={0.5}
                    borderColor="$borderColor"
                    overflow="hidden"
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
                          mode="web"
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
                </YStack>
              )}

              <PermsTable messages={messages} />

              <Text fontSize={11} color="$colorFaint" textAlign="center" fontStyle="italic">
                {messages.notMedical}
              </Text>
            </YStack>

            {/* Right col : invite form */}
            <YStack minWidth={0}>
              <InviteForm
                messages={inviteMessages}
                state={inviteState}
                onChange={onInviteChange}
                submitDisabled={inviteSubmitDisabled}
                mode="web"
                {...(inviteHandlers ? { handlers: inviteHandlers } : {})}
              />
            </YStack>
          </Stack>
        </YStack>
      </Stack>
    </Theme>
  );
}
