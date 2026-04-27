import * as React from 'react';
import { Stack, Text, Theme, YStack } from 'tamagui';

import { ChildProfileCard } from './ChildProfileCard';
import { SectionCard } from './SectionCard';
import { SettingsRow } from './SettingsRow';
import type {
  ChildProfileSummary,
  SettingsListHandlers,
  SettingsListMessages,
  SettingsSection,
} from './types';

export interface SettingsListMobileProps {
  messages: SettingsListMessages;
  child: ChildProfileSummary;
  sections: ReadonlyArray<SettingsSection>;
  handlers?: SettingsListHandlers | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function SettingsListMobile({
  messages,
  child,
  sections,
  handlers,
  theme = 'kinhale_light',
}: SettingsListMobileProps): React.JSX.Element {
  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
        <YStack
          tag="header"
          paddingHorizontal={20}
          paddingTop={8}
          paddingBottom={14}
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
        >
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
        </YStack>

        <Stack
          flex={1}
          paddingHorizontal={16}
          paddingTop={14}
          paddingBottom={32}
          style={{ overflow: 'auto' }}
        >
          <ChildProfileCard
            child={child}
            editLabel={messages.editProfileCta}
            mode="mobile"
            {...(handlers?.onPressEditProfile ? { onPressEdit: handlers.onPressEditProfile } : {})}
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
                    mode="mobile"
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
        </Stack>
      </YStack>
    </Theme>
  );
}
