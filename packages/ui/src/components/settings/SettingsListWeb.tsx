import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { ChildProfileCard } from './ChildProfileCard';
import { SectionCard } from './SectionCard';
import { SettingsRow } from './SettingsRow';
import { SettingsSidebar } from './SettingsSidebar';
import type {
  ChildProfileSummary,
  SettingsListHandlers,
  SettingsListMessages,
  SettingsNavItem,
  SettingsSection,
} from './types';

export interface SettingsListWebProps {
  messages: SettingsListMessages;
  child: ChildProfileSummary;
  sections: ReadonlyArray<SettingsSection>;
  navItems: ReadonlyArray<SettingsNavItem>;
  handlers?: SettingsListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function SettingsListWeb({
  messages,
  child,
  sections,
  navItems,
  handlers,
  theme = 'kinhale_light',
}: SettingsListWebProps): React.JSX.Element {
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
        <SettingsSidebar navItems={navItems} />

        <YStack tag="main" minHeight={0} style={{ overflow: 'auto' }}>
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
              {messages.subtitle !== undefined && messages.subtitle !== '' && (
                <Text fontSize={13} color="$colorMore" marginTop={4}>
                  {messages.subtitle}
                </Text>
              )}
            </YStack>
          </XStack>

          <YStack
            paddingHorizontal={32}
            paddingTop={24}
            paddingBottom={48}
            maxWidth={780}
            width="100%"
            alignSelf="center"
          >
            <ChildProfileCard
              child={child}
              editLabel={messages.editProfileCta}
              mode="web"
              {...(handlers?.onPressEditProfile
                ? { onPressEdit: handlers.onPressEditProfile }
                : {})}
            />

            {sections.map((section, idx) => (
              <React.Fragment key={section.key}>
                {idx > 0 && <Stack height={14} />}
                <SectionCard icon={section.icon} title={section.title}>
                  {section.rows.map((row, rowIdx) => (
                    <SettingsRow
                      key={row.key}
                      row={row}
                      sectionKey={section.key}
                      isFirst={rowIdx === 0}
                      mode="web"
                      {...(handlers?.onPressRow ? { onPress: handlers.onPressRow } : {})}
                      {...(handlers?.onChangeToggle
                        ? { onChangeToggle: handlers.onChangeToggle }
                        : {})}
                      {...(handlers?.onChangeSegment
                        ? { onChangeSegment: handlers.onChangeSegment }
                        : {})}
                    />
                  ))}
                </SectionCard>
              </React.Fragment>
            ))}

            <Stack
              tag="button"
              cursor="pointer"
              backgroundColor="transparent"
              borderWidth={0.5}
              borderColor="$borderColorStrong"
              paddingVertical={12}
              borderRadius={12}
              marginTop={18}
              alignItems="center"
              accessibilityRole="button"
              accessibilityLabel={messages.signOutCta}
              testID="settings-sign-out"
              {...(handlers?.onPressSignOut ? { onPress: handlers.onPressSignOut } : {})}
            >
              <Text fontSize={13.5} fontWeight="600" color="$rescueInk">
                {messages.signOutCta}
              </Text>
            </Stack>

            <Text
              fontSize={11}
              color="$colorFaint"
              textAlign="center"
              marginTop={20}
              fontStyle="italic"
            >
              {messages.notMedical}
            </Text>
          </YStack>
        </YStack>
      </Stack>
    </Theme>
  );
}
