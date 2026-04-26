import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { BrandMark } from './BrandMark';
import { BreathOrb } from './BreathOrb';
import { CheckSmallIcon, LockIcon } from './icons';
import { LegalFooter } from './LegalFooter';
import type { AuthCopy, AuthInvitation } from './types';

interface AuthShellProps {
  copy: AuthCopy;
  layout: 'mobile' | 'web';
  invitation?: AuthInvitation | null;
  children: React.ReactNode;
}

// Gabarit visuel commun aux 3 états (enter / sent / signing).
//   - Mobile : 1 colonne, marque + orb + slot enfant + footer légal
//   - Web    : 2 colonnes (panneau marque + colonne formulaire)
//
// Le slot enfant est l'écran courant (EmailForm / SentBlock / SigningBlock)
// avec son propre titre — c'est l'écran qui décide quoi afficher.
export function AuthShell({
  copy,
  layout,
  invitation = null,
  children,
}: AuthShellProps): React.JSX.Element {
  const headerCopy = invitation
    ? {
        title: copy.invitedAs({
          who: invitation.inviterName,
          role: copy.roleLabels[invitation.role],
        }),
        sub: copy.inviteHelper,
      }
    : { title: copy.welcomeTitle, sub: copy.welcomeSub };

  if (layout === 'mobile') {
    return (
      <Theme name="kinhale_light">
        <YStack
          flex={1}
          backgroundColor="$background"
          paddingHorizontal={24}
          paddingTop={24}
          paddingBottom={24}
        >
          <Stack alignItems="center" paddingTop={12} paddingBottom={28}>
            <BrandMark size="md" accent="$maint" />
          </Stack>

          <Stack alignItems="center" marginBottom={24}>
            <BreathOrb size={160} />
          </Stack>

          <YStack flex={1} minHeight={0}>
            <YStack alignItems="center" marginBottom={24} gap={8}>
              <Text
                tag="h1"
                margin={0}
                fontSize={28}
                fontWeight="500"
                letterSpacing={-0.6}
                color="$color"
                lineHeight={32}
                textAlign="center"
              >
                {headerCopy.title}
              </Text>
              <Text fontSize={14} color="$colorMuted" textAlign="center" lineHeight={21}>
                {headerCopy.sub}
              </Text>
            </YStack>

            {children}
          </YStack>

          <LegalFooter copy={copy} layout="mobile" />
        </YStack>
      </Theme>
    );
  }

  // ── Layout web : 2 colonnes ────────────────────────────────────────────
  return (
    <Theme name="kinhale_light">
      <YStack
        flex={1}
        flexDirection="row"
        backgroundColor="$background"
        $sm={{ flexDirection: 'column' }}
      >
        {/* Panneau marque (gauche) */}
        <YStack
          flex={1.1}
          padding={48}
          paddingTop={40}
          justifyContent="space-between"
          backgroundColor="$surface"
          borderRightWidth={0.5}
          borderRightColor="$borderColor"
          $sm={{
            flex: 0,
            paddingTop: 24,
            paddingBottom: 16,
            paddingHorizontal: 24,
            borderRightWidth: 0,
            borderBottomWidth: 0.5,
            borderBottomColor: '$borderColor',
          }}
        >
          <BrandMark size="lg" accent="$maint" />

          <YStack gap={28} alignItems="flex-start" $sm={{ display: 'none' }}>
            <BreathOrb size={220} />
            <Text
              fontSize={38}
              fontWeight="500"
              letterSpacing={-0.95}
              color="$color"
              lineHeight={44}
              maxWidth={420}
            >
              {copy.tagline}
            </Text>
            <YStack gap={10}>
              {[copy.panelLine1, copy.panelLine2, copy.panelLine3].map((line, i) => (
                <XStack key={i} alignItems="flex-start" gap={12}>
                  <Stack
                    width={16}
                    height={16}
                    borderRadius={8}
                    marginTop={3}
                    backgroundColor="$okSoft"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <CheckSmallIcon size={10} color="var(--ok, currentColor)" />
                  </Stack>
                  <Text fontSize={15} color="$colorMuted" lineHeight={22}>
                    {line}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </YStack>

          <XStack alignItems="center" gap={8} $sm={{ display: 'none' }}>
            <LockIcon size={11} color="var(--colorFaint, currentColor)" />
            <Text fontSize={11} color="$colorFaint">
              {copy.poweredOpen}
            </Text>
          </XStack>
        </YStack>

        {/* Colonne formulaire (droite) */}
        <YStack
          flex={1}
          padding={64}
          paddingTop={60}
          justifyContent="center"
          position="relative"
          $sm={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 100 }}
        >
          <YStack maxWidth={380} width="100%" alignSelf="center" gap={28}>
            <YStack gap={10}>
              <Text
                tag="h1"
                margin={0}
                fontSize={36}
                fontWeight="500"
                letterSpacing={-0.9}
                color="$color"
                lineHeight={40}
                $sm={{ fontSize: 28, lineHeight: 32 }}
              >
                {headerCopy.title}
              </Text>
              <Text fontSize={15} color="$colorMuted" lineHeight={23}>
                {headerCopy.sub}
              </Text>
            </YStack>
            {children}
          </YStack>

          <Stack
            position="absolute"
            bottom={28}
            left={64}
            right={64}
            $sm={{ left: 24, right: 24, bottom: 16 }}
          >
            <LegalFooter copy={copy} layout="web" />
          </Stack>
        </YStack>
      </YStack>
    </Theme>
  );
}
