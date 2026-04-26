import * as React from 'react';
import { ScrollView, Text, Theme, YStack } from 'tamagui';

import { Activity } from './Activity';
import { BottomActionBar } from './BottomActionBar';
import { Caregivers } from './Caregivers';
import { DaycareRestrictedView } from './DaycareRestrictedView';
import { Inventory } from './Inventory';
import { KinhaleHeader } from './KinhaleHeader';
import { ScheduleStrip } from './ScheduleStrip';
import { StatusHero } from './StatusHero';
import type {
  ActivityItem,
  CaregiverRole,
  CaregiverView,
  InhalerView,
  ScheduleSlot,
  ScheduleSlotState,
  StatusTime,
} from './types';

export interface HomeDashboardMessages {
  // Header
  childName: string;
  dateLabel: string;
  roleLabel: string;
  // Status hero
  status: {
    onTrackTitle: string;
    onTrackSub: string;
    dueTitle: string;
    dueSub: string;
    overdueTitle: string;
    overdueSub: string;
  };
  // Schedule
  scheduleTitle: string;
  scheduleStateLabels: Record<ScheduleSlotState, string>;
  // Inventory
  inventoryTitle: string;
  refillSoonLabel: string;
  formatDosesLeft: (n: number) => string;
  formatExpiryStatus: (inh: InhalerView) => { kind: 'normal' | 'soon' | 'expired'; label: string };
  inventoryEmpty?: React.ReactNode;
  // Activity
  activityTitle: string;
  historyLabel: string;
  formatBy: (name: string) => string;
  activityEmpty?: React.ReactNode;
  // Caregivers
  caregiversTitle: string;
  syncPendingLabel: string;
  // Bottom bar
  quickActionCaption: string;
  quickMaintLabel: string;
  quickRescueLabel: string;
  // Disclaimer
  notMedicalDevice: string;
  // Daycare-restricted view
  daycareView?: {
    sectionLabel: string;
    promptLabel: string;
    doneLabel: string;
    buttonLabel: string;
    sessionLabel: string;
  };
}

export interface HomeDashboardData {
  role: CaregiverRole;
  time: StatusTime;
  scheduleSlots: ScheduleSlot[];
  inhalers: InhalerView[];
  activity: ActivityItem[];
  caregivers: CaregiverView[];
}

export interface HomeDashboardHandlers {
  onPressMaint?: (() => void) | undefined;
  onPressRescue?: (() => void) | undefined;
  onPressHistory?: (() => void) | undefined;
  onPressDaycareGiven?: (() => void) | undefined;
}

export interface HomeDashboardProps {
  messages: HomeDashboardMessages;
  data: HomeDashboardData;
  handlers?: HomeDashboardHandlers;
  /** Defaults to `kinhale_light`. Pass `kinhale_dark` for the dark theme. */
  theme?: 'kinhale_light' | 'kinhale_dark';
}

/** The full Home dashboard for an authenticated caregiver. */
export function HomeDashboard({
  messages,
  data,
  handlers,
  theme = 'kinhale_light',
}: HomeDashboardProps): React.JSX.Element {
  const { role, time, scheduleSlots, inhalers, activity, caregivers } = data;

  if (role === 'restricted' && messages.daycareView) {
    return (
      <Theme name={theme}>
        <YStack flex={1} backgroundColor="$background">
          <KinhaleHeader
            dateLabel={messages.dateLabel}
            childName={messages.childName}
            roleLabel={messages.roleLabel}
            role={role}
          />
          <DaycareRestrictedView
            childName={messages.childName}
            sectionLabel={messages.daycareView.sectionLabel}
            promptLabel={messages.daycareView.promptLabel}
            doneLabel={messages.daycareView.doneLabel}
            buttonLabel={messages.daycareView.buttonLabel}
            sessionLabel={messages.daycareView.sessionLabel}
            disclaimer={messages.notMedicalDevice}
            onPressGiven={handlers?.onPressDaycareGiven}
          />
        </YStack>
      </Theme>
    );
  }

  return (
    <Theme name={theme}>
      <YStack flex={1} backgroundColor="$background">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
          <KinhaleHeader
            dateLabel={messages.dateLabel}
            childName={messages.childName}
            roleLabel={messages.roleLabel}
            role={role}
          />

          <YStack paddingHorizontal="$4" paddingBottom="$5" gap="$3.5">
            <StatusHero time={time} messages={messages.status} />

            <ScheduleStrip
              title={messages.scheduleTitle}
              slots={scheduleSlots}
              stateLabels={messages.scheduleStateLabels}
            />

            <Inventory
              title={messages.inventoryTitle}
              inhalers={inhalers}
              formatDosesLeft={messages.formatDosesLeft}
              formatExpiryStatus={messages.formatExpiryStatus}
              refillSoonLabel={messages.refillSoonLabel}
              emptyState={messages.inventoryEmpty}
            />

            <Activity
              title={messages.activityTitle}
              items={activity}
              formatBy={messages.formatBy}
              historyLabel={messages.historyLabel}
              onPressHistory={handlers?.onPressHistory}
              emptyState={messages.activityEmpty}
            />

            <Caregivers
              title={messages.caregiversTitle}
              caregivers={caregivers}
              syncPendingLabel={messages.syncPendingLabel}
            />

            <Text
              fontSize={11}
              color="$colorFaint"
              textAlign="center"
              paddingVertical="$2"
              fontStyle="italic"
            >
              {messages.notMedicalDevice}
            </Text>
          </YStack>
        </ScrollView>

        <BottomActionBar
          caption={messages.quickActionCaption}
          maintLabel={messages.quickMaintLabel}
          rescueLabel={messages.quickRescueLabel}
          onPressMaint={handlers?.onPressMaint}
          onPressRescue={handlers?.onPressRescue}
        />
      </YStack>
    </Theme>
  );
}
