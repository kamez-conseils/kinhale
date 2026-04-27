import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { EnvelopeIcon } from './icons';
import type {
  CaregiverRole,
  InviteFormHandlers,
  InviteFormMessages,
  InviteFormState,
} from './types';

const inputBaseStyle: React.CSSProperties = {
  appearance: 'none',
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--borderColorStrong)',
  background: 'var(--background)',
  color: 'var(--color)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const ROLES: ReadonlyArray<CaregiverRole> = ['admin', 'contributor', 'restricted'];

const ROLE_HUE: Record<CaregiverRole, number> = {
  admin: 235,
  contributor: 200,
  restricted: 145,
};

export interface InviteFormProps {
  messages: InviteFormMessages;
  state: InviteFormState;
  onChange: (patch: Partial<InviteFormState>) => void;
  /** Si fourni, désactive le bouton Envoyer (ex. offline guard, validation). */
  submitDisabled?: boolean;
  /** Mode visuel : `web` => card 18 r ; `mobile` => 16 r réduit. */
  mode?: 'mobile' | 'web';
  handlers?: InviteFormHandlers | undefined;
  /** Permet de masquer certains rôles (ex. seul un admin peut promouvoir admin). */
  availableRoles?: ReadonlyArray<CaregiverRole>;
}

export function InviteForm({
  messages,
  state,
  onChange,
  submitDisabled = false,
  mode = 'web',
  handlers,
  availableRoles = ROLES,
}: InviteFormProps): React.JSX.Element {
  const visibleRoles = ROLES.filter((r) => availableRoles.includes(r));

  return (
    <YStack
      backgroundColor="$surface"
      borderRadius={mode === 'web' ? 18 : 16}
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={mode === 'web' ? 24 : 18}
      gap={16}
    >
      <YStack>
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={mode === 'web' ? 18 : 16}
          fontWeight="500"
          letterSpacing={-0.18}
          color="$color"
        >
          {messages.title}
        </Text>
        <Text fontSize={12.5} color="$colorMore" marginTop={4} lineHeight={18}>
          {messages.subtitle}
        </Text>
      </YStack>

      <Stack
        style={{
          display: 'grid',
          gridTemplateColumns: mode === 'web' ? '1fr 1fr' : '1fr',
          gap: 12,
        }}
      >
        <YStack gap={6}>
          <Text
            tag="label"
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.66}
            fontWeight="600"
            htmlFor="invite-name"
          >
            {messages.nameLabel}
          </Text>
          <input
            id="invite-name"
            type="text"
            value={state.name}
            placeholder={messages.namePlaceholder}
            onChange={(e) => onChange({ name: e.target.value })}
            style={inputBaseStyle}
          />
        </YStack>
        <YStack gap={6}>
          <Text
            tag="label"
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={0.66}
            fontWeight="600"
            htmlFor="invite-email"
          >
            {messages.emailLabel}
          </Text>
          <input
            id="invite-email"
            type="email"
            value={state.email}
            placeholder={messages.emailPlaceholder}
            onChange={(e) => onChange({ email: e.target.value })}
            style={inputBaseStyle}
          />
        </YStack>
      </Stack>

      <YStack>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.66}
          fontWeight="600"
          marginBottom={8}
        >
          {messages.chooseRoleLabel}
        </Text>
        <YStack gap={8}>
          {visibleRoles.map((r) => {
            const sel = state.role === r;
            const hue = ROLE_HUE[r];
            const accent = `oklch(40% 0.12 ${hue})`;
            return (
              <Stack
                key={r}
                tag="button"
                cursor="pointer"
                paddingHorizontal={14}
                paddingVertical={12}
                borderRadius={12}
                borderWidth={1.5}
                alignItems="stretch"
                onPress={() => onChange({ role: r })}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={messages.roleLabel[r]}
                style={{
                  borderColor: sel ? accent : 'var(--borderColorStrong)',
                  background: sel
                    ? `color-mix(in oklch, ${accent} 8%, var(--surface))`
                    : 'var(--background)',
                }}
              >
                <XStack alignItems="center" gap={12}>
                  <Stack
                    width={18}
                    height={18}
                    borderRadius={9}
                    borderWidth={1.5}
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                    style={{
                      borderColor: sel ? accent : 'var(--borderColorStrong)',
                      background: sel ? accent : 'transparent',
                    }}
                  >
                    {sel && (
                      <Stack width={7} height={7} borderRadius={4} backgroundColor="$background" />
                    )}
                  </Stack>
                  <YStack flex={1}>
                    <Text fontSize={13.5} fontWeight="600" color="$color" textAlign="left">
                      {messages.roleLabel[r]}
                    </Text>
                    <Text fontSize={11.5} color="$colorMore" marginTop={2} textAlign="left">
                      {messages.roleDescription[r]}
                    </Text>
                  </YStack>
                </XStack>
              </Stack>
            );
          })}
        </YStack>
      </YStack>

      <XStack gap={10} justifyContent="flex-end" marginTop={4}>
        {handlers?.onCancel && (
          <Stack
            tag="button"
            cursor="pointer"
            paddingHorizontal={16}
            paddingVertical={10}
            borderRadius={10}
            borderWidth={0.5}
            borderColor="$borderColorStrong"
            backgroundColor="$surface"
            accessibilityRole="button"
            accessibilityLabel={messages.cancelCta}
            onPress={handlers.onCancel}
          >
            <Text fontSize={13.5} fontWeight="500" color="$colorMuted">
              {messages.cancelCta}
            </Text>
          </Stack>
        )}
        <Stack
          tag="button"
          cursor={submitDisabled ? 'not-allowed' : 'pointer'}
          paddingHorizontal={18}
          paddingVertical={10}
          borderRadius={10}
          borderWidth={0}
          backgroundColor="$maint"
          opacity={submitDisabled ? 0.5 : 1}
          flexDirection="row"
          alignItems="center"
          gap={8}
          disabled={submitDisabled}
          accessibilityRole="button"
          accessibilityLabel={messages.sendCta}
          {...(submitDisabled || handlers?.onSubmit === undefined
            ? {}
            : { onPress: () => handlers.onSubmit?.(state) })}
          style={{
            boxShadow: submitDisabled
              ? 'none'
              : '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)',
          }}
        >
          <Text color="white" display="flex" alignItems="center" justifyContent="center">
            <EnvelopeIcon size={13} color="white" />
          </Text>
          <Text fontSize={13.5} fontWeight="600" color="white">
            {messages.sendCta}
          </Text>
        </Stack>
      </XStack>
    </YStack>
  );
}
